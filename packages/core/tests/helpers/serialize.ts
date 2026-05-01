/**
 * Snapshot serialization helpers for parser tests.
 *
 * Babel ASTs carry parent pointers, internal `tokens` arrays, and `extra`
 * fields that are noisy and circular for snapshot purposes. `stripCircular`
 * filters them out, plus de-duplicates any other circular references with a
 * WeakSet so JSON.stringify doesn't throw.
 *
 * Used by Task 5 of Plan 01-03: per-block fixture snapshots at
 * `packages/core/fixtures/blocks/{example}-{blockType}.snap`.
 */

const NOISE_KEYS = new Set([
  // Babel-internal noise
  'parent',
  'extra',
  'tokens',
  'errors', // diagnostics surface lifted errors via the parser layer; raw Babel errors clutter snapshots
  'innerComments',
]);

export function stripCircular(value: unknown): unknown {
  const seen = new WeakSet<object>();
  return JSON.parse(
    JSON.stringify(value, (key, v) => {
      if (NOISE_KEYS.has(key)) return undefined;
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v as object)) return undefined;
        seen.add(v as object);
      }
      return v;
    }),
  );
}
