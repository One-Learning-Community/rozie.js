/**
 * Quick 260804-f15 RED (Solid) — the `r-bind` DYNAMIC path key-remaps COMPONENT
 * props at RUNTIME.
 *
 * `emitSpread`'s dynamic branch (`emitTemplateAttribute.ts:1026-1028`) emits
 * `{...normalizeAttrs(<expr>)}` with NO reference to `ctx.elementTagKind` — the
 * gate quick 260804-4cy added at `:1019` covers only the LITERAL branch. The
 * runtime helper (`runtime/solid/src/normalizeAttrs.ts:87-100`) then applies
 * `SOLID_ATTR_KEY_MAP` unconditionally, so
 * `<Child r-bind="someObj" />` carrying `readonly`/`tabindex`/`for` renames
 * those keys against a child whose `splitProps` key list is built from its
 * `ir.props` — the props silently never arrive.
 *
 * THIS IS THE FOURTH AND FINAL MEMBER of the component-tag rename class:
 *   260711-i5m — react `:attr`
 *   260803-swj — solid `:attr` (`htmlAttrToSolidName`)
 *   260804-4cy — react + solid `r-bind` LITERAL
 *   260804-f15 — react + solid `r-bind` DYNAMIC (this)
 *
 * WHY AN EMITTER-ONLY GATE WAS IMPOSSIBLE: emitting a bare `{...obj}` on a
 * component tag would LOSE the runtime `FORBIDDEN_KEYS` strip
 * (`normalizeAttrs.ts:95`) — a prototype-pollution regression (T-14-05) traded
 * for a naming fix. The gate therefore selects a SIBLING runtime export,
 * `normalizeComponentAttrs`, which strips identically (shared const) but
 * applies no alias table.
 *
 * PARITY, not invention — measured with a six-target probe over one source
 * (`<Child r-bind="someObj" />` + `<input r-bind="someObj" />`) at quick
 * 260804-f15 T0-c. None of the other four targets aliases a dynamic spread's
 * keys on either tag kind:
 *   Vue      `v-bind="someObj"`                       (both tags, verbatim)
 *   Svelte   `{...someObj}`                           (both tags, verbatim)
 *   Angular  `__rozieApplyAttrs(el, this.someObj())`  (both tags, unremapped)
 *   Lit      `${rozieSpread(this._someObj.value)}`    (setAttribute, no aliasing)
 *   React    `{...normalizeAttrs(someObj)}`  <-- remaps on BOTH tag kinds
 *   Solid    `{...normalizeAttrs(someObj)}`  <-- remaps on BOTH tag kinds
 *
 * Harness copied verbatim from `rbindComponentKeyMap.test.ts:40-85` (4cy).
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../../emitSolid.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitSolid(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

/**
 * Extract the JSX returned by the emitted component — paren-balanced text
 * between `return (` and the matching `);`.
 */
function extractJsx(emitted: string): string {
  const start = emitted.search(/return\s*\(/);
  if (start < 0) return emitted;
  const openIdx = emitted.indexOf('(', start);
  let depth = 1;
  let i = openIdx + 1;
  while (i < emitted.length && depth > 0) {
    const ch = emitted[i]!;
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth === 0) break;
    i++;
  }
  return emitted.slice(openIdx + 1, i).trim();
}

/**
 * Slice a single JSX open tag out of the extracted JSX so a NATIVE-tag hit can
 * never satisfy a COMPONENT-tag assertion (and vice versa).
 */
function tagSlice(jsx: string, open: string): string {
  const start = jsx.indexOf(open);
  if (start < 0) throw new Error(`tag ${open} not found in emitted JSX:\n${jsx}`);
  const end = jsx.indexOf('>', start);
  if (end < 0) throw new Error(`unterminated tag ${open} in emitted JSX:\n${jsx}`);
  return jsx.slice(start, end + 1);
}

