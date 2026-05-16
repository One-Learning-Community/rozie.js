// Phase 07.3 Plan 01 Task 2 — ROZ950 TWO_WAY_ARG_OR_TARGET_INVALID diagnostic
// test scaffold (Wave 1 — RED).
//
// Per 07.3-SPEC.md §Diagnostic Code Assignments / 07.3-RESEARCH.md (combined
// shape-error code): ROZ950 fires for r-model: argument-form misuse:
//
//   1. Empty arg — `r-model:="$data.x"` (parser-level; arg required)
//   2. Non-component target — `<div r-model:foo="$data.x">` (the directive only
//      applies to tagKind='component'/'self' elements; HTML tags have no
//      consumer-side two-way machinery to engage)
//
// WAVE 1 RED STATE: until Wave 2 wires the lowerer branch + validator, these
// tests fail because ROZ950 is not yet emitted. The code is registered in
// codes.ts as of Plan 01 Task 2 so importing it is safe.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../src/compile.js';

function makeTmpDir(label: string): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), `rozie-roz950-${label}-`));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe('ROZ950 TWO_WAY_ARG_OR_TARGET_INVALID — Phase 07.3', () => {
  it('emits ROZ950 when r-model: argument is empty (no propName)', () => {
    const { dir, cleanup } = makeTmpDir('empty-arg');
    try {
      // r-model:= with no propName — argument-form requires a name.
      const src = `<rozie name="Consumer">

<data>
{
  x: false
}
</data>

<template>
<Producer r-model:="$data.x" />
</template>

</rozie>`;
      const filename = join(dir, 'input.rozie');
      writeFileSync(filename, src, 'utf8');

      const result = compile(src, {
        target: 'vue',
        filename,
        resolverRoot: dir,
      });

      const roz950 = result.diagnostics.find((d) => d.code === 'ROZ950');
      // RED: in Wave 1, no validator/lowerer branch exists for ROZ950.
      expect(roz950).toBeDefined();
      expect(roz950!.severity).toBe('error');
      expect(roz950!.message).toMatch(/r-model|propName|argument/i);
      expect(roz950!.loc).toBeDefined();
    } finally {
      cleanup();
    }
  });

  it('emits ROZ950 when r-model:propName is applied to a non-component HTML tag', () => {
    const { dir, cleanup } = makeTmpDir('non-component-target');
    try {
      // r-model:foo on <div> — only component tags engage two-way machinery.
      const src = `<rozie name="Consumer">

<data>
{
  x: false
}
</data>

<template>
<div r-model:foo="$data.x">non-component</div>
</template>

</rozie>`;
      const filename = join(dir, 'input.rozie');
      writeFileSync(filename, src, 'utf8');

      const result = compile(src, {
        target: 'vue',
        filename,
        resolverRoot: dir,
      });

      const roz950 = result.diagnostics.find((d) => d.code === 'ROZ950');
      // RED: in Wave 1, no validator branch detects non-component target.
      expect(roz950).toBeDefined();
      expect(roz950!.severity).toBe('error');
      expect(roz950!.message).toMatch(/component|HTML|tag/i);
      expect(roz950!.loc).toBeDefined();
    } finally {
      cleanup();
    }
  });
});
