/**
 * slot-family-fallback-precedence.test.tsx — Phase 88 Plan 01 Task 1
 * behavioral proof (D-08 layer 2).
 *
 * Mounts the checked-in `SlotFamilyFallbackProbe.compiled.tsx` (real
 * emitter output — see its header for the compiled `.rozie` source) and
 * drives the D-06 graceful-degradation contract end to end: pass a
 * NON-FUNCTION `slots` record entry for one column (`cell-price`) and
 * supply NO generic `#cell` fill. The passed node must render — it must
 * NOT throw a TypeError, and it must NOT silently fall through to the
 * built-in `rozieDisplay(value)` render.
 *
 * Pre-fix (D-06): `props.slots?.['cell-price'] ?? (props.renderCell ??
 * props.slots?.['cell']) ? (...) : rozieDisplay(col.value)` mis-parses as
 * `(A ?? cond) ? x : y` — since `A` (the passed node) is truthy, `A ?? cond`
 * short-circuits to `A` (truthy), so the ternary's TRUE branch fires:
 * `((props.renderCell ?? props.slots?.['cell']) as Function)(...)` — calling
 * `undefined` as a function. `render()` throws synchronously.
 *
 * Post-fix: `A ?? (cond ? x : y)` short-circuits on `A` truthy and renders
 * the passed node directly, no throw.
 *
 * Static import (a dynamic `await import()` inside `it()` starves the cold
 * TS transform under turbo's parallel runs — see `mount-computed-live.test.tsx`'s
 * note, and the `@testing-library/react` + happy-dom harness copied from
 * the same file).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import SlotFamilyFallbackProbe from './integration/SlotFamilyFallbackProbe.compiled.js';

afterEach(() => {
  cleanup();
});

const COLUMNS = [{ key: 'price', value: 42 }];

// Deliberately off-type per D-08: a real React node, not the
// `(params) => ReactNode` shape the emitted `slots?:` type declares. The
// whole point of this probe is that the RUNTIME must degrade gracefully
// when a consumer passes this shape — `tests/` is excluded from this
// package's `tsc --noEmit` project (tsconfig.json), so this intentional
// off-type value never trips the repo-wide typecheck gate.
const NON_FUNCTION_SLOT_FILL = (
  <span data-testid="custom-cell">Custom!</span>
) as unknown as (params: { value: unknown }) => React.ReactNode;

describe('SlotFamilyFallbackProbe (React) — Phase 88 Plan 01 D-06/D-08', () => {
  it('a non-function `slots` entry with no generic fill renders the passed node instead of throwing', () => {
    expect(() =>
      render(
        <SlotFamilyFallbackProbe
          columns={COLUMNS}
          slots={{ 'cell-price': NON_FUNCTION_SLOT_FILL }}
        />,
      ),
    ).not.toThrow();

    expect(document.querySelector('[data-testid="custom-cell"]')?.textContent).toBe('Custom!');
    // The generic built-in fallback (`rozieDisplay(col.value)`, i.e. the raw
    // "42") must NOT have rendered instead of the passed node.
    expect(document.querySelector('[data-testid="row"]')?.textContent).toBe('Custom!');
  });
});
