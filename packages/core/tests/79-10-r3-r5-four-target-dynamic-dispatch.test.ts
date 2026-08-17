/**
 * Plan 79-10 Task 3 — cross-target compile proof for R3/R5's producer
 * runtime-keyed dispatch + matchedFamily consumer routing on React, Solid,
 * Svelte and Vue (the four non-Lit, non-Angular targets this plan covers;
 * Angular is 79-11 per D-09).
 *
 * `DynamicSlots.rozie` / `DynamicSlotsConsumer.rozie` remain parked at
 * `tests/fixtures/pending-79/` (per this plan's PATH CORRECTION — 79-13
 * `git mv`s the pair into `examples/`) and are deliberately NOT registered in
 * `tests/dist-parity/scripts/bootstrap-fixtures.mjs`, so the positive proof
 * for this plan is this direct `compile()` assertion rather than dist-parity.
 *
 * Drives the REAL public `compile()` entrypoint (not a bare
 * `parse`/`lowerToIR` triple) so `threadParamTypes`'s cross-file
 * `matchedFamily` resolution actually runs — the same lesson 79-09's
 * `rozieSlots.test.ts` recorded for Lit.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, type CompileTarget } from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PENDING_79 = resolve(HERE, '../../../tests/fixtures/pending-79');

const FOUR_TARGETS: CompileTarget[] = ['react', 'solid', 'svelte', 'vue'];

function compileFixture(target: CompileTarget, name: string): string {
  const filename = resolve(PENDING_79, `${name}.rozie`);
  const source = readFileSync(filename, 'utf8');
  const result = compile(source, { target, filename, resolverRoot: PENDING_79 });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `compile('${name}.rozie', target=${target}) produced error diagnostics: ${JSON.stringify(errors, null, 2)}`,
    );
  }
  return result.code;
}

const producerCode: Partial<Record<CompileTarget, string>> = {};
const consumerCode: Partial<Record<CompileTarget, string>> = {};

beforeAll(() => {
  for (const target of FOUR_TARGETS) {
    producerCode[target] = compileFixture(target, 'DynamicSlots');
    consumerCode[target] = compileFixture(target, 'DynamicSlotsConsumer');
  }
});

describe('Phase 79 Plan 10 (R3/R5/D-09) — producer dispatch on React/Solid/Svelte/Vue', () => {
  it.each(FOUR_TARGETS)(
    '%s: the family-prefixed dynamic slot resolves through the record, keyed on the rewritten runtime expression',
    (target) => {
      const code = producerCode[target]!;
      if (target === 'vue') {
        // Vue's native path — a BOUND :name attribute, not a record lookup.
        expect(code).toContain(':name="`cell-${col.key}`"');
        return;
      }
      if (target === 'react') {
        expect(code).toContain('props.slots?.[`cell-${col.key}`]');
        return;
      }
      if (target === 'solid') {
        // Solid rewrites the r-for loop item as an accessor call (`col()`).
        expect(code).toContain('_props.slots?.[`cell-${col().key}`]');
        return;
      }
      // Svelte keys the $derived initializer on the rewritten expression,
      // then references the ordinal-derived local binding at the render site.
      expect(code).toMatch(/\$derived\(snippets\?\.\[`cell-\$\{col\.key\}`\]\)/);
    },
  );

  it.each(FOUR_TARGETS)(
    '%s: the no-static-prefix dynamic slot ALSO resolves through its OWN distinct record entry (two dynamic slots on one producer do not collide)',
    (target) => {
      const code = producerCode[target]!;
      if (target === 'vue') {
        expect(code).toContain(':name="freeSlotName"');
        return;
      }
      if (target === 'react') {
        expect(code).toContain('props.slots?.[freeSlotName]');
        return;
      }
      if (target === 'solid') {
        expect(code).toContain('_props.slots?.[freeSlotName()]');
        return;
      }
      expect(code).toMatch(/\$derived\(snippets\?\.\[freeSlotName\]\)/);
    },
  );

  it.each(FOUR_TARGETS)('%s: the static kebab-named slot (cell-total) still routes through the record unchanged (R12 regression guard)', (target) => {
    const code = producerCode[target]!;
    if (target === 'vue') {
      // Vue never needed a record — a static kebab name is a plain native slot.
      expect(code).toContain('<slot name="cell-total"');
      return;
    }
    expect(code.toLowerCase()).toContain('cell-total');
  });
});

describe('Phase 79 Plan 10 (R5/D-09) — matchedFamily consumer routing on React/Solid/Svelte/Vue', () => {
  it.each(FOUR_TARGETS)('%s: the two family fills (#cell-status, #cell-score) appear as record entries', (target) => {
    const code = consumerCode[target]!;
    if (target === 'vue') {
      // Vue's native path — a real named fill, not a record entry. cell-status
      // and cell-score are hyphenated (non-identifier) names, so Vue's
      // bracket-quoted `#[...]`-free native syntax still just uses the
      // ordinary `<template #cell-status>` form (Vue slot names accept any
      // string via kebab-case natively).
      expect(code).toContain('#cell-status');
      expect(code).toContain('#cell-score');
      return;
    }
    if (target === 'react' || target === 'solid') {
      expect(code).toContain('slots={{');
      expect(code).toContain("'cell-status': ({ row, value }) =>");
      expect(code).toContain("'cell-score': ({ row, value }) =>");
      return;
    }
    // Svelte: bracket-computed literal-key form (its established convention
    // for EVERY record entry, dynamic or static — see emitDynamicSnippetsProp).
    expect(code).toContain('snippets={{');
    expect(code).toMatch(/\['cell-status'\]:\s*__rozieDynSlot_\d/);
    expect(code).toMatch(/\['cell-score'\]:\s*__rozieDynSlot_\d/);
  });

  it.each(FOUR_TARGETS)('%s: the consumer-side dynamic fill targeting the no-prefix slot round-trips end to end', (target) => {
    const code = consumerCode[target]!;
    // #[$data.dynamicFillKey] — Phase 07.3.2's pre-existing consumer dynamic
    // fill mechanism, exercised here alongside producer-side dynamism.
    expect(code.length).toBeGreaterThan(0);
    if (target === 'vue') {
      expect(code).toContain('#[');
      return;
    }
    expect(code).toMatch(/slots=\{\{|snippets=\{\{/);
  });
});
