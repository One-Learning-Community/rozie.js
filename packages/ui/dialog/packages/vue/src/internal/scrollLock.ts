// scrollLock.ts — a REF-COUNTED `<html>` scroll lock, shared by every `Dialog`
// instance compiled from this leaf's module (module-scope state — a plain
// per-instance toggle would unlock scrolling the moment ANY dialog closes,
// even while an OUTER dialog is still open — nested/stacked dialogs).
//
// The lock only actually applies on the 0 -> 1 transition and only actually
// releases on the 1 -> 0 transition. The ORIGINAL inline `overflow` value
// (captured on that first lock, not a hardcoded `''`) is restored when the
// count drops back to zero, so a page that already set its own inline
// `overflow` isn't clobbered by the second (or third...) dialog to close.
//
// Vendored (byte-identical) into every `@rozie-ui/dialog-*` leaf's
// `src/internal/` by `scripts/codegen.mjs`, unit-tested once here — the same
// "branchy, non-reactive helper -> src/internal" convention as the resizable
// family's `resizeMath.ts`.
let lockCount = 0;
let previousOverflow: string | null = null;

export function applyScrollLock(lock: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!root) return;

  if (lock) {
    if (lockCount === 0) {
      previousOverflow = root.style.overflow;
      root.style.overflow = 'hidden';
    }
    lockCount += 1;
    return;
  }

  // Guard against an unbalanced release (a lock() that was never applied,
  // e.g. because `disableScrollLock` was toggled mid-flight) — never let the
  // count go negative, which would require two extra locks to re-lock.
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    root.style.overflow = previousOverflow ?? '';
    previousOverflow = null;
  }
}

/** Test-only: reset the module-level counter between test cases. */
export function _resetScrollLockForTests(): void {
  lockCount = 0;
  previousOverflow = null;
}
