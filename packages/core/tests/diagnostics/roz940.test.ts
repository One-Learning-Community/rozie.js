// Phase 07.2 Plan 01 Task 3 — ROZ940 DUPLICATE_DEFAULT_FILL diagnostic test.
//
// Per SPEC.md R3 / CONTEXT.md D-08: mixing loose children with an explicit
// <template #default> inside a component tag is an error. The compiler emits
// ROZ940 at the source location of the loose-content offender.
//
// Per the plan acceptance criteria (Task 3):
//   "compiles the duplicate-default source per PATTERNS.md lines 1126-1138
//   and asserts the ROZ940 diagnostic shape."
//
// End-to-end test through `compile()` — exercises the parser fill-directive
// recognition + lowerSlotFillers + ROZ940 emission. ROZ941 / ROZ942 / ROZ946
// coverage is rolled into this file for symmetry with the other Phase 07.2
// diagnostic tests.
import { describe, it, expect } from 'vitest';
import { compile } from '../../src/compile.js';

function compileForVue(src: string, filename = 'X.rozie') {
  return compile(src, { target: 'vue', filename });
}

describe('ROZ940 DUPLICATE_DEFAULT_FILL — Phase 07.2 Plan 01 (R3 / D-08)', () => {
  it('emits ROZ940 when a component tag mixes loose children with explicit <template #default>', () => {
    const src = `<rozie name="X">
<components>{ Modal: './Modal.rozie' }</components>
<template>
<Modal>Loose<template #default>Explicit</template></Modal>
</template>
</rozie>`;
    const result = compileForVue(src);
    const roz940 = result.diagnostics.find((d) => d.code === 'ROZ940');
    expect(roz940).toBeDefined();
    expect(roz940!.severity).toBe('error');
    expect(roz940!.message).toMatch(/loose children/i);
    expect(roz940!.message).toMatch(/default/i);
  });

  it('does NOT emit ROZ940 when only loose children are present (R3 default-shorthand)', () => {
    const src = `<rozie name="X">
<components>{ Modal: './Modal.rozie' }</components>
<template>
<Modal>Are you sure?</Modal>
</template>
</rozie>`;
    const result = compileForVue(src);
    expect(result.diagnostics.find((d) => d.code === 'ROZ940')).toBeUndefined();
  });

  it('does NOT emit ROZ940 when only an explicit <template #default> is present', () => {
    const src = `<rozie name="X">
<components>{ Modal: './Modal.rozie' }</components>
<template>
<Modal><template #default>Explicit only</template></Modal>
</template>
</rozie>`;
    const result = compileForVue(src);
    expect(result.diagnostics.find((d) => d.code === 'ROZ940')).toBeUndefined();
  });
});

describe('ROZ942 DUPLICATE_NAMED_FILL — Phase 07.2 Plan 01 (D-08)', () => {
  it('emits ROZ942 when two sibling <template #header> directives appear', () => {
    const src = `<rozie name="X">
<components>{ Modal: './Modal.rozie' }</components>
<template>
<Modal>
  <template #header><h2>One</h2></template>
  <template #header><h2>Two</h2></template>
</Modal>
</template>
</rozie>`;
    const result = compileForVue(src);
    const roz942 = result.diagnostics.find((d) => d.code === 'ROZ942');
    expect(roz942).toBeDefined();
    expect(roz942!.severity).toBe('error');
    expect(roz942!.message).toMatch(/header/);
  });

  it('emits ROZ942 when two sibling <template #default> directives appear', () => {
    const src = `<rozie name="X">
<components>{ Modal: './Modal.rozie' }</components>
<template>
<Modal>
  <template #default>One</template>
  <template #default>Two</template>
</Modal>
</template>
</rozie>`;
    const result = compileForVue(src);
    const roz942 = result.diagnostics.find((d) => d.code === 'ROZ942');
    expect(roz942).toBeDefined();
  });
});

describe('ROZ946 DYNAMIC_NAME_EXPRESSION_INVALID — Phase 07.2 Plan 01 (D-08)', () => {
  it('emits ROZ946 when the bracketed expression fails to parse as JS', () => {
    const src = `<rozie name="X">
<components>{ Modal: './Modal.rozie' }</components>
<template>
<Modal>
  <template #[bad..syntax]>oops</template>
</Modal>
</template>
</rozie>`;
    const result = compileForVue(src);
    const roz946 = result.diagnostics.find((d) => d.code === 'ROZ946');
    expect(roz946).toBeDefined();
    expect(roz946!.severity).toBe('error');
    expect(roz946!.message).toMatch(/bad\.\.syntax/);
  });
});

describe('ROZ945 CROSS_PACKAGE_LOOKUP_FAILED — Phase 07.2 Plan 01 (D-08)', () => {
  it('emits ROZ945 when <components> import path cannot be resolved AND a fill is present', () => {
    const src = `<rozie name="X">
<components>{ Modal: './does-not-exist.rozie' }</components>
<template>
<Modal>
  <template #header><h2>Hi</h2></template>
</Modal>
</template>
</rozie>`;
    const result = compileForVue(src, '/tmp/non-existent-consumer-dir/X.rozie');
    const roz945 = result.diagnostics.find((d) => d.code === 'ROZ945');
    expect(roz945).toBeDefined();
    expect(roz945!.severity).toBe('error');
    expect(roz945!.message).toMatch(/does-not-exist\.rozie/);
  });
});
