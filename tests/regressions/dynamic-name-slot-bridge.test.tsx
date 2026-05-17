// @vitest-environment happy-dom
/**
 * Phase 07.3.2 Plan 08 (F-07.3.2-05-A rows #1 + #2) regression — locks the
 * ModalConsumer end-to-end composition at the @testing-library/react mount
 * level.
 *
 * Catches the FULL runtime cascade the D-04 acceptance gate in
 * tests/visual-regression/specs/modal-consumer-close.spec.ts detects:
 *
 *   - Modal 2 — `<template #[$data.slotName]>` dynamic-name slot fill MUST
 *     render its `.dynamic-fill` span. Before Plan 08, the `r-if="$slots.header"`
 *     guard in Modal.rozie:79 short-circuited because the React rewriter
 *     emitted bare `props.renderHeader` (undefined for Modal 2 — only `slots`
 *     is passed). Plan 08's merged form
 *     `(props.renderHeader ?? props.slots?.['header'])` lets the guard
 *     evaluate truthy via the dynamic-name fallback.
 *
 *   - Modal 3 — WrapperModal forwards `<template #brand>` to inner Modal's
 *     header and `<template #actions>` to inner Modal's footer. The
 *     existing `wrapper-modal-reprojection.test.tsx` mounts WrapperModal in
 *     ISOLATION; this test mounts the FULL ModalConsumer (3 modals together)
 *     so the cross-modal composition is exercised. With Plan 04's `?.()`
 *     invocation form + Plan 07's zero-args type contract + Plan 08's guard
 *     merge, the WrapperModal re-projection cascade renders end-to-end.
 *
 * Mirrors the wrapper-modal-reprojection.test.tsx pattern exactly (same
 * imports, same afterEach cleanup, same describe shape) so test discovery
 * and reporting stay consistent across the regressions package.
 *
 * Per REVIEW.md IN-05, uses `screen.getByText` / `screen.getByRole` directly
 * (which throw on absence) instead of `expect(...).toBeTruthy()` (no-op).
 * The throw IS the failure signal.
 */
import { describe, it, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ModalConsumer from '../dist-parity/fixtures/ModalConsumer.js';

afterEach(() => {
  cleanup();
});

describe('Phase 07.3.2 F-07.3.2-05-A — ModalConsumer end-to-end (dynamic-fill + WrapperModal re-projection)', () => {
  it('renders all 3 modals together: Modal 1 static slots, Modal 2 dynamic-fill, Modal 3 WrapperModal re-projection', () => {
    render(<ModalConsumer title="Confirm" />);

    // Modal 2 — `<template #[$data.slotName]>` resolves at runtime to `header`.
    // Plan 08 fix: the r-if="$slots.header" guard now merges with
    // props.slots?.['header'], so `<header>` renders and the .dynamic-fill
    // span inside is visible.
    screen.getByText('Dynamic header via slotName');

    // Modal 3 — WrapperModal forwards <template #brand> to inner Modal's
    // header. With Plan 04's invocation form + Plan 07's zero-args type +
    // Plan 08's guard merge, the inner header guard now evaluates truthy
    // when WrapperModal passes a renderHeader arrow wrapping the brand fill.
    screen.getByText('Re-projected brand');

    // Modal 3 — WrapperModal forwards <template #actions> to inner Modal's
    // footer. Same cascade as above for the footer guard.
    screen.getByRole('button', { name: 'Wrapper action' });
  });
});
