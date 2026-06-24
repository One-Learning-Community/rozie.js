// Phase 61 Plan 61-02 Task 1 — ROZ142 public-contract reserved-name collision
// validator (Half B, SC-3).
//
// A consumer-visible author name — a `<props>` key (plain or model), a slot
// name, an emit name, a `$expose` verb, or a `$provide`/`$inject` key — that
// equals a per-target RESERVED name CANNOT be auto-renamed (renaming would
// break the consumer API), so it must surface as ONE clear ROZ142 compile error
// at author time instead of a downstream TS2300/TS2416/TS1005 wall (gate 3/4) —
// or, worse, a SILENT runtime bug (Vue strips `key`/`ref`; React swallows
// `key`/`ref`/`children`; Svelte normalizes two emits to one `on<normalized>`
// callback prop). The SILENT tier is handled FIRST and as `severity: 'error'`.
//
// This is the RED-FIRST test: `runReservedNameCollisionValidator` does not yet
// exist (Task 2 implements it), so this file's import + the analyzeAST wiring
// fail until then. Each case pins the exact ROZ142 code, the severity, the loc,
// and the did-you-mean hint, plus a zero-false-positive guard on a benign name.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { compile } from '../../../compile.js';
import { RozieErrorCode } from '../../../diagnostics/codes.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';
import type { RozieAST } from '../../../ast/types.js';

function parseOrThrow(source: string, filename = 'reserved.rozie'): RozieAST {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return ast;
}

function analyzeSource(source: string, filename = 'reserved.rozie'): Diagnostic[] {
  return analyzeAST(parseOrThrow(source, filename)).diagnostics;
}

// Slot collisions are owned by validateSlotPropCollision (ROZ127), which runs in
// lowerToIR — NOT in analyzeAST. Slot-name cases must go through compile() to
// exercise the IR validator chokepoint.
function compileDiags(source: string, filename = 'reserved.rozie'): Diagnostic[] {
  return compile(source, { target: 'vue', filename }).diagnostics ?? [];
}

const roz142 = (diags: Diagnostic[]) =>
  diags.filter((d) => d.code === RozieErrorCode.PUBLIC_CONTRACT_NAME_COLLISION);
const roz981 = (diags: Diagnostic[]) =>
  diags.filter((d) => d.code === RozieErrorCode.RUNTIME_ONLY_NAME_COLLISION);

function propsComponent(propsBody: string): string {
  return `<rozie name="X">
<props>{ ${propsBody} }</props>
<template><div></div></template>
</rozie>`;
}

