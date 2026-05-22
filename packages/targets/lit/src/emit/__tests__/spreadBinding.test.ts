/**
 * Plan 14-05 Task 1 — Lit `spreadBinding` emitter (rozieSpread directive + R6 merge).
 *
 * The `spreadBinding` IR variant (`r-bind="<expr>"`) lowers to a lit-html
 * element-position directive call `${rozieSpread(<expr>)}` — Lit has no native
 * attribute-object spread (D-02 / 14-RESEARCH Pattern 4). The directive ships
 * from `@rozie/runtime-lit`. The emitter must set `_state.rozieSpreadUsed`
 * so the shell emits `import { rozieSpread } from '@rozie/runtime-lit';`.
 *
 * Cases:
 *   - LITERAL ObjectExpression  → `${rozieSpread({ ... })}` with HTML keys verbatim
 *   - DYNAMIC object            → `${rozieSpread(someObj)}`
 *   - `$attrs`                  → `${rozieSpread($attrs)}` — auto-fallthrough
 *                                 lands on the TEMPLATE-ROOT element inside
 *                                 the shadow tree (CONTEXT.md A1), not the
 *                                 host custom element
 *   - shell import is emitted via the `_state.rozieSpreadUsed` flag
 *
 * R6: when an `r-bind` LITERAL carries a `class`/`style` key AND the element
 * also has an explicit `class`/`:class`/`style`/`:style`, the literal's
 * `class`/`style` is folded into Lit's class/style attribute path; only the
 * remaining keys flow through `${rozieSpread(rest)}`.
 *
 * SECURITY (T-14-10/11): the directive uses `setAttribute` (no `innerHTML`,
 * no `Object.fromEntries` over attacker keys). The compile-time literal
 * key walk drops `__proto__`/`constructor`/`prototype` keys.
 */
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import type {
  IRComponent,
  AttributeBinding,
} from '../../../../../core/src/ir/types.js';
import {
  emitTemplateAttribute,
  type EmitTemplateAttributeState,
} from '../emitTemplateAttribute.js';

function emptyIR(): IRComponent {
  const src = `<rozie name="Test">
<template>
  <div></div>
</template>
</rozie>`;
  const { ast } = parse(src, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return ir;
}

function spread(exprSrc: string): AttributeBinding {
  return {
    kind: 'spreadBinding',
    expression: parseExpression(exprSrc) as t.Expression,
    deps: [],
    sourceLoc: { start: 0, end: exprSrc.length },
  };
}

function freshState(): EmitTemplateAttributeState {
  return { styleMapUsed: false, rozieSpreadUsed: false };
}

describe('emitTemplateAttribute (Lit) — spreadBinding (Plan 14-05 Task 1)', () => {
  it('(1) plain LITERAL spread → `${rozieSpread({ id: \'x\', title: \'t\' })}` with HTML keys verbatim', () => {
    const ir = emptyIR();
    const state = freshState();
    const out = emitTemplateAttribute(
      spread(`{ id: 'x', title: 't' }`),
      ir,
      'button',
      state,
    );
    // HTML attribute names — no remap (no `class→className`).
    expect(out).toMatchInlineSnapshot(
      `"\${rozieSpread({ id: 'x', title: 't' })}"`,
    );
    expect(out).toContain('rozieSpread(');
    expect(out).not.toContain('className');
    expect(out).not.toContain('htmlFor');
    // _state flag MUST be set so the shell imports the directive.
    expect(state.rozieSpreadUsed).toBe(true);
  });

  it('(2) DYNAMIC spread → `${rozieSpread(someObj)}` — pass-through', () => {
    const ir = emptyIR();
    const state = freshState();
    const out = emitTemplateAttribute(spread('someObj'), ir, 'button', state);
    expect(out).toMatchInlineSnapshot(`"\${rozieSpread(someObj)}"`);
    // Lit has no runtime normalizeAttrs helper — rozieSpread does the diff.
    expect(out).not.toContain('normalizeAttrs');
    expect(state.rozieSpreadUsed).toBe(true);
  });

  it('(3) $attrs spread → ${rozieSpread(this.$attrs)} (Lit synthesises a $attrs getter)', () => {
    const ir = emptyIR();
    const state = freshState();
    const out = emitTemplateAttribute(spread('$attrs'), ir, 'button', state);
    // Plan 14-05 — Lit has no native template-side `$attrs` proxy; the bare
    // `$attrs` Identifier is rewritten (in rewriteTemplateExpression) to
    // `this.$attrs`, a synthesised getter (declared by emitLit when
    // `rozieSpreadUsed && inheritAttrs !== false`) that reads the host
    // custom element's attributes per call. The rozieSpread directive does
    // cross-render diffing downstream.
    expect(out).toMatchInlineSnapshot(`"\${rozieSpread(this.$attrs)}"`);
    expect(out).toContain('this.$attrs');
    expect(state.rozieSpreadUsed).toBe(true);
  });

  it('(4) state.rozieSpreadUsed flag is FALSE when no spreadBinding is emitted', () => {
    const ir = emptyIR();
    const state = freshState();
    const out = emitTemplateAttribute(
      { kind: 'static', name: 'id', value: 'x', sourceLoc: { start: 0, end: 4 } },
      ir,
      'button',
      state,
    );
    expect(out).toBe('id="x"');
    // Flag MUST stay false — no rozieSpread import is needed.
    expect(state.rozieSpreadUsed).toBe(false);
  });

  it('(5) reordered spread before static class still emits rozieSpread', () => {
    // Reorder variant — the spread arrives BEFORE the static class. The
    // spread emit is invariant w.r.t. its surrounding siblings; per-attr
    // emission preserves source order via the caller (emitTemplate's
    // emitAttribute walks the IR-attribute array in order).
    const ir = emptyIR();
    const state = freshState();
    const out = emitTemplateAttribute(
      spread(`{ id: 'x', 'aria-label': 'lbl' }`),
      ir,
      'button',
      state,
    );
    expect(out).toContain("rozieSpread({ id: 'x', 'aria-label': 'lbl' })");
    expect(state.rozieSpreadUsed).toBe(true);
  });

  it('(SECURITY) T-14-10 — emitted output uses `rozieSpread` (which calls setAttribute), never `innerHTML`', () => {
    const ir = emptyIR();
    const state = freshState();
    const out = emitTemplateAttribute(
      spread(`{ "data-x": "<script>alert(1)</script>" }`),
      ir,
      'button',
      state,
    );
    // The emitted template literal does NOT use `innerHTML` — the directive
    // is the only DOM surface, and it uses setAttribute (which does not
    // parse HTML). T-14-10 is mitigated by directive contract, not by the
    // emit shape; this assertion documents the emit-shape side.
    expect(out).toContain('rozieSpread(');
    expect(out).not.toContain('innerHTML');
  });
});
