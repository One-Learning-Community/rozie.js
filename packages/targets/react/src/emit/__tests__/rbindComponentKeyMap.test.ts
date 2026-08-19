/**
 * Quick 260804-4cy RED (React) — the `r-bind` LITERAL key remap renames
 * COMPONENT props.
 *
 * `remapObjectKeysReact` (`emitTemplateAttribute.ts:507-532`) calls
 * `htmlAttrToJsxName(keyName)` at `:522` with the SECOND ARGUMENT OMITTED.
 * `htmlAttrToJsxName(name, elementTagKind?)` (`:349-353`) — the gate quick
 * 260711-i5m added for the `:attr` path — early-returns `name` only when
 * `elementTagKind === 'component' || 'self'`, so omitting the argument takes
 * the `undefined` → `'html'` default and `HTML_TO_JSX_ATTR` (`:99-145`,
 * 45 entries) ALWAYS applies. The gate exists but is never reached.
 *
 * So `<Child r-bind="{ readonly: true, tabindex: 0 }" />` emits
 * `{...{ readOnly: true, tabIndex: 0 }}` against a child that declared
 * `readonly`/`tabindex` — a silent prop loss. A Rozie-compiled React child's
 * fallthrough bucket is `const attrs = (…rest of _props)` and its props
 * interface declares the RAW names (`packages/ui/switch/packages/react/src/Switch.tsx:47,97`,
 * `Switch.d.ts:21`), so the camel-aliased key never arrives.
 *
 * THIRD and final member of the component-tag rename class:
 *   260711-i5m — react `:attr` (`:349-353`)
 *   260803-swj — solid `:attr` (`solid/…:269-276`)
 *   260804-4cy — react + solid `r-bind` literal (this)
 *
 * PARITY, not invention: Vue, Svelte, Angular and Lit already emit these keys
 * VERBATIM on a component tag (`vue:420-421` / `svelte:427-428` explicitly
 * document "no key remap is applied here (D-03 is React/Solid-only)").
 *
 * D-02 — `class` is the ONE key EXEMPT from the gate on React, and the
 * exemption is asserted here so nobody "simplifies" it away:
 *   - `className` is ALREADY what a `:class` on a React component tag emits
 *     (the `class` bucket at `:1555` bypasses `colonPropToJsxName` entirely, so
 *     260711-i5m's gate never touched it). `class` is React's universal
 *     class-prop name, not an HTML-attribute alias.
 *   - The shipped R6 literal class-merge on component tags DEPENDS on the
 *     rename happening BEFORE `splitClassStyleFromLiteral` (`:541-564`) looks
 *     for `className` (`:552`). Gating `class` would silently kill it.
 *   - A Rozie React child reads `attrs.className`; a raw `class` key would be
 *     dropped, and spreading it onto a DOM node makes React warn
 *     `Invalid DOM property 'class'`.
 *
 * Harness copied verbatim from
 * `solid/src/emit/__tests__/componentPropNameMap.test.ts:28-73`.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../../emitReact.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitReact(ir, { filename: 'Test.rozie', source: rozieSrc });
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

describe('emitTemplateAttribute (React) — r-bind LITERAL keys must bypass the DOM attr map on component tags (Quick 260804-4cy)', () => {
  const PROLOGUE = '<rozie name="Test" inherit-attrs="false">';

  /**
   * ONE source exercising BOTH sides of the gate in a single template, so the
   * fixture proves the fix is a GATE and not a global disable of the table.
   *
   * Each assertion group lives in its OWN `it()` deliberately: vitest fails
   * fast at the first failing assertion, so a single combined test would leave
   * the GREEN GUARDs unevaluated during the red phase and we could not show
   * they were green BEFORE the fix.
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

    // COMPONENT tag: every literal key must reach the child verbatim. React
    // does not camelCase-alias arbitrary function-component props, and the
    // child's props interface declares the raw names.
    expect(child).toContain('readonly:');
    expect(child).toContain('tabindex:');
    expect(child).toContain('for:');
    expect(child).not.toContain('readOnly:');
    expect(child).not.toContain('tabIndex:');
    expect(child).not.toContain('htmlFor:');

    expect(jsx).toMatchSnapshot();
  });

  it('GREEN GUARD-1 — a NATIVE tag keeps every rename, including for → htmlFor', () => {
    const input = tagSlice(extractJsx(compile(TWO_TAG_SRC)), '<input');

    // The gate is an early return on tag kind and touches no table entry, so
    // all 45 `HTML_TO_JSX_ATTR` renames survive on the native path.
    // Green BEFORE and AFTER the fix.
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

    // The `FORBIDDEN_SPREAD_KEYS` `continue` (`:517-520`) runs ABOVE the remap,
    // so the strip is tag-kind-independent and survives for free. SECURITY
    // guard, not a naming concern — fires loudly if a future refactor ever
    // moves the gate above the strip. Green BEFORE and AFTER.
    expect(child).not.toContain('constructor');
    expect(input).not.toContain('constructor');
    expect(child).toContain("id: 'k'");
    expect(input).toContain("id: 'k'");
  });

  const CLASS_EXEMPT_SRC = `${PROLOGUE}
<components>{ Child2: "./Child2.rozie" }</components>
<template>
  <div>
    <Child2 r-bind="{ class: 'c', readonly: true }" />
  </div>
</template>
</rozie>`;

  it('RED-2 — a non-class key on a COMPONENT tag passes through verbatim alongside the exempt class key', () => {
    const jsx = extractJsx(compile(CLASS_EXEMPT_SRC));
    const child2 = tagSlice(jsx, '<Child2');

    expect(child2).toContain('readonly:');
    expect(child2).not.toContain('readOnly:');

    expect(jsx).toMatchSnapshot();
  });

  it('GREEN GUARD-3 (D-02) — `class` is EXEMPT from the gate and still becomes `className` on a COMPONENT tag', () => {
    const child2 = tagSlice(extractJsx(compile(CLASS_EXEMPT_SRC)), '<Child2');

    // The one key the gate deliberately does NOT apply to. `className` is
    // React's universal class-prop name and is already what a `:class` on a
    // component tag emits. Green BEFORE and AFTER the fix — this is the
    // tripwire that fires if anyone drops the `class` exemption.
    expect(child2).toContain('className:');
    expect(child2).not.toContain('class:');
  });

  it('GREEN GUARD-4 (D-02) — the shipped R6 component-tag class merge is byte-identical', () => {
    const src = `${PROLOGUE}
<components>{ Child3: "./Child3.rozie" }</components>
<template>
  <div>
    <Child3 :class="'x'" r-bind="{ class: 'c', id: 'k' }" />
  </div>
</template>
</rozie>`;
    const jsx = extractJsx(compile(src));
    const child3 = tagSlice(jsx, '<Child3');

    // The R6 literal class-merge on component tags WORKS today and DEPENDS on
    // `class`→`className` happening before `splitClassStyleFromLiteral`
    // (`:541-564`) looks for `className` (`:552`). Gating `class` would
    // silently kill this merge. `splitClassStyleFromLiteral` is NOT touched by
    // this quick. Green BEFORE and AFTER.
    expect(child3).toContain("clsx('x', 'c')");
    expect(child3).toContain("{...{ id: 'k' }}");

    expect(jsx).toMatchSnapshot();
  });
});
