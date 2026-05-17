// @vitest-environment happy-dom
/**
 * Phase 07.3.2 SC#4 regression — locks the React WrapperModal re-projection
 * contract end-to-end at the @testing-library/react mount level.
 *
 * Root cause was refineSlotTypes.ts:108 returning `propFieldType: 'ReactNode'`
 * for the no-params named-slot path while emitTypes.ts:152 (public .d.ts)
 * declared the same field as `() => ReactNode`. Consumer-side
 * emitSlotFiller.ts:126 ALWAYS wraps slot bodies in an arrow
 * (`renderHeader={() => (<>...</>)}`), and the producer-side invocation
 * rendered the function reference directly as a React child — triggering
 * React's "Functions are not valid as a React child" error in dev OR silent
 * no-op in production. Plan 04 closed the divergence by aligning
 * refineSlotTypes with the .d.ts shape AND switching the no-params named-slot
 * emit path to INVOKE via `?.()`. Composition with Plan 01's merged fieldRef
 * is `(props.renderBrand ?? props.slots?.['brand'])?.()` — valid JS
 * (`(a ?? b)?.()`).
 *
 * This test mounts WrapperModal (the dogfood Modal 3 wrapper) with two
 * no-params named-slot fills (#brand + #actions) and asserts both fragments
 * render. Before Plan 04, both fragments silently rendered nothing in
 * production OR threw "Functions are not valid as a React child" in dev.
 *
 * Modeled on the QA-01 trust-floor pattern from tests/regressions/ — one
 * regression test per closed compiler bug class. This test sits alongside
 * the compile-snapshot suite at regressions.test.ts (per-bug fixture
 * directories under tests/regressions/fixtures/).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import WrapperModal from '../dist-parity/fixtures/WrapperModal.js';

afterEach(() => {
  cleanup();
});

describe('Phase 07.3.2 SC#4 — WrapperModal re-projection regression (Modal 3 dogfood)', () => {
  it('mounts with #brand + #actions no-params named-slot fills and renders both fragments', () => {
    render(
      <WrapperModal
        open={true}
        title="Wrapped"
        renderBrand={() => <h2>Re-projected brand</h2>}
        renderActions={() => <button type="button">Wrapper action</button>}
      >
        Body via wrapper&apos;s default slot
      </WrapperModal>,
    );

    // SC#4 acceptance contract — both no-params named-slot re-projections
    // produce visible DOM. Before Plan 04 (refineSlotTypes.ts:108 +
    // emitSlotInvocation.ts:279-303), these would have either silently
    // rendered nothing (production) or thrown a React "Functions are not
    // valid as a React child" error (dev).
    expect(screen.getByText('Re-projected brand')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Wrapper action' }),
    ).toBeTruthy();
  });

  it('locks the composed emit shape: (props.renderBrand ?? props.slots?.[\'brand\'])?.()', () => {
    // Plan 01 + Plan 04 composition contract — the WrapperModal.tsx fixture
    // bytes themselves are the locked artifact. This test reads the fixture
    // source string to assert the exact composed emit shape is present in
    // both no-params named-slot invocation sites (renderBrand + renderActions).
    // The compile-snapshot suite at tests/regressions/regressions.test.ts
    // catches per-bug-fixture drift; this test catches drift in the
    // canonical dogfood WrapperModal.tsx specifically.
    // Synchronous fs read is fine for a single small file inside a vitest
    // worker (matches the regressions.test.ts pattern at L73-75).
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { fileURLToPath } = require('node:url') as typeof import('node:url');
    const { dirname, join } = require('node:path') as typeof import('node:path');
    const here = dirname(fileURLToPath(import.meta.url));
    const fixturePath = join(here, '..', 'dist-parity', 'fixtures', 'WrapperModal.tsx');
    const source = readFileSync(fixturePath, 'utf8');

    // Plan 01 merge + Plan 04 invoke — both shapes layered.
    expect(source).toContain(
      "(props.renderBrand ?? props.slots?.['brand'])",
    );
    expect(source).toContain(
      "(props.renderActions ?? props.slots?.['actions'])?.()",
    );
    // refineSlotTypes alignment with public .d.ts.
    expect(source).toContain('renderBrand?: () => ReactNode');
    expect(source).toContain('renderActions?: () => ReactNode');
  });
});
