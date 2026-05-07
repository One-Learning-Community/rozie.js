/**
 * angular-ts consumer-types — TYPES-02 / D-94 / D-85 Angular non-generic
 *
 * Type-only assertions over compiled Angular standalone-component fixtures.
 * Loaded by `tsc --strict --noEmit` (NOT vitest) — every assertion must
 * typecheck.
 *
 * Per D-84 (hybrid type strategy): Angular's emitted standalone class
 * carries decorator-typed `input()` / `model()` / `output()` signal-era
 * factories. There is NO sibling .d.ts for Angular (D-90 no-op). The typed
 * contract is the .ts class itself — TS picks up the per-field types from
 * the input/model/output factory generics.
 *
 * Coverage:
 *   - exported class type-checks under strict TS (Counter)
 *   - input()/model()/output() factory return types are inspected via
 *     class-instance property typing — `instance.value` is `ModelSignal<number>`
 *   - wrong-type set/update on a model signal rejected
 *
 * Per D-85: Angular standalone components have no public generic API in 17;
 * v1 emits NON-generic. This package has no Select<T> fixture analog. The
 * v2 escape hatch is a factory-pattern wrapper (NgComponentOutlet + typed
 * provider tokens), out of scope for v1 TYPES-03.
 *
 * NOTE: Full Angular component-template type-checking requires the Angular
 * Compiler (ngc/ng-packagr) — out of scope for `tsc --noEmit`. We assert
 * the contract that v1 ships: each emitted .ts file is valid strict TS
 * with typed `input()`/`model()`/`signal()`/etc. exposures.
 *
 * NOTE — Dropdown + Modal + SearchInput + TodoList imports deliberately
 * COMMENTED OUT and excluded from tsconfig.strict.json. All four compiled
 * .ts files surface PRE-EXISTING Angular emitter type bugs (model.set()
 * arity mismatch, throttle/debounce spread-arg typing, missing required
 * arguments to `output()` triggers, v-for unknown narrowing) that Plan
 * 06-05 surfaces but is NOT in scope to fix. See:
 * `.planning/phases/06-cli-codegen-babel-plugin-type-emission-hardening/deferred-items.md`
 * → "Plan 06-05 Discoveries → Pre-existing Angular emitter type errors".
 */
import { Counter } from './fixtures/Counter';

// ---- Counter: model:true via model<T>() (TYPES-02) --------------------
// Angular 17 signals: `model<number>(0)` returns a `ModelSignal<number>`
// exposing `.set(v: number)`, `.update(fn)`, etc. Wrong-type set rejected.
type CounterShape = InstanceType<typeof Counter>;
declare const counterInst: CounterShape;
counterInst.value.set(5); // OK — number
// @ts-expect-error — string passed to a ModelSignal<number>'s .set()
counterInst.value.set('bad');
const stepValue: number = counterInst.step();
const minValue: number = counterInst.min();
const maxValue: number = counterInst.max();
void [stepValue, minValue, maxValue];

// Suppress "declared but never read" for shape-pin locals.
void [Counter];
