/**
 * resizeMath — the pure clamp / percent-from-pointer arithmetic for Resizable.
 *
 * Extracted to `src/internal/` (vendored into every leaf by codegen's
 * `copyInternal`, excluding `*.test.ts`) so the only branchy math in the family
 * is unit-tested ONCE and shared verbatim by all six targets. No DOM, no
 * framework — pure functions over numbers, so they typecheck and behave
 * identically wherever the emitter inlines the leaf.
 *
 * `size` is the percent width (horizontal) / height (vertical) of the FIRST
 * panel; the handle drag converts a pointer position within the container rect
 * into that percent, then clamps it to `[min, max]`.
 */

/** Clamp `raw` into `[min, max]`, guarding non-finite input (→ min). */
export function clampPercent(raw: number, min: number, max: number): number {
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) ? max : 100;
  if (!Number.isFinite(raw)) return lo;
  if (raw < lo) return lo;
  if (raw > hi) return hi;
  return raw;
}

/**
 * Convert a pointer coordinate into a first-panel percent of the container.
 *
 * @param pointer the client coordinate along the drag axis (clientX horizontal,
 *   clientY vertical)
 * @param start   the container's leading edge along that axis (rect.left /
 *   rect.top)
 * @param extent  the container's size along that axis (rect.width / rect.height)
 *
 * A zero/negative extent (unmeasured / detached) yields 0 rather than NaN.
 */
export function percentFromPointer(pointer: number, start: number, extent: number): number {
  if (!Number.isFinite(extent) || extent <= 0) return 0;
  const p = ((pointer - start) / extent) * 100;
  if (!Number.isFinite(p)) return 0;
  return p;
}

/**
 * Nudge `size` by `delta` percent and clamp — the Arrow-key step. A positive
 * delta grows the first panel.
 */
export function nudge(size: number, delta: number, min: number, max: number): number {
  const base = Number.isFinite(size) ? size : min;
  return clampPercent(base + delta, min, max);
}
