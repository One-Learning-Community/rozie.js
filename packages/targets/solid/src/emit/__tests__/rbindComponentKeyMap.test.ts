/**
 * Quick 260804-4cy RED (Solid) — the `r-bind` LITERAL key remap renames
 * COMPONENT props.
 *
 * `remapObjectKeysSolid` (`emitTemplateAttribute.ts:382-407`) takes NO
 * `elementTagKind` parameter and applies `RBIND_HTML_TO_SOLID_ATTR`
 * (`:346-374`, 24 entries) to every static key on every tag kind. Its two call
 * sites are `emitSpread` (`:981`) and `extractLiteralClassStyle` (`:1063`),
 * both of which already have `ctx` — and `EmitAttrCtx.elementTagKind` (`:64`)
 * is already populated at both `emitAttributes` call sites
 * (`emitTemplateNode.ts:967, 1020`) and already consumed by the sibling `:attr`
 * gate `htmlAttrToSolidName` (`:269-276`, quick 260803-swj) and by
 * `shouldWrapAttrBinding` (`:101`).
 *
 * So `<Child r-bind="{ readonly: true, tabindex: 0 }" />` emits
 * `{...{ readOnly: true, tabIndex: 0 }}` against a child whose `splitProps` key
 * list is built from its `ir.props` (`readonly`, `tabindex`) — the props
 * silently never arrive.
 *
 * The remap table is INTENTIONALLY distinct from `HTML_TO_SOLID_ATTR`
 * (documented `:332-345`): `for → htmlFor` on the r-bind path only. The gate is
 * an early return on tag kind and touches no table entry, so the NATIVE path
 * stays byte-identical — asserted here by a sibling `<input>` in the same
 * template.
 *
 * THIS IS THE THIRD AND FINAL MEMBER of the component-tag rename class:
 *   260711-i5m — react `:attr` (`react/…/emitTemplateAttribute.ts:349-353`)
 *   260803-swj — solid `:attr` (`:269-276`)
 *   260804-4cy — react + solid `r-bind` literal (this)
 *
 * PARITY, not invention: the other four targets already emit these keys
 * VERBATIM on a component tag. Vue and Svelte explicitly document "no key
 * remap is applied here (D-03 is React/Solid-only)" at `vue:420-421` /
 * `svelte:427-428`; Angular hands the literal to `__rozieApplyAttrs` unremapped
 * (`angular:689-729`); Lit defers the forbidden-key strip to the `rozieSpread`
 * runtime directive.
 *
 * Harness copied verbatim from `componentPropNameMap.test.ts:28-73`.
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

describe('emitTemplateAttribute (Solid) — r-bind LITERAL keys must bypass the DOM attr map on component tags (Quick 260804-4cy)', () => {
  const PROLOGUE = '<rozie name="Test" inherit-attrs="false">';

  /**
   * ONE source exercising BOTH sides of the gate in a single template, so the
   * fixture proves the fix is a GATE and not a global disable of the table.
   *
   * Each assertion group lives in its OWN `it()` deliberately: vitest fails
   * fast at the first failing assertion, so a single combined test would leave
   * the GREEN GUARDs unevaluated during the red phase and we could not show
   * they were green BEFORE the fix (quick 260804-4cy red-phase evidence).
   */
  const TWO_TAG_SRC = `${PROLOGUE}
<components>{ Child: "./Child.rozie" }</components>
<template>
  <div>
    <Child r-bind="{ readonly: true, tabindex: 0, for: 'x', constructor: bad, id: 'k' }" />
    <input r-bind="{ readonly: true, tabindex: 0, for: 'x', constructor: bad, id: 'k' }" />
  </div>
</template>
</rozie>`;

  it('RED-1 — r-bind literal keys pass through VERBATIM on a COMPONENT tag', () => {
    const jsx = extractJsx(compile(TWO_TAG_SRC));
    const child = tagSlice(jsx, '<Child');

    // COMPONENT tag: every literal key must reach the child verbatim. The
    // child's splitProps key list comes from its `ir.props`, so a renamed key
    // is a silent prop loss.
    expect(child).toContain('readonly:');
    expect(child).toContain('tabindex:');
    expect(child).toContain('for:');
    expect(child).not.toContain('readOnly:');
    expect(child).not.toContain('tabIndex:');
    expect(child).not.toContain('htmlFor:');

    expect(jsx).toMatchSnapshot();
  });

  it('GREEN GUARD-1 (D-05) — a NATIVE tag keeps every rename, including the r-bind-only for → htmlFor divergence', () => {
    const input = tagSlice(extractJsx(compile(TWO_TAG_SRC)), '<input');

    // The gate is an early return on tag kind and touches no table entry, so
    // the native path is byte-identical by construction — including the
    // documented `for → htmlFor` r-bind divergence
    // (`RBIND_HTML_TO_SOLID_ATTR:347`, deliberately unlike
    // `HTML_TO_SOLID_ATTR.for`). Green BEFORE and AFTER the fix.
    expect(input).toContain('readOnly:');
    expect(input).toContain('tabIndex:');
    expect(input).toContain('htmlFor:');
    expect(input).not.toContain('readonly:');
    expect(input).not.toContain('tabindex:');
  });

  it('GREEN GUARD-2 (D-04) — T-14-06 forbidden-key stripping survives on the COMPONENT path', () => {
    const jsx = extractJsx(compile(TWO_TAG_SRC));
    const child = tagSlice(jsx, '<Child');
    const input = tagSlice(jsx, '<input');

    // The `FORBIDDEN_SPREAD_KEYS` `continue` (`:391-393`) runs ABOVE the gate,
    // so the strip is tag-kind-independent and survives for free. This is a
    // SECURITY guard, not a naming concern — it fires loudly if a future
    // refactor ever moves the gate above the strip. Green BEFORE and AFTER.
    expect(child).not.toContain('constructor');
    expect(input).not.toContain('constructor');
    expect(child).toContain("id: 'k'");
    expect(input).toContain("id: 'k'");
  });

  it('GREEN GUARD-3 (D-03) — the component-tag class merge is byte-identical; class/style splitting is untouched', () => {
    const src = `${PROLOGUE}
<components>{ Child2: "./Child2.rozie" }</components>
<template>
  <div>
    <Child2 :class="'x'" r-bind="{ class: 'c', id: 'k' }" />
  </div>
</template>
</rozie>`;
    const jsx = extractJsx(compile(src));
    const child2 = tagSlice(jsx, '<Child2');

    // `class` is deliberately ABSENT from `RBIND_HTML_TO_SOLID_ATTR`
    // (documented `:343-345`) and `style` is absent too, so
    // `splitClassStyleFromLiteral` (`:409-437`, keyed on `class` at `:424`) is
    // provably unaffected by the tag-kind gate. This assertion is the tripwire
    // that fires if anyone ever adds `class` to the r-bind table.
    expect(child2).toContain('class={');
    expect(child2).toContain("{...{ id: 'k' }}");
    expect(child2).not.toContain('className');

    expect(jsx).toMatchSnapshot();
  });
});
