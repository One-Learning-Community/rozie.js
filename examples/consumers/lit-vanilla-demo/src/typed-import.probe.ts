/**
 * typed-import.probe.ts — Phase 22 REQ-9 prop-typo probe (Lit).
 *
 * Lit consumers use `.rozie` as SIDE-EFFECT imports (the compiled
 * `@customElement('rozie-counter')` registers the element at module load).
 * The per-module `Counter.d.rozie.ts` sidecar's payoff is twofold:
 *   - a `declare global { interface HTMLElementTagNameMap { 'rozie-counter': Counter } }`
 *     entry — `document.querySelector('rozie-counter')` is typed as the
 *     `Counter` element (NOT the generic `Element | null`), and
 *   - the named `CounterProps` interface (REQ-1 props proof).
 *
 * Proves the sidecar (NOT a wildcard shadow) resolves:
 *   1. correct usage — `querySelector('rozie-counter')` IS the `Counter`
 *      element (assignable to `Counter | null` ONLY because the augmented tag
 *      map loaded; a wildcard shadow yields `Element | null`, which would make
 *      THIS line error), and a correct `CounterProps` object typechecks.
 *   2. a wrong-typed prop — `value` is `number`, a string must error.
 *
 * The `@ts-expect-error` line FAILS `tsc --noEmit` if the error does NOT occur
 * (reported UNUSED) — the T-22-06-01 type-lying guard.
 *
 * Picked up by the demo's `tsc --noEmit` (include: src/**\/*). Never executed.
 */
import './rozie/Counter.rozie';
import type Counter from './rozie/Counter.rozie';
import type { CounterProps } from './rozie/Counter.rozie';

// 1a. Augmented tag-map proof — `querySelector('rozie-counter')` is the typed
// `Counter` element. A wildcard shadow (tag map NOT augmented) would type this
// `Element | null` and THIS assignment to `Counter | null` would itself error.
const counter: Counter | null = document.querySelector('rozie-counter');
void counter;

// 1b. Correct props usage — the sidecar's `CounterProps` is honored.
const ok: CounterProps = { value: 1, step: 2, min: 0, max: 10 };
void ok;

// 2. Wrong-typed prop — `value` is `number`, a string must error.
// @ts-expect-error value is typed `number` by the Counter sidecar — a string is a type error.
const wrongType: CounterProps = { value: 'not-a-number' };
void wrongType;