describe('emitTemplateAttribute (Solid) — r-bind DYNAMIC spreads must bypass the runtime attr remap on component tags (Quick 260804-f15)', () => {
  const PROLOGUE = '<rozie name="Test" inherit-attrs="false">';

  /**
   * ONE source exercising BOTH sides of the gate in a single template, so the
   * fixture proves the fix is a GATE and not a global swap of the helper.
   *
   * Each assertion group lives in its OWN `it()` deliberately: vitest fails
   * fast at the first failing assertion, so a single combined test would leave
   * the GREEN GUARDs unevaluated during the red phase and we could not show
   * they were green BEFORE the fix.
   */
  const TWO_TAG_SRC = `${PROLOGUE}
<components>{ Child: "./Child.rozie" }</components>
<data>{ someObj: { readonly: true, tabindex: 0 } }</data>
<template>
  <div>
    <Child r-bind="someObj" />
    <input r-bind="someObj" />
  </div>
</template>
</rozie>`;

  it('RED-1 — a DYNAMIC r-bind on a COMPONENT tag routes through the component helper', () => {
    const jsx = extractJsx(compile(TWO_TAG_SRC));
    const child = tagSlice(jsx, '<Child');

    // The child's `splitProps` key list comes from its `ir.props`, so any
    // rename applied here is a silent prop loss.
    expect(child).toContain('normalizeComponentAttrs(someObj)');
    // `normalizeComponentAttrs(` does not contain the substring
    // `normalizeAttrs(`, so this is a real exclusion, not a tautology.
    expect(child).not.toContain('normalizeAttrs(');

    expect(jsx).toMatchSnapshot();
  });

  it('GREEN GUARD-1 — the NATIVE path is byte-identical', () => {
    const input = tagSlice(extractJsx(compile(TWO_TAG_SRC)), '<input');

    // The gate is a helper-name selection on tag kind and touches neither the
    // rendered expression nor the html branch, so a real DOM element keeps the
    // runtime alias table it has always had. Green BEFORE and AFTER the fix —
    // this inline snapshot was written during the RED run and must not move.
    expect(input).toMatchInlineSnapshot(
      `"<input {...normalizeAttrs(someObj)} data-rozie-s-8fd6d49e="" />"`,
    );
  });

  it('RED-2 — the runtime import line carries BOTH helpers for this source', () => {
    // NOTE this is a RED assertion, not a green guard: it asserts the FIX's
    // effect (the new helper reaching the import line), so it is necessarily
    // red before the emitter gate lands and green after.
    //
    // Asserted on the FULL emitted module, not the JSX slice: the component tag
    // needs the new helper and the native sibling still needs the old one, so
    // an element mixing both tag kinds must import both. A component that has
    // no dynamic component-tag spread keeps a byte-identical import line.
    const emitted = compile(TWO_TAG_SRC);
    const importLine = emitted.split('\n').find((l) => l.includes("from '@rozie/runtime-solid'"));
    expect(importLine).toBeDefined();
    expect(importLine).toContain('normalizeAttrs');
    expect(importLine).toContain('normalizeComponentAttrs');
  });

  it('GREEN GUARD-3 (D-04) — `$attrs` on a component tag stays an UNWRAPPED spread', () => {
    // `isAttrsIdentifier` early-returns at `emitTemplateAttribute.ts:1012`,
    // BEFORE the literal check and long before the dynamic branch, so
    // `r-bind="$attrs"` never reaches the code this task edits on ANY tag kind.
    // 10 of the 12 `r-bind` hits in the 603-file `.rozie` corpus are `$attrs`,
    // so this exemption carries essentially all real-world traffic and is
    // asserted by fixture rather than by inspection. Green BEFORE and AFTER.
    const src = `<rozie name="Test">
<components>{ Child: "./Child.rozie" }</components>
<template>
  <div>
    <Child r-bind="$attrs" />
  </div>
</template>
</rozie>`;
    const child = tagSlice(extractJsx(compile(src)), '<Child');

    expect(child).toContain('{...attrs}');
    expect(child).not.toContain('normalizeAttrs(');
    expect(child).not.toContain('normalizeComponentAttrs(');
  });
});
