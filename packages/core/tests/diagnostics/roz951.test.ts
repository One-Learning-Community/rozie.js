// Phase 07.3 Plan 01 Task 2 — ROZ951 TWO_WAY_LHS_NOT_WRITABLE diagnostic test
// scaffold (Wave 1 — RED).
//
// Per 07.3-SPEC.md TWO-WAY-04 / 07.3-CONTEXT.md D-03 (permissive rule): the
// RHS of `r-model:propName="expr"` must be a writable lvalue. Allowed:
//   - $data.x (top-level data ref)
//   - $data.x.y (deep member chain rooted in $data)
//   - $props.x ONLY when the consumer's own <props> declares x with model:true
//     (the forwarding pattern, parallel to Vue's wrapper components)
//
// Rejected (ROZ951 fires):
//   - Literals: `r-model:open="true"` / `r-model:open="42"`
//   - Ternaries: `r-model:open="cond ? a : b"`
//   - Function calls: `r-model:open="getOpen()"`
//   - $computed refs: `r-model:open="$computed(() => $data.x)"`
//
// WAVE 1 RED STATE: until Wave 2 ships `isWritableLValue` + the validator,
// these tests fail because ROZ951 is not yet emitted.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../src/compile.js';

// Producer with prop `open` declared model:true — isolates the LHS rule under
// test from ROZ949 (which would fire if model:true were missing).
const PRODUCER_SRC = `<rozie name="Producer">

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
  const dir = mkdtempSync(join(tmpdir(), `rozie-roz951-${label}-`));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function buildConsumer(rhs: string, opts?: { scriptBlock?: string }): string {
  const script = opts?.scriptBlock ?? '';
  return `<rozie name="Consumer">

<components>
{
  Producer: './producer.rozie',
}
</components>

<data>
{
  x: false,
  y: false
}
</data>
${script}

<template>
<Producer r-model:open="${rhs}" />
</template>

</rozie>`;
}

function compileWith(rhs: string, opts?: { scriptBlock?: string }) {
  const { dir, cleanup } = makeTmpDir('lhs');
  writeFileSync(join(dir, 'producer.rozie'), PRODUCER_SRC, 'utf8');
  const consumerSrc = buildConsumer(rhs, opts);
  const consumerPath = join(dir, 'input.rozie');
  writeFileSync(consumerPath, consumerSrc, 'utf8');
  try {
    const result = compile(consumerSrc, {
      target: 'vue',
      filename: consumerPath,
      resolverRoot: dir,
    });
    return result;
  } finally {
    cleanup();
  }
}

describe('ROZ951 TWO_WAY_LHS_NOT_WRITABLE — Phase 07.3 (D-03 LHS rule)', () => {
  it('emits ROZ951 when RHS is a boolean literal', () => {
    const result = compileWith('true');
    const roz951 = result.diagnostics.find((d) => d.code === 'ROZ951');
    // RED: Wave 2 implements the LHS rule.
    expect(roz951).toBeDefined();
    expect(roz951!.severity).toBe('error');
    expect(roz951!.message).toMatch(/writable|lvalue|r-model/i);
    expect(roz951!.loc).toBeDefined();
  });

  it('emits ROZ951 when RHS is a ternary expression', () => {
    const result = compileWith('$data.x ? $data.y : false');
    const roz951 = result.diagnostics.find((d) => d.code === 'ROZ951');
    // RED: Wave 2 ships ternary rejection.
    expect(roz951).toBeDefined();
    expect(roz951!.severity).toBe('error');
  });

  it('emits ROZ951 when RHS is a function call', () => {
    const result = compileWith(
      'getOpen()',
      { scriptBlock: '\n<script>\nfunction getOpen() { return $data.x }\n</script>' },
    );
    const roz951 = result.diagnostics.find((d) => d.code === 'ROZ951');
    // RED: Wave 2 ships CallExpression rejection.
    expect(roz951).toBeDefined();
    expect(roz951!.severity).toBe('error');
  });

  it('emits ROZ951 when RHS references a $computed value', () => {
    const result = compileWith(
      'isOpen',
      { scriptBlock: '\n<script>\nconst isOpen = $computed(() => $data.x)\n</script>' },
    );
    const roz951 = result.diagnostics.find((d) => d.code === 'ROZ951');
    // RED: Wave 2 ships $computed-ref rejection (computed refs are not lvalues).
    expect(roz951).toBeDefined();
    expect(roz951!.severity).toBe('error');
  });
});
