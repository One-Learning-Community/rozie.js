/**
 * typed-import.probe.tsx — Phase 22 REQ-9 prop-typo probe (React).
 *
 * Proves the per-module `Counter.d.rozie.ts` sidecar resolves (NOT the demoted
 * `*.rozie` wildcard fallback) by asserting:
 *   1. a correct prop usage typechecks, and
 *   2. a misspelled / wrong-typed prop is a genuine TS error.
 *
 * The `@ts-expect-error` line FAILS the build if the error does NOT occur — so
 * if the wildcard shim shadowed the sidecar (making every prop `unknown`), the
 * directive would be reported UNUSED and `tsc --noEmit` would exit non-zero.
 * That is the type-lying guard (T-22-06-01).
 *
 * This file is picked up by the demo's `tsc --noEmit` (include: src/**\/*).
 * It is never imported at runtime.
 */
import Counter, { type CounterProps } from './Counter.rozie';

// 1. Correct usage — the sidecar's `CounterProps` is honored.
const ok: CounterProps = { value: 1, step: 2, min: 0, max: 10 };
void ok;

// 2. Wrong-typed prop — `value` is `number`, a string must error.
// @ts-expect-error value is typed `number` by the Counter sidecar — a string is a type error.
const wrongType: CounterProps = { value: 'not-a-number' };
void wrongType;

// The default export is the typed component (used here only to anchor the import).
void Counter;
