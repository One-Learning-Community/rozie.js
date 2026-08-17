// @vitest-environment happy-dom
/**
 * Phase 79 Plan 13 (AC-N2 Layer 2) — React DOM-mount behavioural assertion
 * proving a PRODUCER-declared dynamic slot name resolves end-to-end at
 * runtime.
 *
 * Mirrors `dynamic-name-slot-bridge.test.tsx` structurally and exactly: same
 * `@vitest-environment happy-dom` pragma, same import style from
 * `../dist-parity/fixtures/`, same `afterEach(cleanup)`, same throwing
 * `screen` queries (the throw IS the failure signal, per that file's own
 * stated rule / REVIEW.md IN-05 — no truthiness-assertion no-ops).
 *
 * *Why React only?* `@testing-library/react` over an imported compiled
 * fixture is the only compiled-fixture mount harness this repository has
 * under `tests/regressions/`; there is no precedent (and no `R`-id
 * requiring) five more per-target mount harnesses. The other five targets'
 * runtime coverage comes from two other mechanisms already in the phase:
 * the six-target Docker VR `Table` cell (79-15) and dist-parity
 * byte-identity at 6 targets by 4 entrypoints over this SAME
 * `DynamicSlots`/`DynamicSlotsConsumer` pair (registered by Task 1 of this
 * plan). See 79-13-PLAN.md's "AC-N2 — behavioural-assertion scope" section.
 *
 * `examples/DynamicSlotsConsumer.rozie` (compiled by dist-parity's
 * bootstrap into `../dist-parity/fixtures/DynamicSlotsConsumer.tsx`, which
 * this test imports) fills every one of the producer's four slot shapes:
 *   - R5/AC-6 — two ordinary static-named-fill family matches against the
 *     producer's `cell-` family (`#cell-status`, `#cell-score`), resolved
 *     via `matchedFamily` — NOT the `#[expr]` dynamic-fill syntax.
 *   - AC-6 — the exact-wins static/family collision (`#cell-total`): a
 *     static slot name that ALSO falls inside the `cell-` family's
 *     prefix space; the static slot's own types/fill win.
 *   - the byte-identity control static identifier-named slot
 *     (`#headerCell`) — nothing this phase does may perturb it.
 *   - R1/AC-12 — a consumer-side `#[expr]` dynamic fill (Phase 07.3.2's
 *     pre-existing mechanism) targeting the producer's OWN no-static-prefix
 *     dynamic slot, exercising producer- and consumer-side dynamism
 *     together in one component.
 */
import { describe, it, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import DynamicSlotsConsumer from '../dist-parity/fixtures/DynamicSlotsConsumer.js';

afterEach(() => {
  cleanup();
});

describe('Phase 79 AC-N2 Layer 2 — DynamicSlotsConsumer end-to-end (producer-declared dynamic slot names)', () => {
  it('resolves every family-matched, exact-wins, control, and consumer-side-dynamic fill against the producer', () => {
    render(<DynamicSlotsConsumer />);

    // R5/AC-6 — family-matched fills against the producer's `cell-` family,
    // via ordinary static named-fill syntax; matchedFamily does the work.
    screen.getByText('Active');
    screen.getByText('42');

    // AC-6 — exact-wins: `cell-total` is a static slot on the producer AND
    // textually falls inside the `cell-` family's prefix space; the static
    // slot's own fill/types win over the family match.
    screen.getByText('7');

    // Byte-identity control fill, against the producer's static
    // identifier-named slot — untouched by this phase's dynamic-name work.
    screen.getByText('Header');

    // R1/AC-12 — consumer-side `#[expr]` dynamic fill (pre-existing
    // mechanism) resolving against the producer's OWN no-static-prefix
    // dynamic slot, exercised alongside producer-side dynamism.
    screen.getByText('freeform');
  });
});
