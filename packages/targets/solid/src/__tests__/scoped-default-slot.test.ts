/**
 * Regression: default-slot scope-params invocation.
 *
 * Bug: a producer `<slot :item="item" :index="index" />` against a default
 * slot DECL that declares scope params used to emit `{resolved()}` on the
 * Solid side. The `children()` accessor declared in shell.ts (D-131)
 * resolves the children prop but does NOT pass arguments to a
 * function-typed child. Consumers writing
 * `<X>{({ item }) => <li>{item.label}</li>}</X>` produced the JSX
 * `children={({ item }) => …}` correctly on the consumer side, but the
 * producer then called `resolved()` with no args and the destructure
 * `({ item })` threw `Cannot destructure property 'item' of 'undefined'`.
 *
 * Fix: when the default-slot SlotDecl declares params, switch from
 * `{resolved()}` to a typeof-guarded direct invocation of `local.children`
 * passing the scope object. Mirrors how named-with-params slots already
 * emit on the producer side.
 *
 * Co-fixed with Vue's emitSlotFiller default-shorthand carve-out (same
 * SortableListDemo regression).
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { emitSolid } from '../emitSolid.js';

describe('emitSolid — default-slot scoped-param invocation', () => {
  it('producer with `<slot :item="item" :index="index" />` invokes local.children with the scope', () => {
    const src = `<rozie name="Producer">
<props>
{ items: { type: Array, default: () => [] } }
</props>
<template>
  <ul>
    <li r-for="(item, index) in $props.items" :key="index">
      <slot :item="item" :index="index" />
    </li>
  </ul>
</template>
</rozie>`;
    const parsed = parse(src, { filename: 'Producer.rozie' });
    expect(parsed.ast).not.toBeNull();
    const { ir } = lowerToIR(parsed.ast!, {});
    expect(ir).not.toBeNull();
    const result = emitSolid(ir!, { filename: 'Producer.rozie', source: src });

    // The post-fix emit calls local.children with the scope obj when it's a
    // function; falls through to the plain children prop otherwise.
    expect(result.code).toContain("typeof local.children === 'function'");
    expect(result.code).toContain('local.children');
    expect(result.code).toMatch(/\(\{\s*item,\s*index/);
    // Negative — must NOT emit the bare `{resolved()}` form for this case.
    const slotInvocationRegion = result.code.slice(result.code.indexOf('<li'));
    expect(slotInvocationRegion).not.toContain('{resolved()}');
  });

  it('producer with a paramless default slot keeps the simpler `{resolved()}` form', () => {
    const src = `<rozie name="Producer">
<template>
  <section>
    <slot />
  </section>
</template>
</rozie>`;
    const parsed = parse(src, { filename: 'Producer.rozie' });
    expect(parsed.ast).not.toBeNull();
    const { ir } = lowerToIR(parsed.ast!, {});
    expect(ir).not.toBeNull();
    const result = emitSolid(ir!, { filename: 'Producer.rozie', source: src });

    // Paramless default slot path is unchanged.
    expect(result.code).toContain('{resolved()}');
    // Must NOT regress to the function-call path.
    const section = result.code.slice(result.code.indexOf('<section'));
    expect(section).not.toMatch(/typeof local\.children === 'function'/);
  });
});
