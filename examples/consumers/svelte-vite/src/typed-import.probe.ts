/**
 * typed-import.probe.ts — Phase 22 REQ-9 prop-typo probe (Svelte).
 *
 * Proves the per-module `Counter.d.rozie.ts` sidecar resolves under
 * `tsc --noEmit` + svelte-check (NOT a wildcard shadow) by asserting:
 *   1. a correct prop usage typechecks, and
 *   2. a wrong-typed prop is a genuine TS error.
 *
 * Per SPIKE-FINDINGS, Svelte honors the sidecar ONLY with
 * `allowArbitraryExtensions: true` (set in tsconfig.json); without it the
 * wildcard shadows the sidecar (TS2614). The `@ts-expect-error` line FAILS
 * `tsc --noEmit` if the error does NOT occur (reported UNUSED) — the
 * T-22-06-01 type-lying guard.
 *
 * `verbatimModuleSyntax: true` is on, so the props interface is imported with
 * the inline `type` modifier. Picked up by the demo's `tsc --noEmit`
 * (include: src/**\/*.ts). Never executed.
 */
import Counter, { type CounterProps } from './Counter.rozie';

// 1. Correct usage — the sidecar's `CounterProps` is honored.
const ok: CounterProps = { value: 1, step: 2, min: 0, max: 10 };
void ok;

// 2. Wrong-typed prop — `value` is `number`, a string must error.
// @ts-expect-error value is typed `number` by the Counter sidecar — a string is a type error.
const wrongType: CounterProps = { value: 'not-a-number' };
void wrongType;

// The default export is the typed Svelte component (anchors the import).
void Counter;
