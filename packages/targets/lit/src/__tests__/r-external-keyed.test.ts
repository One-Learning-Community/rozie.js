/**
 * `r-external` engine-wrapper marker — Lit emit gates.
 *
 * The marker tells the Lit emitter that third-party code may mutate the
 * children of the marked element (engine-wrapper pattern: SortableJS,
 * TipTap, …). When the flag is set on a `TemplateElementIR`, the emitter:
 *   1. wraps the marked element's children in
 *      `${keyed(this._rozieReconcileSeq ?? 0, html\`…\`)}`
 *   2. emits `import { keyed } from 'lit/directives/keyed.js';`
 *   3. emits a `private _rozieReconcileSeq = 0;` class field
 *
 * The seq is bumped by the runtime helper
 * `__rozieReconcileAfterDomMutation` (called from the lowered
 * `$reconcileAfterDomMutation()` sigil). `keyed` then disposes stale
 * children DOM and rebuilds with a fresh sentinel structure while
 * preserving the marked element itself, so listeners attached to it by
 * third-party engines survive across reconciliations.
 *
 * The unmarked-path negative case asserts that a template WITHOUT
 * `r-external` produces byte-identical output to the pre-change emit (no
 * `keyed` import, no seq field, no `keyed(…)` wrap) so dist-parity
 * fixtures don't drift.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';

function compile(source: string): string {
  const { ast } = parse(source, { filename: 'R_EXTERNAL.rozie' });
  if (!ast) throw new Error('parse failed');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lower failed');
  const { code } = emitLit(ir, { filename: 'R_EXTERNAL.rozie', source });
  return code;
}

const SRC_MARKED = `<rozie name="Marked">
<props>
{ items: { type: Array, default: () => [] } }
</props>
<template>
<div class="host" r-external>
  <div r-for="item in $props.items" :key="item">{{ item }}</div>
</div>
</template>
</rozie>
`;

const SRC_UNMARKED = `<rozie name="Unmarked">
<props>
{ items: { type: Array, default: () => [] } }
</props>
<template>
<div class="host">
  <div r-for="item in $props.items" :key="item">{{ item }}</div>
</div>
</template>
</rozie>
`;

describe('r-external — Lit emit gates the keyed wrapper', () => {
  it('imports the `keyed` directive when the template uses `r-external`', () => {
    const code = compile(SRC_MARKED);
    expect(code).toContain(
      "import { keyed } from 'lit/directives/keyed.js';",
    );
  });

  it('declares the `_rozieReconcileSeq` counter when `r-external` is used', () => {
    const code = compile(SRC_MARKED);
    expect(code).toContain('private _rozieReconcileSeq = 0;');
  });

  it('wraps the marked element\'s children in `keyed(this._rozieReconcileSeq ?? 0, html`…`)`', () => {
    const code = compile(SRC_MARKED);
    // The wrap interpolates the seq counter and embeds an inner html
    // template around the marked element's children. The exact whitespace
    // inside the inner template is not asserted (it follows the element's
    // child layout); the directive prefix is the load-bearing invariant.
    expect(code).toMatch(/\$\{keyed\(this\._rozieReconcileSeq \?\? 0, html`/);
  });

  it('preserves the marked element itself outside the keyed wrap', () => {
    const code = compile(SRC_MARKED);
    // The outer `<div class="host" …>` lands BEFORE the `${keyed(…)}` so it
    // is part of the OUTER template instance (preserved across renders by
    // lit-html template-instance reuse). Any third-party listeners
    // attached to this element by the engine survive the reconcile.
    const keyedIdx = code.indexOf('${keyed(this._rozieReconcileSeq');
    const hostOpenIdx = code.indexOf('<div class="host"');
    expect(hostOpenIdx).toBeGreaterThanOrEqual(0);
    expect(keyedIdx).toBeGreaterThan(hostOpenIdx);
  });

  it('omits the keyed import + seq field + wrap when no element uses `r-external`', () => {
    const code = compile(SRC_UNMARKED);
    expect(code).not.toContain(
      "import { keyed } from 'lit/directives/keyed.js';",
    );
    expect(code).not.toContain('_rozieReconcileSeq');
    expect(code).not.toContain('keyed(');
  });
});
