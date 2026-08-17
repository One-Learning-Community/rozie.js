/**
 * Plan 79-05 Task 3 — cross-target compile proof for R12/D-03's routing.
 *
 * With 79-03 (Vue), 79-04 (React, Solid) and this plan (Svelte, Angular)
 * landed, a non-identifier (kebab) slot name compiles clean on FIVE of the
 * six targets. Lit's half is deferred to 79-09 (Lit has no bracket-keyed
 * record surface until `rozieSlots` exists) — asserted below as a live,
 * visible gap rather than left silently untested.
 *
 * Scope note (why this is a TRIMMED fixture, not the literal
 * `tests/fixtures/pending-79/DynamicSlots.rozie` pair the plan names):
 * `DynamicSlots.rozie` ALSO exercises R1's dynamic `:name="..."` slot-name
 * binding (the `cell-${col.key}` family slot and the `$data.freeSlotName`
 * free-dynamic slot) — that IR support lands in 79-06, and family/exact-name
 * matching lands in 79-07. Neither has run yet at this point in the phase
 * (this plan, 79-05, is wave 4; 79-06/79-07 are later waves), so compiling
 * the FULL fixture would fail on every target regardless of R12's status —
 * that would not be evidence of R12 shipping, it would be evidence of R1 not
 * shipping yet. This fixture instead isolates exactly the two STATIC slots
 * `DynamicSlots.rozie` also carries — `cell-total` (R12/AC-21's non-identifier
 * case) and `headerCell` (the byte-identity control) — reproducing the same
 * names/params so this test becomes a true subset once 79-13 moves the real
 * pair into `examples/`.
 */
import { describe, it, expect } from 'vitest';
import { compile, type CompileTarget } from '../src/index.js';

const FIVE_TARGETS: CompileTarget[] = ['react', 'vue', 'solid', 'svelte', 'angular'];

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
       before 79-03/79-04/this plan; after 79-03..79-05 it routes through the
       bracket-keyed record on five of six targets. -->
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

describe('Phase 79 R12/D-03 — non-identifier slot name compiles on five of six targets', () => {
  it.each(FIVE_TARGETS)('%s compiles the cell-total producer with zero error-severity diagnostics', (target) => {
    const result = compile(PRODUCER, { target, filename: 'Cell.rozie' });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors, `${target} compile errors: ${JSON.stringify(errors)}`).toHaveLength(0);
    expect(result.code).not.toBe('');
  });

  it('Lit still cannot emit a valid non-identifier slot binding (deferred to 79-09)', () => {
    // Lit has no bracket-keyed record surface until `rozieSlots` lands in
    // 79-09 — ROZ127's identifier-shape check was retired phase-wide in
    // 79-01/79-03 with NO replacement diagnostic (D-05), so Lit's emitter
    // does not raise an error diagnostic for this fixture either; it
    // silently mints invalid TypeScript containing a bare hyphen in
    // identifier position (e.g. `private cell-total?: ...`). Asserting that
    // shape (rather than a diagnostics-level error) is the honest way to
    // keep this gap visible until 79-09 closes it.
    const result = compile(PRODUCER, { target: 'lit', filename: 'Cell.rozie' });
    expect(result.code).toMatch(/cell-total/);
    // A valid TS identifier can never contain a hyphen — this is the
    // syntax-break signature of the still-open gap.
    expect(result.code).toMatch(/\bcell-total\??\s*[:?]/);
  });
});
