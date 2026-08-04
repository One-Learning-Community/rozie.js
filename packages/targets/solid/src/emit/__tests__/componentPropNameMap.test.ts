/**
 * Quick 260803-swj SEAM 1 RED — the Solid DOM-attribute alias map renames
 * COMPONENT props.
 *
 * `colonPropToSolidName` (`emitTemplateAttribute.ts:418-425`) unconditionally
 * ends in `htmlAttrToSolidName(out)`, and the static-attribute path calls
 * `htmlAttrToSolidName(attr.name)` directly (`:769`). Neither consults
 * `ctx.elementTagKind` — even though `EmitAttrCtx.elementTagKind` (`:64`) is
 * already populated from `node.tagKind` at both `emitAttributes` call sites
 * (`emitTemplateNode.ts:967, 1020`) and is already consumed by
 * `shouldWrapAttrBinding` (`:101`).
 *
 * `HTML_TO_SOLID_ATTR` (`:140-187`) maps 37 entries including
 * `readonly → readOnly`, `tabindex → tabIndex` and
 * `contenteditable → contentEditable`. So `<Child :readonly="x" />` emits
 * `readOnly={x}` against a child whose `splitProps` key list is built from
 * `ir.props` (`readonly`) — the prop silently never arrives.
 *
 * THE FIX ALREADY EXISTS ON REACT, VERBATIM:
 * `react/src/emit/emitTemplateAttribute.ts:349-353` —
 * `htmlAttrToJsxName(name, elementTagKind)` returns `name` unchanged when
 * `elementTagKind === 'component' || 'self'`, with a header comment recording
 * the identical bug being found on React via a failing VR test (quick
 * 260711-i5m, editor-owns-focus contract). Solid never got the port.
 *
 * Harness copied verbatim from `attrNameMap.test.ts:14-47`.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
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
 * between `return (` and the matching `);` (copied from attrNameMap.test.ts).
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

describe('emitTemplateAttribute (Solid) — component props must bypass the DOM attr map (Quick 260803-swj seam 1)', () => {
  const PROLOGUE = '<rozie name="Test" inherit-attrs="false">';

  it('a mapped attribute name is renamed on a NATIVE tag but passes through VERBATIM on a COMPONENT tag', () => {
    const src = `${PROLOGUE}
<components>{ Child: "./Child.rozie" }</components>
<props>{ ro: { type: Boolean, default: false }, ti: { type: Number, default: 0 } }</props>
<template>
  <div>
    <Child :readonly="$props.ro" :tabindex="$props.ti" contenteditable="true" />
    <input :readonly="$props.ro" :tabindex="$props.ti" contenteditable="true" />
  </div>
</template>
</rozie>`;
    const jsx = extractJsx(compile(src));
    const child = tagSlice(jsx, '<Child');
    const input = tagSlice(jsx, '<input');

    // RED-1 — component, BINDING path (`emitTemplateAttribute.ts:795`).
    // The child's splitProps key list comes from its `ir.props` (`readonly`,
    // `tabindex`), so the camel-aliased names never arrive.
    expect(child).toContain('readonly={');
    expect(child).toContain('tabindex={');
    expect(child).not.toContain('readOnly={');
    expect(child).not.toContain('tabIndex={');

    // RED-2 — component, STATIC path (`emitTemplateAttribute.ts:769`).
    expect(child).toContain('contenteditable=');
    expect(child).not.toContain('contentEditable=');

    // GREEN GUARD-1 — the native `<input>` MUST keep every rename. This proves
    // the fix is a tagKind GATE and not a global disable of the alias table.
    expect(input).toContain('readOnly={');
    expect(input).toContain('tabIndex={');
    expect(input).toContain('contentEditable=');

    expect(jsx).toMatchSnapshot();
  });

  it('GREEN GUARD-2 (D-02) — kebab→camel still runs on a component tag', () => {
    const src = `${PROLOGUE}
<components>{ Child: "./Child.rozie" }</components>
<props>{ ro: { type: Boolean, default: false } }</props>
<template>
  <Child :my-prop="$props.ro" />
</template>
</rozie>`;
    const jsx = extractJsx(compile(src));
    const child = tagSlice(jsx, '<Child');
    // `:my-prop` → `myProp` is the D-141 component-prop convention and must
    // survive the gate — React does the same conversion BEFORE its own gate
    // (`react/…/emitTemplateAttribute.ts:373-378`).
    expect(child).toContain('myProp={');
    expect(child).not.toContain('my-prop');
    expect(jsx).toMatchSnapshot();
  });
});
