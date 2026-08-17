/**
 * Plan 79-05 Task 3 (origin) / Plan 79-09 Task 3 (this update) — cross-target
 * compile proof for R12/D-03's routing, now closing on ALL SIX targets.
 *
 * With 79-03 (Vue), 79-04 (React, Solid), 79-05 (Svelte, Angular), and this
 * plan (Lit) landed, a non-identifier (kebab) slot name compiles clean on
 * SIX of six targets — R12 complete. Lit's half was deferred at 79-05's
 * authoring time (Lit had no bracket-keyed record surface until `rozieSlots`
 * landed in 79-08/79-09) and is asserted here as CLOSED rather than left as
 * a permanently-red "still cannot emit" assertion contradicting the other
 * five targets' green.
 *
 * Scope note (why the FIVE_TARGETS block below is still a TRIMMED fixture,
 * not the literal `examples/DynamicSlots.rozie` pair):
 * `DynamicSlots.rozie` ALSO exercises R1's dynamic `:name="..."` slot-name
 * binding (the `cell-${col.key}` family slot and the `$data.freeSlotName`
 * free-dynamic slot). Family-matched / dynamic-name PRODUCER DISPATCH on
 * React/Vue/Solid/Svelte/Angular is deferred to later waves (79-10..79-12
 * per `79-KNOWN-RED-BASELINE.md` — "the per-target producer dispatch
 * (79-08 → 79-11) have not landed" for those five targets); this plan is
 * Lit-only. The trimmed `PRODUCER` fixture below therefore stays scoped to
 * R12's actual claim — a non-identifier STATIC slot name compiles clean,
 * with zero error diagnostics, on all six targets — independent of the
 * dynamic-name dispatch wiring those other five targets don't have yet.
 *
 * The SIX_TARGET_R12_AND_DYNAMIC block further down separately proves the
 * full `examples/DynamicSlots.rozie` PRODUCER (which also carries the two
 * dynamic-name slots) compiles with zero error diagnostics on all six
 * targets standalone (no consumer needed for a compile-cleanliness claim —
 * D-05 makes a non-constant-fold `:name` binding legal with no diagnostic
 * on every target, whether or not that target's producer-side dispatch is
 * fully wired yet).
 *
 * Path note (79-13): `DynamicSlots.rozie`/`DynamicSlotsConsumer.rozie` were
 * `git mv`'d from `tests/fixtures/pending-79/` into `examples/` by 79-13
 * Task 1 (D-10's final home, now that all six targets compile it) — this
 * file's fixture-path constant was updated in the SAME commit as that move
 * to avoid an ENOENT regression.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, type CompileTarget } from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DYNAMIC_SLOTS_DIR = resolve(HERE, '../../../examples');

const SIX_TARGETS: CompileTarget[] = ['react', 'vue', 'solid', 'svelte', 'angular', 'lit'];

const PRODUCER = `
<rozie name="Cell">
<props>
{
  total:   { type: Number, default: 0 },
  heading: { type: String, default: 'Header' },
}
</props>
<template>
<div class="dynamic-slots">
  <!-- R12/AC-21: static kebab-named slot — a hard ROZ127 error on 6/6 targets
       before 79-03/79-04/79-05; after 79-03..79-05 (five targets) and this
       plan (Lit, the sixth) it routes through the bracket-keyed record on
       ALL six targets. -->
  <slot name="cell-total" :value="$props.total">
    <strong>{{ $props.total }}</strong>
  </slot>

  <!-- Byte-identity control (AC-22): a static identifier-named slot; nothing
       this phase does may perturb its emitted output on any target. -->
  <slot name="headerCell" :title="$props.heading">
    <h2>{{ $props.heading }}</h2>
  </slot>
</div>
</template>
</rozie>
`;

describe('Phase 79 R12/D-03 — non-identifier slot name compiles clean on ALL SIX targets', () => {
  it.each(SIX_TARGETS)('%s compiles the cell-total producer with zero error-severity diagnostics', (target) => {
    const result = compile(PRODUCER, { target, filename: 'Cell.rozie' });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors, `${target} compile errors: ${JSON.stringify(errors)}`).toHaveLength(0);
    expect(result.code).not.toBe('');
  });

  it('Lit emits a VALID (identifier-free) rozieSlots record binding for the non-identifier slot name — the ❌ this plan fixes', () => {
    // Prior to 79-09, Lit minted a bare `cell-total?: ...` class-member —
    // never valid TS (a hyphen cannot appear in identifier position). Now it
    // routes through `this.rozieSlots?.['cell-total']` — a legal, quoted
    // string-literal bracket access — and mints NO named class member for
    // the non-identifier name at all.
    const result = compile(PRODUCER, { target: 'lit', filename: 'Cell.rozie' });
    expect(result.code).toContain("this.rozieSlots?.['cell-total']");
    // The syntax-break signature this test used to assert (a bare hyphen in
    // identifier position) must no longer appear anywhere in the output.
    expect(result.code).not.toMatch(/\bcell-total\??\s*[:?]/);
  });
});

describe('Phase 79 Plan 09 Task 3 — full DynamicSlots.rozie producer compiles clean on all six targets', () => {
  const source = readFileSync(resolve(DYNAMIC_SLOTS_DIR, 'DynamicSlots.rozie'), 'utf8');

  it.each(SIX_TARGETS)('%s compiles DynamicSlots.rozie (static + dynamic-name slots) with zero error-severity diagnostics', (target) => {
    const result = compile(source, {
      target,
      filename: resolve(DYNAMIC_SLOTS_DIR, 'DynamicSlots.rozie'),
      resolverRoot: DYNAMIC_SLOTS_DIR,
    });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors, `${target} compile errors: ${JSON.stringify(errors)}`).toHaveLength(0);
    expect(result.code).not.toBe('');
  });
});
