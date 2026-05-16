// Phase 07.2 Plan 05 Task 3 — ROZ944 REPROJECTION_UNDECLARED_INNER_SLOT
// diagnostic test (R6 / D-08).
//
// Per CONTEXT.md D-08: when a wrapper has `<template #header><slot name="X" /></template>`
// but the inner producer doesn't declare a `header` slot, the existing ROZ941
// (UNKNOWN_SLOT_NAME) already warns that the fill is pointless on the inner
// side. ROZ944 fires AS A SIBLING when the fill body contains a `<slot>`
// re-projection — making the diagnostic UX explicit that BOTH the fill AND
// the re-projection wiring inside are wasted.
//
// End-to-end test through `compile()` — exercises the parser fill-directive
// recognition + lowerSlotFillers + threadParamTypes' ROZ944 emission.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../src/compile.js';

// Inner producer declares ONLY a `body` slot — NO `header` slot. So
// when the wrapper fills `<template #header>`, ROZ941 fires; if that
// fill body also contains a `<slot>` re-projection, ROZ944 fires too.
const INNER_NO_HEADER_SRC = `<rozie name="Inner">

<template>
<div class="inner">
  <main>
    <slot name="body">default body</slot>
  </main>
</div>
</template>

</rozie>
`;

function makeTmpDir(label: string): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), `rozie-roz944-${label}-`));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe('ROZ944 REPROJECTION_UNDECLARED_INNER_SLOT — Phase 07.2 Plan 05 (R6 / D-08)', () => {
  it('emits ROZ944 when wrapper fills an inner slot the producer does not declare AND the fill body contains a <slot> re-projection', () => {
    const { dir, cleanup } = makeTmpDir('reproj-pointless');
    try {
      writeFileSync(join(dir, 'inner.rozie'), INNER_NO_HEADER_SRC, 'utf8');
      // Wrapper fills `<template #header>` (inner has no `header` slot)
      // AND the body contains a `<slot name="title" />` re-projection.
      // Both ROZ941 (the fill is pointless) and ROZ944 (the re-projection
      // inside is pointless too) should surface.
      const wrapperSrc = `<rozie name="Wrapper">

<components>
{
  Inner: './inner.rozie',
}
</components>

<template>
<aside>
  <slot name="title">declared default</slot>
</aside>
<Inner>
  <template #header>
    <slot name="title">re-projected default</slot>
  </template>
</Inner>
</template>

</rozie>`;
      const wrapperPath = join(dir, 'wrapper.rozie');
      writeFileSync(wrapperPath, wrapperSrc, 'utf8');

      const result = compile(wrapperSrc, {
        target: 'vue',
        filename: wrapperPath,
        resolverRoot: dir,
      });

      // ROZ941 should also fire (pointless fill).
      const roz941 = result.diagnostics.find((d) => d.code === 'ROZ941');
      expect(roz941).toBeDefined();
      expect(roz941!.severity).toBe('warning');

      // ROZ944 surfaces as the sibling re-projection-pointless warning.
      const roz944 = result.diagnostics.find((d) => d.code === 'ROZ944');
      expect(roz944).toBeDefined();
      expect(roz944!.severity).toBe('warning');
      expect(roz944!.message).toMatch(/header/);
      expect(roz944!.message).toMatch(/re-projection/i);
      expect(roz944!.hint).toBeDefined();
    } finally {
      cleanup();
    }
  });

  it('does NOT emit ROZ944 when the inner DOES declare the slot the wrapper fills (ROZ941 also stays clear)', () => {
    const { dir, cleanup } = makeTmpDir('declared');
    try {
      // Inner declares a `header` slot — the wrapper's fill matches.
      const innerSrc = `<rozie name="Inner">

<template>
<div class="inner">
  <header>
    <slot name="header">default header</slot>
  </header>
</div>
</template>

</rozie>
`;
      writeFileSync(join(dir, 'inner.rozie'), innerSrc, 'utf8');
      const wrapperSrc = `<rozie name="Wrapper">

<components>
{
  Inner: './inner.rozie',
}
</components>

<template>
<aside>
  <slot name="title">declared default</slot>
</aside>
<Inner>
  <template #header>
    <slot name="title">re-projected default</slot>
  </template>
</Inner>
</template>

</rozie>`;
      const wrapperPath = join(dir, 'wrapper.rozie');
      writeFileSync(wrapperPath, wrapperSrc, 'utf8');

      const result = compile(wrapperSrc, {
        target: 'vue',
        filename: wrapperPath,
        resolverRoot: dir,
      });

      // Neither ROZ941 nor ROZ944 fires — fill matches a declared slot.
      expect(result.diagnostics.find((d) => d.code === 'ROZ941')).toBeUndefined();
      expect(result.diagnostics.find((d) => d.code === 'ROZ944')).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it('does NOT emit ROZ944 when fill body has NO re-projection (only ROZ941 fires for the pointless fill)', () => {
    const { dir, cleanup } = makeTmpDir('no-reproj');
    try {
      writeFileSync(join(dir, 'inner.rozie'), INNER_NO_HEADER_SRC, 'utf8');
      // Wrapper fills `<template #header>` with PLAIN markup (no <slot>).
      // ROZ941 fires (the fill goes nowhere) but ROZ944 does NOT — there's
      // no re-projection wiring to flag as wasted.
      const wrapperSrc = `<rozie name="Wrapper">

<components>
{
  Inner: './inner.rozie',
}
</components>

<template>
<Inner>
  <template #header>
    <h2>Plain header</h2>
  </template>
</Inner>
</template>

</rozie>`;
      const wrapperPath = join(dir, 'wrapper.rozie');
      writeFileSync(wrapperPath, wrapperSrc, 'utf8');

      const result = compile(wrapperSrc, {
        target: 'vue',
        filename: wrapperPath,
        resolverRoot: dir,
      });

      // ROZ941 fires for the pointless fill.
      expect(result.diagnostics.find((d) => d.code === 'ROZ941')).toBeDefined();
      // ROZ944 does NOT fire — body has no <slot> re-projection.
      expect(result.diagnostics.find((d) => d.code === 'ROZ944')).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
