/**
 * Phase 80 Plan 04 — producer-side content-collected fill map.
 *
 * Teaches the Angular producer emitter to collect keyed `[rozieSlot]` fills
 * by content query and resolve them in a fixed precedence order, without
 * touching the `templates` input it sits above. This file grows across all
 * three of this plan's tasks:
 *
 *   Task 1 — `__rozieFills` (content query) + `__rozieFillMap` (pure fold).
 *   Task 2 — `__rozieProjectedTpls` + `__rozieSlotWarned` + the dev-mode-only
 *            diagnostics effect (duplicate-key + empty-fill-map warnings).
 *   Task 3 — the fill map spliced into every slot's resolution chain.
 *
 * See 80-04-PLAN.md for the full behavior contract and 80-CONTEXT.md D-06
 * for why an empty-string fill key normalizes to `'defaultSlot'`.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../emitAngular.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

function compileAngular(src: string, filename: string): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) {
    throw new Error(`lowerToIR() returned null IR for ${filename}`);
  }
  const ir: IRComponent = lowered.ir;
  const { code } = emitAngular(ir, { filename, source: src });
  return code;
}

const RECORD_ONLY_PRODUCER = `
<rozie name="Cell">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div><slot name="cell-status" :value="value()"></slot></div>
</template>
</rozie>
`;

const IDENTIFIER_ONLY_PRODUCER = `
<rozie name="X">
<template>
<div><slot name="header"></slot></div>
</template>
</rozie>
`;

const NO_SLOT_PRODUCER = `
<rozie name="Plain">
<props>{ label: { type: String, default: '' } }</props>
<template>
<div>{{ label() }}</div>
</template>
</rozie>
`;

describe('Angular producer — content-collected fill map (Task 1)', () => {
  it('a producer with at least one key-fillable slot emits __rozieFills, __rozieFillMap, and the RozieSlot runtime import', () => {
    const code = compileAngular(RECORD_ONLY_PRODUCER, 'Cell.rozie');
    expect(code).toContain(
      '__rozieFills = contentChildren(RozieSlot, { descendants: true });',
    );
    expect(code).toContain('__rozieFillMap = computed(() => {');
    expect(code).toContain("import { RozieSlot } from '@rozie/runtime-angular';");
  });

  it('a producer with only identifier-named static slots emits none of the three new members and stays byte-identical otherwise', () => {
    const code = compileAngular(IDENTIFIER_ONLY_PRODUCER, 'X.rozie');
    expect(code).not.toContain('__rozieFills');
    expect(code).not.toContain('__rozieFillMap');
    expect(code).not.toContain('@rozie/runtime-angular');
    // The `templates` input is still present and unchanged — the broad gate
    // (`ir.slots.length > 0`) is untouched by the narrow gate.
    expect(code).toContain(
      'templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);',
    );
  });

  it('a producer with no slots at all emits none of the three new members and no templates input', () => {
    const code = compileAngular(NO_SLOT_PRODUCER, 'Plain.rozie');
    expect(code).not.toContain('__rozieFills');
    expect(code).not.toContain('__rozieFillMap');
    expect(code).not.toContain('@rozie/runtime-angular');
    expect(code).not.toContain('templates = input<');
  });

  it('the templates signal input is present and unchanged when a key-fillable slot is also present', () => {
    const code = compileAngular(RECORD_ONLY_PRODUCER, 'Cell.rozie');
    expect(code).toContain(
      'templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);',
    );
  });

  it('the fold skips nullish/prototype-pollution keys, normalizes empty-string to defaultSlot, and lets a later entry win', () => {
    const code = compileAngular(RECORD_ONLY_PRODUCER, 'Cell.rozie');
    // Object.create(null) accumulator — T-80-01's chosen mitigation.
    expect(code).toContain('Object.create(null)');
    // Nullish skip.
    expect(code).toMatch(/if \(k == null\) continue;/);
    // Prototype-pollution blocklist, mirroring LISTENERS_FORBIDDEN_KEYS_GUARD.
    expect(code).toContain(
      "if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;",
    );
    // D-06 empty-string normalization to the producer's synthetic default-slot key.
    expect(code).toContain("k === '' ? 'defaultSlot' : k");
  });
});
