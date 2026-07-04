// Keyed-remount codegen, Task 1 — `lowerTemplate` component `:key` → the
// shared `TemplateElementIR.remountKeyExpression` marker.
//
// Root cause (docs/superpowers/plans/data-table-super-crosstarget-findings.md
// §3.1): today a `:key` on a composed child component lowers to a generic
// `key` AttributeBinding in `TemplateElementIR.attributes`, indistinguishable
// from a normal prop — React/Solid drop it, Svelte/Angular/Lit forward it
// inert. This test asserts the new additive-optional marker:
//   1. `<MyComp :key="foo" />` (component tag, no r-for) → `remountKeyExpression`
//      is set to the `foo` expression AND the raw `key` binding is left
//      IN PLACE in `.attributes` (fix1-t1: the extraction is a COPY, not a
//      move — see the comment above the extraction block in lowerTemplate.ts.
//      The raw binding must survive because the Vue emitter has no
//      `key`-drop filter for bare component tags and relies on it to emit a
//      real vnode-key remount; stripping it silently deleted that working
//      Vue idiom).
//   2. `<div r-for="x in xs" :key="x.id"></div>` — the LOOP key path
//      (`findKeyExpression` / `TemplateLoopIR.keyExpression`) is untouched:
//      still a `TemplateLoopIR` with `keyExpression` set; `remountKeyExpression`
//      must NOT be set on the inner element.
//   3. `<div :key="k"></div>` — a plain non-component element — must NOT set
//      `remountKeyExpression` (DOM-element key handling stays untouched).
//   4. `<MyComp r-for="x in xs" :key="x.id">` — a COMPONENT tag under r-for —
//      the loop-key path still owns `:key`; `remountKeyExpression` is NOT set
//      on the inner element AND (matching base/pre-Task-1 behavior, since
//      `keyConsumedByLoop` short-circuits the extraction entirely) the raw
//      `key` binding is left in the inner element's `.attributes` too — the
//      r-for path never strips it, before or after this fix.
//   5. A mustache-interpolated `:key="{{ foo }}"` lowers to an `interpolated`
//      AttributeBinding (kind !== 'binding'), which the extraction's
//      `a.kind === 'binding'` guard does not match — `remountKeyExpression`
//      is NOT set for that shape. Out of scope for Task 1; downstream
//      emitter tasks should not expect interpolated `:key` to ever populate
//      the marker.
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import type {
  TemplateNode as IRTemplateNode,
  TemplateElementIR,
  TemplateLoopIR,
  AttributeBinding,
} from '../ir/types.js';

function rozie(templateBody: string, opts?: { rozieAttrs?: string; name?: string }): string {
  const attrs = opts?.rozieAttrs ?? '';
  const name = opts?.name ?? 'RemountKeyLower';
  return `<rozie name="${name}"${attrs ? ' ' + attrs : ''}>
<template>
${templateBody}
</template>
</rozie>
`;
}

/** DFS for the first TemplateElementIR whose tagName matches. */
function findElementByTag(node: IRTemplateNode | null, tagName: string): TemplateElementIR {
  if (!node) throw new Error('IR template is null');
  const stack: IRTemplateNode[] = [node];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (cur.type === 'TemplateElement') {
      if (cur.tagName === tagName) return cur;
      stack.push(...cur.children);
    } else if (cur.type === 'TemplateFragment') {
      stack.push(...cur.children);
    } else if (cur.type === 'TemplateLoop') {
      stack.push(...cur.body);
    } else if (cur.type === 'TemplateConditional') {
      for (const b of cur.branches) stack.push(...b.body);
    }
  }
  throw new Error(`no IR TemplateElement with tagName '${tagName}' found`);
}

/** DFS for the first TemplateLoopIR. */
function findLoop(node: IRTemplateNode | null): TemplateLoopIR {
  if (!node) throw new Error('IR template is null');
  const stack: IRTemplateNode[] = [node];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (cur.type === 'TemplateLoop') return cur;
    if (cur.type === 'TemplateElement') stack.push(...cur.children);
    else if (cur.type === 'TemplateFragment') stack.push(...cur.children);
    else if (cur.type === 'TemplateConditional') {
      for (const b of cur.branches) stack.push(...b.body);
    }
  }
  throw new Error('no IR TemplateLoop found');
}

function lowerOk(source: string): IRTemplateNode {
  const { ast, diagnostics: parseDiags } = parse(source);
  expect(ast, JSON.stringify(parseDiags)).not.toBeNull();
  const { ir, diagnostics: lowerDiags } = lowerToIR(ast!, {
    modifierRegistry: createDefaultRegistry(),
  });
  expect(ir, JSON.stringify(lowerDiags)).not.toBeNull();
  expect(
    lowerDiags.filter((d) => d.severity === 'error'),
    `unexpected lowering errors: ${JSON.stringify(lowerDiags)}`,
  ).toEqual([]);
  return ir!.template!;
}

