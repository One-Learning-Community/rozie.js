/**
 * pureLiteralConstStability.test.ts — Quick 260828-uyn.
 *
 * React places every top-level `<script>` const inside the component
 * function body, so an object/array literal is rebuilt with a fresh
 * reference on every render. The other five targets construct it exactly
 * once per instance. This fixture pins the THIRD sibling `useMemo(…, [])`
 * stabilization pass (`tryWrapPureLiteralUseMemo`), alongside the two that
 * already exist (`tryWrapMutatedInstanceUseMemo`,
 * `tryWrapEscapingConstUseMemo`).
 *
 * Two gates decide stabilization:
 *   Gate 1 — `computeHelperBodyDeps(init, ir, allHelperNames, name)` returns
 *            an EMPTY SignalRef[] (no reactive read).
 *   Gate 2 — every free top-level identifier the literal cites resolves to
 *            an allowed-stable class: a module-scope import, a
 *            `hoistModuleLet`-hoisted `useRef` name, an `ir.refs` name, or an
 *            EARLIER literal already admitted by this same pre-scan. Anything
 *            else top-level-bound (a helper, a non-hoisted `let`, a
 *            non-literal const) is a BAIL — this is the ordering hazard:
 *            `allHelperNames` only tracks arrow/function-expression consts
 *            and `function` declarations, so Gate 1 alone returns EMPTY for
 *            `const b = { inner: a }` citing another plain object const `a`.
 *
 * Per `feedback_snapshot_tests_cement_bugs`: assertions match each binder by
 * name and inspect only ITS declaration line, rather than pinning the whole
 * emitted output as a snapshot.
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
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

function emit(src: string): {
  userArrowsSection: string;
  hasUseMemoImport: boolean;
} {
  const ir = lower(src);
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  const { userArrowsSection } = emitScript(ir, collectors);
  return { userArrowsSection, hasUseMemoImport: collectors.react.has('useMemo') };
}

/** The FIRST LINE of a top-level `const NAME` declaration in `section`. */
function declarationLine(section: string, name: string): string {
  const re = new RegExp(`^const ${name}(?:[:\\s].*|)$`, 'm');
  const m = section.match(re);
  if (!m) {
    throw new Error(`No top-level declaration found for '${name}' in:\n${section}`);
  }
  return m[0];
}

const LITERAL_PROBE_SRC = `<rozie name="LiteralProbe">
<props>
{
  label: { type: String, default: 'hi' },
}
</props>
<data>
{
  tick: 0,
}
</data>
<script>
import { helperImport } from './fake-mod'
let scratch = 0
const PURE_OBJ = { a: 1, b: { c: 2 } }
const PURE_ARR = [1, 2, 3]
const WITH_FN = { id: 'p', beforeDraw(ctx) { ctx.save() } }
const CHAINED = [WITH_FN]
const FROM_IMPORT = { ext: helperImport() }
const READS_DATA = { tick: $data.tick }
const READS_PROP = { label: $props.label }
const arrowHelper = () => 1
const CITES_HELPER = { f: arrowHelper }
const CITES_PLAIN_LET = { v: scratch }
const SCALAR = 42
const onBump = () => { $data.tick = $data.tick + 1 }
</script>
<template>
<div @click="onBump">{{ $data.tick }}</div>
</template>
</rozie>`;

describe('React pure-literal const stabilization (260828-uyn tryWrapPureLiteralUseMemo)', () => {
  it('stabilizes pure object/array literals with useMemo(..., [])', () => {
    const { userArrowsSection } = emit(LITERAL_PROBE_SRC);

    for (const name of ['PURE_OBJ', 'PURE_ARR', 'WITH_FN', 'CHAINED', 'FROM_IMPORT']) {
      const line = declarationLine(userArrowsSection, name);
      expect(line, `expected ${name} to be stabilized, got: ${line}`).toContain('useMemo(');
    }
  });

  it('does NOT stabilize literals with a reactive read, a helper reference, or a plain-let reference (bail classes)', () => {
    const { userArrowsSection } = emit(LITERAL_PROBE_SRC);

    for (const name of [
      'READS_DATA',
      'READS_PROP',
      'CITES_HELPER',
      'CITES_PLAIN_LET',
      'SCALAR',
    ]) {
      const line = declarationLine(userArrowsSection, name);
      expect(line, `expected ${name} to stay unstabilized, got: ${line}`).not.toContain(
        'useMemo(',
      );
    }
  });

  it('leaves function-shaped binders (arrow helper, event handler) untouched by this pass', () => {
    const { userArrowsSection } = emit(LITERAL_PROBE_SRC);

    // arrowHelper hoists to a function declaration (Plan 04-04); onBump is a
    // listener handler consumed elsewhere. Neither is object/array-literal
    // shaped, so this pass must never touch them.
    expect(userArrowsSection).not.toMatch(/arrowHelper\s*=\s*useMemo/);
    expect(userArrowsSection).not.toMatch(/onBump\s*=\s*useMemo/);
  });

  it('emits a `useMemo` react import when at least one literal is stabilized', () => {
    const { hasUseMemoImport } = emit(LITERAL_PROBE_SRC);
    expect(hasUseMemoImport).toBe(true);
  });
});

describe('React pure-literal const stabilization — no-op on a script with no candidate literals', () => {
  const NO_LITERAL_SRC = `<rozie name="NoLiteralProbe">
<script>
const arrowHelper = () => 1
const SCALAR = 42
</script>
<template><div>{{ 1 }}</div></template>
</rozie>`;

  it('does not introduce any memo wrap or gain the useMemo import on account of this pass', () => {
    const { userArrowsSection, hasUseMemoImport } = emit(NO_LITERAL_SRC);
    expect(userArrowsSection).not.toContain('useMemo');
    expect(hasUseMemoImport).toBe(false);
  });
});
