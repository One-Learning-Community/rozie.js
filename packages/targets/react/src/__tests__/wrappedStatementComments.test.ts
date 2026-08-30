/**
 * wrappedStatementComments.test.ts — Quick 260829-j18 Task 6 follow-up.
 *
 * Discovered by Task 6's own blast-radius census: 46 lines of author
 * documentation vanished from the shipped React corpus (CodeMirror,
 * DataTable, FlowCanvas, TipTap, Toaster) the moment the transitive rule
 * routed more consts through `tryWrapEscapingConstUseMemo`.
 *
 * The mechanism is structural, not incidental. A comment sitting BETWEEN two
 * statements is attached by Babel's parser to BOTH neighbours — as the
 * earlier statement's `trailingComments` AND the later statement's
 * `leadingComments` (`genBlockInner`'s doc comment is the canonical statement
 * of this). The component-scope emission loop mixes two kinds of statement:
 *   - WRAPPED statements, emitted as hand-built STRINGS, whose comments are
 *     only printed if that wrap explicitly renders them; and
 *   - fallthrough statements, emitted via a per-statement `genCode`, each
 *     carrying its OWN @babel/generator comment-dedup set.
 * So a shared comment is printed twice (both neighbours render it) or zero
 * times (neither does) depending purely on which pass claims each neighbour —
 * and BOTH failures are live in the corpus today.
 *
 * The fix is a block-wide printed-comment ledger threaded through the whole
 * loop, mirroring the single-dedup-set precedent `genBlockInner` and
 * `genImportsBlock` already set for their own scopes. These tests pin the
 * invariant that ledger exists to hold: EVERY author comment in the component
 * scope is emitted EXACTLY ONCE, whichever pass claims its neighbours.
 *
 * House style follows `transitiveEscapeConstStability.test.ts`: import
 * `emitScript` directly (`@rozie/core` inlines each target emitter at ITS own
 * build time, so a `compile()`-based fixture stays stale until core rebuilds),
 * and assert on OCCURRENCE COUNTS of a distinctive marker rather than on the
 * whole emitted section (`feedback_snapshot_tests_cement_bugs`).
 */

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitScript } from '../emit/emitScript.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';

function lower(src: string): IRComponent {
  const result = parse(src, { filename: 'inline.rozie' });
  if (!result.ast) {
    throw new Error(`parse failed: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

function emit(src: string): string {
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  return emitScript(lower(src), collectors).userArrowsSection;
}

/** How many times `marker` appears in `section`. */
function occurrences(section: string, marker: string): number {
  return section.split(marker).length - 1;
}

// ---------------------------------------------------------------------------
// RED 1 — LOSS. `comp` is transitively escaping (reached from $onMount only
// through `helper`) so it is claimed by `tryWrapEscapingConstUseMemo`, which
// renders LEADING comments only. `helper` is directly escaping so it is
// claimed by `tryWrapEscapingHelperUseCallback`, which renders NO comments at
// all. `doc-for-HELPER` is `comp`'s trailing AND `helper`'s leading — neither
// pass prints it, so it vanishes. This is TipTap's `buildStarterKitConfig`
// and Toaster's `removeToast` shape exactly.
// ---------------------------------------------------------------------------
const RED_1_SRC = `<rozie name="CmtRed1">
<script>
import { Compartment } from './fake-cm6'
// doc-for-COMP
const comp = new Compartment()
// doc-for-HELPER
const helper = () => comp.of([])
$onMount(() => { helper() })
</script>
<template><div></div></template>
</rozie>`;

// ---------------------------------------------------------------------------
// RED 2 — DOUBLE. `P` is a pure object literal claimed by
// `tryWrapPureLiteralUseMemo`, which renders BOTH leading and trailing.
// `Q` is claimed by nothing and falls through to `genCode`, whose own
// generator pass prints `doc-for-Q` as Q's leading comment. `doc-for-Q` is
// shared between them, so it prints twice. This is MapLibre's
// DEFAULT_STYLE/PROGRAMMATIC shape.
// ---------------------------------------------------------------------------
const RED_2_SRC = `<rozie name="CmtRed2">
<script>
// doc-for-P
const P = { a: 1 }
// doc-for-Q
const Q = Math.max(1, 2)
</script>
<template><div>{{ P.a }}{{ Q }}</div></template>
</rozie>`;

// ---------------------------------------------------------------------------
// CONTROL A — a comment on a wrapped const with NO commented neighbour must
// stay exactly once (the narrow leading-render path must not regress).
// ---------------------------------------------------------------------------
const CONTROL_A_SRC = `<rozie name="CmtCtlA">
<script>
import { Compartment } from './fake-cm6'
// doc-solo
const solo = new Compartment()
function useSolo() { return solo.of([]) }
$onMount(() => { useSolo() })
</script>
<template><div></div></template>
</rozie>`;

// ---------------------------------------------------------------------------
// CONTROL B — a TRAILING-ONLY comment with no statement after it to claim it
// as leading. Only the trailing render can save it; it must appear once.
// ---------------------------------------------------------------------------
const CONTROL_B_SRC = `<rozie name="CmtCtlB">
<script>
const tail = { a: 1 }
// doc-dangling
</script>
<template><div>{{ tail.a }}</div></template>
</rozie>`;

describe('component-scope comment ledger (quick 260829-j18 Task 6 follow-up)', () => {
  it('RED 1: a comment between a memo-wrapped const and a useCallback-wrapped helper survives exactly once', () => {
    const section = emit(RED_1_SRC);
    expect(occurrences(section, 'doc-for-COMP')).toBe(1);
    expect(occurrences(section, 'doc-for-HELPER')).toBe(1);
  });

  it('RED 2: a comment shared between a memo-wrapped literal and a fallthrough statement prints exactly once', () => {
    const section = emit(RED_2_SRC);
    expect(occurrences(section, 'doc-for-P')).toBe(1);
    expect(occurrences(section, 'doc-for-Q')).toBe(1);
  });

  it('CONTROL A: a lone leading comment on a wrapped const still prints exactly once', () => {
    expect(occurrences(emit(CONTROL_A_SRC), 'doc-solo')).toBe(1);
  });

  it('CONTROL B: a trailing-only comment with no following statement still prints exactly once', () => {
    expect(occurrences(emit(CONTROL_B_SRC), 'doc-dangling')).toBe(1);
  });
});
