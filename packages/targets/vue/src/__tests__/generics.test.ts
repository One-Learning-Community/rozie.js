/**
 * Plan 06-02 Task 3 — D-85 Vue full generic preservation.
 *
 * Verifies that `EmitVueOptions.genericParams` threads through:
 *   emitVue → emitScript → buildShell
 *     → `<script setup lang="ts" generic="T">` SFC attribute (Vue 3.4+ stable)
 *     → `interface SelectProps<T> { ... }`
 *     → `defineProps<SelectProps<T>>()`
 *
 * Backward-compat regression: the 5 non-generic reference examples must
 * produce byte-identical SFC output to their existing snapshots when
 * `genericParams` is omitted. Verified by `snapshot-suite.test.ts` running
 * separately as part of the full vue test suite.
 */
import { describe, it, expect } from 'vitest';
import { emitVue } from '../emitVue.js';
import { makeSelectIR } from '../../../../../tests/fixtures/generics/select-ir.js';

describe('emitVue — D-85 Vue full generic preservation (Plan 06-02 Task 3)', () => {
  it('V-G1: generic attribute lands in SFC <script setup>', () => {
    const ir = makeSelectIR();
    const result = emitVue(ir, {
      genericParams: ['T'],
      filename: 'Select.rozie',
      source: '<rozie name="Select" />',
    });
    expect(result.code).toContain(`<script setup lang="ts" generic="T">`);
  });

  it('V-G2: multiple generics joined comma-separated (no extra spaces)', () => {
    const ir = makeSelectIR();
    const result = emitVue(ir, {
      genericParams: ['T', 'U'],
      filename: 'Select.rozie',
      source: '<rozie name="Select" />',
    });
    expect(result.code).toContain(`<script setup lang="ts" generic="T, U">`);
  });

  it('V-G3: omitting genericParams emits the existing non-generic shape', () => {
    const ir = makeSelectIR();
    const result = emitVue(ir, {
      filename: 'Select.rozie',
      source: '<rozie name="Select" />',
    });
    expect(result.code).toContain(`<script setup lang="ts">`);
    // Ensure the generic= attribute is NOT present.
    expect(result.code).not.toMatch(/<script setup lang="ts" generic=/);
  });

  it('V-G4: defineProps carries the generic through (interface SelectProps<T>)', () => {
    const ir = makeSelectIR();
    const result = emitVue(ir, {
      genericParams: ['T'],
      filename: 'Select.rozie',
      source: '<rozie name="Select" />',
    });
    // Vue 3.4+ macro: interface SelectProps<T> { ... } + defineProps<SelectProps<T>>()
    expect(result.code).toMatch(/interface SelectProps<T>/);
    expect(result.code).toMatch(/defineProps<SelectProps<T>>/);
  });

  it('V-G5: defineModel carries T through the model triplet', () => {
    const ir = makeSelectIR();
    const result = emitVue(ir, {
      genericParams: ['T'],
      filename: 'Select.rozie',
      source: '<rozie name="Select" />',
    });
    // The model:true `selected` prop emits `defineModel<T>('selected', ...)`.
    // T renders verbatim because PropTypeAnnotation.identifier passes through.
    expect(result.code).toMatch(/defineModel<T>\(['"]selected['"]/);
  });
});
