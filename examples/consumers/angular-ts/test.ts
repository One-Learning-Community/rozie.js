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
 * Previously the Angular emit had pre-existing type bugs (model.set()
 * arity mismatch, throttle/debounce spread-arg typing, missing required
 * arguments to `output()` triggers, r-for unknown narrowing) that forced
 * Dropdown/Modal/SearchInput/TodoList exclusion. The watcher-arity and
 * slot-context bugs were fixed during the 2026-05-18 Angular tsc gate
 * rollout (commit 0fbd6f1); the remaining classes (renderType widening,
 * removeEventListener options, handler-cast) were fixed across targets
 * in commits 536575a / d3fd6b4 / 6b50a15. All four fixtures now
 * typecheck cleanly and are pinned below alongside Counter.
 */
import { Counter } from './fixtures/Counter';
import { Dropdown } from './fixtures/Dropdown';
import { Modal } from './fixtures/Modal';
import { SearchInput } from './fixtures/SearchInput';
import { TodoList } from './fixtures/TodoList';

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
void [Counter, Dropdown, Modal, SearchInput, TodoList];
