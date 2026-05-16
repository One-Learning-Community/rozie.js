// Phase 07.2 Plan 03 Task 3 — ROZ947 SCOPED_PARAM_MISMATCH diagnostic test.
//
// Per SPEC.md R4 / CONTEXT.md D-09: when the consumer destructures a param
// that the producer's `<slot :name="…">` does NOT declare, the compiler
// emits ROZ947 at the consumer's destructure source location — proving the
// producer-to-consumer type-flow gate (D-10's Wave-1 boundary).
//
// End-to-end test through `compile()` — exercises the parser scoped-fill
// `<template #header="{ closeMistake }">` recognition + lowerSlotFillers +
// threadParamTypes' ROZ947 emission. The producer is provided via a real
// `.rozie` sibling file so the IR cache + producer resolver path is
// exercised (mirrors the slot-matrix fixture pattern).
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../src/compile.js';

const PRODUCER_SRC = `<rozie name="Producer">

<script>
const close = () => { $emit('close') }
</script>

<template>
<div class="producer">
  <header>
    <slot name="header" :close="close">default header</slot>
  </header>
  <main>
    <slot>default body</slot>
  </main>
</div>
</template>

</rozie>
`;

function makeTmpDir(label: string): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), `rozie-roz947-${label}-`));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe('ROZ947 SCOPED_PARAM_MISMATCH — Phase 07.2 Plan 03 (R4 / D-09)', () => {
  it('emits ROZ947 when consumer destructures a param the producer slot does not declare', () => {
    const { dir, cleanup } = makeTmpDir('mismatch');
    try {
      writeFileSync(join(dir, 'producer.rozie'), PRODUCER_SRC, 'utf8');
      // Consumer destructures `{ closeMistake }` against producer's
      // `<slot name="header" :close="close">` — the typo `closeMistake`
      // is not in the producer's scoped-param set, so threadParamTypes
      // emits ROZ947 at the consumer's destructure source location.
      const consumerSrc = `<rozie name="Consumer">

<components>
{
  Producer: './producer.rozie',
}
</components>

<template>
<Producer>
  <template #header="{ closeMistake }">
    <button @click="closeMistake">×</button>
  </template>
</Producer>
</template>

</rozie>`;
      const consumerPath = join(dir, 'input.rozie');
      writeFileSync(consumerPath, consumerSrc, 'utf8');

      const result = compile(consumerSrc, {
        target: 'vue',
        filename: consumerPath,
        resolverRoot: dir,
      });

      const roz947 = result.diagnostics.find((d) => d.code === 'ROZ947');
      expect(roz947).toBeDefined();
      expect(roz947!.severity).toBe('error');
      // Message mentions the offending param name + the slot name.
      expect(roz947!.message).toMatch(/closeMistake/);
      expect(roz947!.message).toMatch(/header/);
      // Hint surfaces the producer's actually-declared params (helps the
      // user fix the typo in one step — D-09 explicit UX promise).
      expect(roz947!.hint).toBeDefined();
      expect(roz947!.hint!).toMatch(/close/);
      // Source-located: the diagnostic loc MUST point at the consumer's
      // destructure line, not the generated target output. CONTEXT.md D-09
      // explicitly calls this out as the differentiator vs. relying on the
      // host TS compiler to surface the error against generated .tsx.
      expect(roz947!.loc).toBeDefined();
      expect(roz947!.loc!.start).toBeDefined();
    } finally {
      cleanup();
    }
  });

  it('does NOT emit ROZ947 when consumer destructure matches producer slot params', () => {
    const { dir, cleanup } = makeTmpDir('match');
    try {
      writeFileSync(join(dir, 'producer.rozie'), PRODUCER_SRC, 'utf8');
      const consumerSrc = `<rozie name="Consumer">

<components>
{
  Producer: './producer.rozie',
}
</components>

<template>
<Producer>
  <template #header="{ close }">
    <button @click="close">×</button>
  </template>
</Producer>
</template>

</rozie>`;
      const consumerPath = join(dir, 'input.rozie');
      writeFileSync(consumerPath, consumerSrc, 'utf8');

      const result = compile(consumerSrc, {
        target: 'vue',
        filename: consumerPath,
        resolverRoot: dir,
      });

      expect(
        result.diagnostics.find((d) => d.code === 'ROZ947'),
      ).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
