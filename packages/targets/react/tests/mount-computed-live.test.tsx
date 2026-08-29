/**
 * mount-computed-live.test.tsx — Quick 260829-8lz behavioral proof.
 *
 * Mounts the checked-in `MountComputedProbe.compiled.tsx` (real emitter
 * output — see its header for the compiled `.rozie` source) and drives the
 * runtime defect end to end:
 *
 *   1. Click "bump" — moves `tick` (and therefore the `useMemo`-derived
 *      `doubled`) from 0 to 2, visible immediately via `data-testid="doubled"`.
 *   2. Click "invoke" — this calls `read.current()`, the SAME closure that
 *      was assigned ONCE inside the `[]`-dep mount `useEffect`. Its body
 *      reads `doubled` bare pre-fix (frozen at the first render's value, 0),
 *      or `_doubledRef.current` post-fix (the current value, 2).
 *
 * Pre-fix: `data-testid="observed"` stays "0" after both clicks — the mount
 * closure never saw the recomputed `doubled`. Post-fix: it becomes "2".
 *
 * Static imports (a dynamic `await import()` inside `it()` starves the cold
 * TS transform under turbo's parallel runs — see `treenode-mount.test.ts`'s
 * note, and the `@testing-library/react` + happy-dom harness copied from the
 * same file).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import MountComputedProbe from './integration/MountComputedProbe.compiled.js';

afterEach(() => {
  cleanup();
});

describe('MountComputedProbe (React) — Quick 260829-8lz', () => {
  it('a computed read from a $onMount-registered callback observes the CURRENT value, not the first render\'s frozen snapshot', () => {
    const { getByTestId } = render(<MountComputedProbe />);

    expect(getByTestId('tick').textContent).toBe('0');
    expect(getByTestId('doubled').textContent).toBe('0');
    expect(getByTestId('observed').textContent).toBe('0');

    // Move tick (and therefore `doubled`) away from its mount-time value.
    fireEvent.click(getByTestId('bump'));
    expect(getByTestId('tick').textContent).toBe('1');
    expect(getByTestId('doubled').textContent).toBe('2');
    // `observed` is untouched by the click itself — it only moves when the
    // mount-registered closure is invoked.
    expect(getByTestId('observed').textContent).toBe('0');

    // Invoke the SAME closure the mount effect registered once.
    fireEvent.click(getByTestId('invoke'));

    // Pre-fix this reads the FROZEN `doubled` (0). Post-fix it reads the
    // LIVE value (2) via `_doubledRef.current`.
    expect(getByTestId('observed').textContent).toBe('2');
  });
});
