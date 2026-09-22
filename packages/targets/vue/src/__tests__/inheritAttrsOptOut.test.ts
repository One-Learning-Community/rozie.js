/**
 * quick 260922-hk4 (N-03) — the Vue emitter honours the
 * `inherit-attrs="false" inherit-listeners="false"` opt-out by emitting
 * `defineOptions({ inheritAttrs: false })`.
 *
 * Vue has ONE switch (`inheritAttrs`) where Rozie has two, and Vue's `$attrs`
 * carries listeners. So only the both-`false` corner maps exactly; each mixed
 * corner is not expressible and deliberately keeps today's output (no macro,
 * Vue's default fallthrough). Omitting the `v-bind="$attrs"` spread alone is
 * NOT an opt-out on Vue — the implicit fallthrough still applies everything.
 *
 * The macro is merged into the single `defineOptions(...)` call that
 * `buildScriptPrelude` already owns for self-referencing components: Vue's
 * compiler-sfc hard-errors on a duplicate `defineOptions()` call.
 *
 * Uses the LOCAL `emitVue` source — never `compile()` from `@rozie/core`,
 * whose dist inlines a (possibly stale) copy of this emitter.
 */
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { compileScript, parse as parseSfc } from '@vue/compiler-sfc';
import { describe, expect, it } from 'vitest';
import { emitVue } from '../emitVue.js';

function compile(rozieSrc: string, filename = 'Test.rozie'): string {
  const { ast } = parse(rozieSrc, { filename });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return emitVue(ir, { filename, source: rozieSrc }).code;
}

/** Run Vue's own SFC script compiler over the emitted SFC (throws on macro misuse). */
function vueCompileScript(sfc: string): string {
  const { descriptor, errors } = parseSfc(sfc, { filename: 'Test.vue' });
  if (errors.length > 0) throw errors[0];
  return compileScript(descriptor, { id: 'test' }).content;
}

function button(flags: string): string {
  return `<rozie name="Btn"${flags}>
<props>
{
  label: { type: String, default: 'Click' },
}
</props>
<template>
<button class="btn">{{ $props.label }}</button>
</template>
</rozie>
`;
}

function selfRef(flags: string): string {
  return `<rozie name="Tree"${flags}>
<components>
{
  Tree: './Tree.rozie',
}
</components>
<props>
{
  node: { type: Object, default: () => ({ id: '', children: [] }) },
}
</props>
<template>
<div class="tree">
  <Tree r-for="child in $props.node.children" :key="child.id" :node="child" />
</div>
</template>
</rozie>
`;
}

const count = (s: string, needle: string): number => s.split(needle).length - 1;

describe('N-03: Vue inheritAttrs opt-out', () => {
  it('both flags false → exactly one defineOptions carrying inheritAttrs: false', () => {
    const out = compile(button(' inherit-attrs="false" inherit-listeners="false"'));
    expect(count(out, 'defineOptions(')).toBe(1);
    expect(out).toContain('defineOptions({ inheritAttrs: false });');
  });

  it("both flags false → Vue's compileScript accepts it and folds inheritAttrs: false", () => {
    const out = compile(button(' inherit-attrs="false" inherit-listeners="false"'));
    const content = vueCompileScript(out);
    expect(content).toContain('inheritAttrs: false');
  });

  it('default flags → no defineOptions, no inheritAttrs', () => {
    const out = compile(button(''));
    expect(out).not.toContain('defineOptions');
    expect(out).not.toContain('inheritAttrs');
  });

  it('inherit-attrs="false" only → no inheritAttrs (mixed corner keeps prior behaviour)', () => {
    const out = compile(button(' inherit-attrs="false"'));
    expect(out).not.toContain('inheritAttrs');
    expect(out).not.toContain('defineOptions');
  });

  it('inherit-listeners="false" only → no inheritAttrs; root keeps v-bind="$attrs"', () => {
    const out = compile(button(' inherit-listeners="false"'));
    expect(out).not.toContain('inheritAttrs');
    expect(out).not.toContain('defineOptions');
    expect(out).toContain('v-bind="$attrs"');
  });

  it('self-reference + both false → ONE merged defineOptions({ name, inheritAttrs: false })', () => {
    const out = compile(
      selfRef(' inherit-attrs="false" inherit-listeners="false"'),
      'Tree.rozie',
    );
    expect(count(out, 'defineOptions(')).toBe(1);
    expect(out).toContain("defineOptions({ name: 'Tree', inheritAttrs: false });");
    const content = vueCompileScript(out);
    expect(content).toContain('inheritAttrs: false');
    expect(content).toContain("name: 'Tree'");
  });

  it('self-reference + default flags → unchanged defineOptions({ name })', () => {
    const out = compile(selfRef(''), 'Tree.rozie');
    expect(count(out, 'defineOptions(')).toBe(1);
    expect(out).toContain("defineOptions({ name: 'Tree' });");
    expect(out).not.toContain('inheritAttrs');
    expect(() => vueCompileScript(out)).not.toThrow();
  });
});
