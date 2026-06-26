/**
 * Re-projected-slot == child-fill-name deconfliction (Svelte 5).
 *
 * Regression for the command-palette → vendored-listbox composition class
 * (Phase 999.4): when a component re-projects its OWN slot `X` into a child
 * component's slot ALSO named `X`, the forwarded `{#snippet X}` (the fill handed
 * to the child) and the `const X = $derived(__XProp ?? snippets?.X)` resolver
 * collide in the single component scope. On Svelte 5 the snippet name shadows
 * the resolver, so `{#if X}{@render X(...)}` (meant to check/render the CONSUMER
 * slot) binds to the wrong `X` → the re-projected slot renders nothing at
 * runtime (0 rows), invisible to compile/typecheck/build.
 *
 * Fix (mirrors the r-for `$$slot` auto-rename): the RESOLVER binding is renamed
 * `X$$slot` while the forwarded fill keeps the child-required name `X`.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitSvelte } from '../emitSvelte.js';

function compileSvelte(src: string, filename: string): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(`parse() null AST for ${filename}: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() null IR for ${filename}`);
  const ir: IRComponent = lowered.ir;
  return emitSvelte(ir, { filename, source: src }).code;
}

const REPROJECT_SAME_NAME = `<rozie name="Reproject">
<components>{ Child: './Child.rozie' }</components>
<slots>
{ option: { params: [{ name: 'option' }, { name: 'index' }] } }
</slots>
<template>
  <Child>
    <template #option="{ option, index }">
      <slot name="option" :option="option" :index="index">
        <span>{{ option }}</span>
      </slot>
    </template>
  </Child>
</template>
</rozie>`;

describe('emitSvelte — re-projected-slot == child-fill-name deconfliction', () => {
  it('renames the colliding slot RESOLVER to X$$slot, keeps the forwarded {#snippet X}', () => {
    const code = compileSvelte(REPROJECT_SAME_NAME, 'Reproject.rozie');

    // The resolver $derived merge is renamed to avoid the snippet shadow.
    expect(code).toMatch(/const option\$\$slot = \$derived\(__optionProp \?\? snippets\?\.option\)/);

    // The forwarded fill handed to <Child> KEEPS the child-required name `option`.
    expect(code).toMatch(/\{#snippet option\(/);

    // The re-projection render-site references the renamed resolver, NOT a bare
    // `option` (which would resolve to the forwarded snippet / scope data).
    expect(code).toMatch(/\{@render option\$\$slot\(/);
    // And the un-suffixed resolver merge must NOT be emitted (the bug shape).
    expect(code).not.toMatch(/const option = \$derived\(__optionProp/);
  });
});
