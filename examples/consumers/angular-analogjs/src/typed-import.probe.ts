/**
 * typed-import.probe.ts — Phase 22 REQ-9 prop-typo probe (Angular).
 *
 * Proves the per-module `Counter.d.rozie.ts` sidecar resolves under
 * `tsc --noEmit` (typescript ~5.9.3, NOT a wildcard shadow) by asserting:
 *   1. a correct prop usage typechecks against the named `CounterProps`, and
 *   2. a wrong-typed prop is a genuine TS error.
 *
 * Per SPIKE-FINDINGS, Angular honors the sidecar ONLY with
 * `allowArbitraryExtensions: true` (set in tsconfig.json); without it the
 * wildcard shadows the sidecar (TS2614). The sidecar's named `CounterProps` is
 * the export the Angular disk-cache `.rozie.ts` LACKS — so resolving it here is
 * the proof the sidecar (not the disk-cache, not a wildcard) supplies the prop
 * types. The `@ts-expect-error` line FAILS `tsc --noEmit` if the error does NOT
 * occur (reported UNUSED) — the T-22-06-01 type-lying guard.
 *
 * Picked up by the demo's `tsc --noEmit` (include: src/**\/*.ts). Never run.
 */
import type { CounterProps } from './Counter.rozie';

// 1. Correct usage — the sidecar's named `CounterProps` is honored.
const ok: CounterProps = { value: 1, step: 2, min: 0, max: 10 };
void ok;

// 2. Wrong-typed prop — `value` is `number`, a string must error.
// @ts-expect-error value is typed `number` by the Counter sidecar — a string is a type error.
const wrongType: CounterProps = { value: 'not-a-number' };
void wrongType;
