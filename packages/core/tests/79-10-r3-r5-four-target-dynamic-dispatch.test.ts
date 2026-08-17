/**
 * Plan 79-10 Task 3 (origin) / Plan 79-11 Task 3 (this update) — cross-target
 * compile proof for R3/R5's producer runtime-keyed dispatch + matchedFamily
 * consumer routing.
 *
 * 79-10 covered React, Solid, Svelte and Vue. This update adds Angular — the
 * sixth and final producer-dispatch target (D-09's second half, isolated
 * because Angular substitutes into an existing merged template reference).
 * Lit's equivalent real-fixture proof lives in its own dedicated file
 * (`packages/targets/lit/src/emit/__tests__/rozieSlots.test.ts`, 79-09) rather
 * than here; between this file (five targets) and Lit's own, all SIX targets
 * now have a real-fixture, real-compile-pipeline dispatch proof.
 *
 * `DynamicSlots.rozie` / `DynamicSlotsConsumer.rozie` were, at this file's
 * authoring time, parked at `tests/fixtures/pending-79/` and deliberately
 * NOT registered in `tests/dist-parity/scripts/bootstrap-fixtures.mjs`, so
 * the positive proof for this plan was this direct `compile()` assertion
 * rather than dist-parity. 79-13 Task 1 `git mv`'d the pair into
 * `examples/` (D-10's final home, now that all six targets compile it) AND
 * registered it in dist-parity — this file's fixture-path constant was
 * updated in the SAME 79-13 commit as that move to avoid an ENOENT
 * regression; this file's OWN direct-compile() assertion is retained
 * unchanged (dist-parity registration doesn't replace it — this file
 * proves the underlying compile() diagnostics directly, dist-parity proves
 * byte-identity across entrypoints).
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
const DYNAMIC_SLOTS_DIR = resolve(HERE, '../../../examples');

const FOUR_TARGETS: CompileTarget[] = ['react', 'solid', 'svelte', 'vue', 'angular'];

function compileFixture(target: CompileTarget, name: string): string {
  const filename = resolve(DYNAMIC_SLOTS_DIR, `${name}.rozie`);
  const source = readFileSync(filename, 'utf8');
  const result = compile(source, { target, filename, resolverRoot: DYNAMIC_SLOTS_DIR });
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

describe('Phase 79 Plan 10/11 (R3/R5/D-09) — producer dispatch on React/Solid/Svelte/Vue/Angular', () => {
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
      if (target === 'angular') {
        // Angular's whole template is composed as a backtick JS template
        // literal, so a literal backtick/`${` inside the RENDERED markup is
        // escaped at the SOURCE level — the real emitted `.ts` text contains
        // a literal backslash before each backtick and `${`.
        expect(code).toContain('templates()?.[\\`cell-\\${col.key}\\`]');
        return;
      }
      // Phase 79 Plan 15 (bug fix) — this slot is declared INSIDE the r-for
      // it's keyed on (`col` is the loop variable), so the record lookup
      // CANNOT be hoisted into a top-level `$derived` (col doesn't exist at
      // script scope — that was a ReferenceError at runtime, caught by this
      // phase's own Docker VR run against examples/Table.rozie, a REAL
      // consumer this producer-only fixture doesn't have). The lookup is
      // inlined directly at the render site instead, inside the `{#each}`
      // block where `col` is in scope.
      expect(code).not.toMatch(/\$derived\(snippets\?\.\[`cell-\$\{col\.key\}`\]\)/);
      expect(code).toMatch(/\{#each columns as col[^}]*\}.*\(snippets\?\.\[`cell-\$\{col\.key\}`\]\)/s);
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
      if (target === 'angular') {
        expect(code).toContain('templates()?.[freeSlotName()]');
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

describe('Phase 79 Plan 10/11 (R5/D-09) — matchedFamily consumer routing on React/Solid/Svelte/Vue/Angular', () => {
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
    if (target === 'angular') {
      // cell-status/cell-score are hyphenated (non-identifier) names, so
      // they route through 79-05's pre-existing record-only STATIC path
      // (matchedFamily stays a no-op trigger here — it's already
      // non-identifier-shaped) into the SAME [templates]-getter mechanism
      // this plan's matchedFamily branch also uses for an identifier-shaped
      // family name. Both merge into ONE getter alongside the other two
      // record-path fills (cell-total, the consumer dynamic fill below).
      expect(code).toMatch(/\[templates\]="templates"/);
      expect(code).toMatch(/get templates\(\): Record<string, TemplateRef<unknown>>/);
      expect(code).toMatch(/\['cell-status'\]: this\.__dynSlot_\d+!/);
      expect(code).toMatch(/\['cell-score'\]: this\.__dynSlot_\d+!/);
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
    if (target === 'angular') {
      // Class-body key form (prefixThis:true) — the dynamic fill's own
      // isDynamic branch (79-05/07.3.2.1, pre-existing), merged into the
      // SAME getter as the matchedFamily/record-only fills above.
      expect(code).toMatch(/\[this\.dynamicFillKey\(\)\]: this\.__dynSlot_\d+!/);
      return;
    }
    expect(code).toMatch(/slots=\{\{|snippets=\{\{/);
  });

  it('angular: exactly ONE [templates] binding on the DynamicSlots consumer tag — all four record-path fills merge into one getter, none dropped', () => {
    const code = consumerCode.angular!;
    const bindingCount = (code.match(/\[templates\]="templates"/g) ?? []).length;
    expect(bindingCount).toBe(1);
    const getterMatch = code.match(/get templates\(\): Record<string, TemplateRef<unknown>> \{[\s\S]*?\}/);
    expect(getterMatch).not.toBeNull();
    const getterBody = getterMatch![0];
    expect(getterBody).toContain("['cell-status']:");
    expect(getterBody).toContain("['cell-score']:");
    expect(getterBody).toContain("['cell-total']:");
    expect(getterBody).toContain('[this.dynamicFillKey()]:');
  });
});