describe('reservedNameCollisionValidator — ROZ142 public-contract collisions (Phase 61 SC-3)', () => {
  // ── SILENT tier — Vue strips key/ref/is; React swallows key/ref/children ──

  it('fires ERROR on a <props> key `key` (Vue+React SILENT strip/swallow)', () => {
    const hits = roz142(analyzeSource(propsComponent('key: { type: String }')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.code).toBe('ROZ142');
    expect(hits[0]!.message).toContain('key');
    // Did-you-mean suggestion present.
    expect(hits[0]!.hint, JSON.stringify(hits[0])).toBeTruthy();
    expect(hits[0]!.loc.start).toBeGreaterThan(0);
  });

  it('fires ERROR on a <props> key `ref` (Vue reserved + React swallow)', () => {
    const hits = roz142(analyzeSource(propsComponent('ref: { type: Object }')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain('ref');
  });

  it('fires ERROR on a <props> key `children` (React swallow)', () => {
    const hits = roz142(analyzeSource(propsComponent('children: { type: Array }')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain('children');
  });

  // ── Lit DOM-member prop (hard TS2416 at gate 3) — the inputMode→…Base history ──
  // NOTE: the WARNING tier is the corpus-ABSENT high-collision subset of the Lit
  // DOM chain (the shipping corpus byte-verifiably ships `id`/`title`/`draggable`
  // /`autofocus` cleanly ×6, so flagging THOSE is a false positive — zero-false-
  // positive must-have). `tabIndex` is a corpus-absent member that actually broke
  // in the otp/combobox findings (TS1238/TS2416 on the Lit leaf).

  it('fires (warning) on a <props> key `tabIndex` (Lit DOM member) with a `${name}Base` did-you-mean', () => {
    const hits = roz142(analyzeSource(propsComponent('tabIndex: { type: Number }')));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('tabIndex');
    // Class-target footgun → warning (not a universal break); ROZ137-style.
    expect(hits[0]!.severity).toBe('warning');
    // The historical fix renamed such props with a `Base` suffix (id → idBase).
    expect(hits[0]!.hint).toContain('tabIndexBase');
    expect(hits[0]!.hint).toContain('idBase');
  });

  it('does NOT fire on `id`/`title` — corpus byte-ships those cleanly ×6 (zero false positive)', () => {
    const hits = roz142(
      analyzeSource(propsComponent('id: { type: String }, title: { type: String }')),
    );
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  // ── Svelte emit-normalization collapse (runtime-only, ROZ981) ──

  it('fires on two emits `fooBar` + `foo-bar` that normalize to one callback prop (Svelte)', () => {
    const src = `<rozie name="X">
<script>
function a() { $emit('fooBar') }
function b() { $emit('foo-bar') }
</script>
<template><div @click="a"></div><div @click="b"></div></template>
</rozie>`;
    const diags = analyzeSource(src);
    // The emit-normalization collapse is a runtime-only collision (no typecheck
    // net) → ROZ981 error. (Either ROZ981 or ROZ142 is acceptable as the home;
    // assert at least one error fires for the collapse.)
    const hits = [...roz142(diags), ...roz981(diags)];
    expect(hits.length, JSON.stringify(diags)).toBeGreaterThanOrEqual(1);
    expect(hits.some((h) => h.severity === 'error')).toBe(true);
  });

  // ── Hyphenated slot key (Vue defineSlots TS1005 preempt) ──

  it('fires on a hyphenated slot name `header-item` (Vue defineSlots TS1005)', () => {
    const src = `<rozie name="X">
<template><div><slot name="header-item"></slot></div></template>
</rozie>`;
    const diags = compileDiags(src);
    // Owned by the IR slot validator (ROZ127) — slot-key-shape generalization.
    // Assert exactly one error fires (no double-fire between IR + semantic).
    const hits = [
      ...roz142(diags),
      ...diags.filter((d) => d.code === RozieErrorCode.SLOT_PROP_NAME_COLLISION),
    ];
    expect(hits.length, JSON.stringify(diags)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  // ── ZERO false positives on benign public-contract names ──

  it('does NOT fire on benign prop names `label` / `value`', () => {
    const hits = roz142(
      analyzeSource(propsComponent('label: { type: String }, value: { type: Number }')),
    );
    expect(hits.length, JSON.stringify(hits)).toBe(0);
  });

  it('does NOT fire on a benign slot name `header`', () => {
    const src = `<rozie name="X">
<template><div><slot name="header"></slot></div></template>
</rozie>`;
    const diags = compileDiags(src);
    expect(roz142(diags).length, JSON.stringify(diags)).toBe(0);
    expect(
      diags.filter((d) => d.code === RozieErrorCode.SLOT_PROP_NAME_COLLISION).length,
      JSON.stringify(diags),
    ).toBe(0);
  });

  it('does NOT fire on a benign single emit `change`', () => {
    const src = `<rozie name="X">
<script>function a() { $emit('change') }</script>
<template><div @click="a"></div></template>
</rozie>`;
    const diags = analyzeSource(src);
    expect(roz142(diags).length, JSON.stringify(diags)).toBe(0);
    expect(roz981(diags).length, JSON.stringify(diags)).toBe(0);
  });
});