describe('lowerTemplate — component :key → remountKeyExpression (keyed-remount codegen Task 1)', () => {
  it('component tag with :key sets remountKeyExpression AND retains the raw key binding (fix1-t1)', () => {
    // Self-recursive tag (tagKind === 'self') matches the outer <rozie name>
    // — no <components> table needed to exercise the component path.
    const root = lowerOk(
      rozie('<div><MyComp :key="foo"></MyComp></div>', { name: 'MyComp' }),
    );
    const el = findElementByTag(root, 'MyComp');
    expect(el.tagKind).toBe('self');
    expect(el.remountKeyExpression).toBeDefined();
    expect(t.isIdentifier(el.remountKeyExpression)).toBe(true);
    expect((el.remountKeyExpression as t.Identifier).name).toBe('foo');
    // fix1-t1: the extraction is now a COPY, not a move. The raw `key`
    // binding MUST still be present so the Vue emitter (which has no
    // `key`-drop filter for bare components) keeps emitting a real,
    // working `:key="foo"` vnode-key remount.
    const keyBinding = el.attributes.find(
      (a) => a.kind === 'binding' && a.name === 'key',
    ) as AttributeBinding | undefined;
    expect(keyBinding).toBeDefined();
    expect(keyBinding!.kind).toBe('binding');
    expect(
      t.isIdentifier((keyBinding as { expression: t.Expression }).expression),
    ).toBe(true);
  });

  it('r-for loop key is untouched: TemplateLoopIR.keyExpression set, remountKeyExpression NOT set', () => {
    const root = lowerOk(
      rozie('<div><span r-for="x in xs" :key="x.id"></span></div>'),
    );
    const loop = findLoop(root);
    expect(loop.keyExpression).not.toBeNull();
    expect(t.isMemberExpression(loop.keyExpression)).toBe(true);
    const inner = loop.body[0] as TemplateElementIR;
    expect(inner.type).toBe('TemplateElement');
    expect(inner.remountKeyExpression).toBeUndefined();
  });

  it('r-for on a COMPONENT tag: loop key still routes to keyExpression, not remountKeyExpression', () => {
    const root = lowerOk(
      rozie('<div><MyComp r-for="x in xs" :key="x.id"></MyComp></div>', {
        name: 'MyComp',
      }),
    );
    const loop = findLoop(root);
    expect(loop.keyExpression).not.toBeNull();
    const inner = loop.body[0] as TemplateElementIR;
    expect(inner.tagName).toBe('MyComp');
    expect(inner.remountKeyExpression).toBeUndefined();
    // Review finding (Important) — assert the `.attributes` side effect too,
    // matching BASE (pre-Task-1) behavior: `keyConsumedByLoop` short-circuits
    // the whole extraction block for the r-for path, so the raw `key`
    // binding was NEVER stripped here, before or after this fix. Confirmed
    // by reading `lowerElement`'s r-for branch — `innerEl.attributes` only
    // filters out `for`/`if`/`else-if`/`else` directives, not `:key`.
    const keyBinding = inner.attributes.find(
      (a) => a.kind === 'binding' && a.name === 'key',
    );
    expect(keyBinding).toBeDefined();
  });

  it('plain non-component element with :key does NOT set remountKeyExpression', () => {
    const root = lowerOk(rozie('<div :key="k"></div>'));
    const el = findElementByTag(root, 'div');
    expect(el.tagKind).toBe('html');
    expect(el.remountKeyExpression).toBeUndefined();
    // DOM-element key handling stays untouched — the raw binding remains.
    expect(
      el.attributes.some((a) => a.kind !== 'spreadBinding' && a.name === 'key'),
    ).toBe(true);
  });

  it('mustache-interpolated :key ({{ }}) on a component tag does NOT set remountKeyExpression (out of scope for Task 1)', () => {
    // `:key="{{ foo }}"` lowers to an `interpolated` AttributeBinding, not a
    // `binding` one (see `parseInterpolatedSegments` / `lowerAttribute` in
    // lowerTemplate.ts). The remount-key extraction only matches
    // `a.kind === 'binding' && a.name === 'key'`, so an interpolated `:key`
    // is silently NOT picked up as a remount key. Documented here so
    // downstream per-target remount tasks don't assume interpolated `:key`
    // ever populates the marker.
    const root = lowerOk(
      rozie('<div><MyComp :key="{{ foo }}"></MyComp></div>', {
        name: 'MyComp',
      }),
    );
    const el = findElementByTag(root, 'MyComp');
    expect(el.tagKind).toBe('self');
    expect(el.remountKeyExpression).toBeUndefined();
    const keyAttr = el.attributes.find(
      (a) => a.kind !== 'spreadBinding' && a.name === 'key',
    );
    expect(keyAttr).toBeDefined();
    expect(keyAttr!.kind).toBe('interpolated');
  });
});
