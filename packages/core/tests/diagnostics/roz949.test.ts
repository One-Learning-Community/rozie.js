// Phase 07.3 Plan 01 Task 2 — ROZ949 TWO_WAY_PROP_NOT_MODEL diagnostic test
// scaffold (Wave 1 — RED).
//
// Per 07.3-SPEC.md TWO-WAY-04 / 07.3-CONTEXT.md D-02: when the consumer writes
// `<Producer r-model:open="$data.x">` but the producer's prop `open` is NOT
// declared with `model: true`, the compiler emits ROZ949 with a dual-frame:
// primary frame at the consumer's `r-model:open=` source location, secondary
// frame at the producer's prop declaration (where it's declared without
// `model: true`). Mirrors ROZ947's dual-frame approach.
//
// End-to-end test through `compile()` — exercises the Wave 2 parser branch +
// lowerTemplate `twoWayBinding` IR variant + `validateTwoWayBindings` ROZ949
// emission. Producer is provided via a real `.rozie` sibling so the IR cache +
// producer-resolver path is exercised (mirrors roz947.test.ts scaffold).
//
// WAVE 1 RED STATE: until Wave 2 lands the lowerer branch + validator, this
// test fails because `result.diagnostics` does not contain ROZ949. The test
// MUST compile against current types — assertions reference string code values
// (`d.code === 'ROZ949'`) so no symbol-resolution gating is required.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../src/compile.js';

// Producer with prop `open` lacking `model: true` — ROZ949 trigger surface.
const PRODUCER_NO_MODEL_SRC = `<rozie name="Producer">

<props>
{
  open: { type: Boolean, default: false }
}
</props>

<template>
<div r-show="$props.open">producer</div>
</template>

</rozie>
`;

// Producer with prop `open` having `model: true` — negative case (no ROZ949).
const PRODUCER_WITH_MODEL_SRC = `<rozie name="Producer">

<props>
{
  open: { type: Boolean, default: false, model: true }
}
</props>

<template>
<div r-show="$props.open">producer</div>
</template>

</rozie>
`;

function makeTmpDir(label: string): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), `rozie-roz949-${label}-`));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe('ROZ949 TWO_WAY_PROP_NOT_MODEL — Phase 07.3 (dual-frame)', () => {
  it('emits ROZ949 dual-frame when producer prop lacks model: true', () => {
    const { dir, cleanup } = makeTmpDir('missing-model');
    try {
      writeFileSync(join(dir, 'producer.rozie'), PRODUCER_NO_MODEL_SRC, 'utf8');
      const consumerSrc = `<rozie name="Consumer">

<components>
{
  Producer: './producer.rozie',
}
</components>

<data>
{
  x: false
}
</data>

<template>
<Producer r-model:open="$data.x" />
</template>

</rozie>`;
      const consumerPath = join(dir, 'input.rozie');
      writeFileSync(consumerPath, consumerSrc, 'utf8');

      const result = compile(consumerSrc, {
        target: 'vue',
        filename: consumerPath,
        resolverRoot: dir,
      });

      const roz949 = result.diagnostics.find((d) => d.code === 'ROZ949');
      // RED: in Wave 1, no validator exists; this assertion fails until Wave 2.
      expect(roz949).toBeDefined();
      expect(roz949!.severity).toBe('error');
      expect(roz949!.message).toMatch(/open/);
      expect(roz949!.message).toMatch(/model: true/);
      // Dual-frame: related[] points to producer decl site.
      expect(roz949!.related).toBeDefined();
      expect(roz949!.related!.length).toBeGreaterThan(0);
      expect(roz949!.related![0]!.message).toMatch(/declared here|model: true/i);
      // Primary loc lives on the consumer site (r-model:open=).
      expect(roz949!.loc).toBeDefined();
      expect(roz949!.loc.start).toBeGreaterThan(0);
      // Actionable hint surfaces the fix.
      expect(roz949!.hint).toBeDefined();
      expect(roz949!.hint!).toMatch(/model: true/);
    } finally {
      cleanup();
    }
  });

  it('does NOT emit ROZ949 when producer prop has model: true', () => {
    const { dir, cleanup } = makeTmpDir('with-model');
    try {
      writeFileSync(join(dir, 'producer.rozie'), PRODUCER_WITH_MODEL_SRC, 'utf8');
      const consumerSrc = `<rozie name="Consumer">

<components>
{
  Producer: './producer.rozie',
}
</components>

<data>
{
  x: false
}
</data>

<template>
<Producer r-model:open="$data.x" />
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
        result.diagnostics.find((d) => d.code === 'ROZ949'),
      ).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
