/**
 * `rozieModel` — the two-way (`model: true`) prop of a compiled Rozie component,
 * with the controlled / uncontrolled rule the React, Solid and Lit targets use.
 *
 * The component declares the public pair itself — an input (aliased to the prop
 * name) and its `<name>Change` output, which is what `[(value)]` binds — and
 * reads and writes the prop through the signal this returns:
 *
 *  - CONTROLLED (the input holds a value other than `undefined`): the signal
 *    reads the input. A write only emits `<name>Change`; what the control shows
 *    stays the consumer's value until the consumer sends a new one. A consumer
 *    that refuses a change — a one-way `[value]`, or a two-way `[(value)]`
 *    whose handler puts the old value back — keeps the control on its value.
 *  - UNCONTROLLED (no value bound): the signal reads local state, which a write
 *    updates before emitting.
 *
 * Angular's own `model()` cannot do the first: its `set()` always updates the
 * local value, and Angular pushes a bound value down only when it differs from
 * the one it pushed last, so a refused write stayed on screen.
 *
 * The returned function keeps the public shape `model()` gave the field — a
 * `ModelSignal`: callable, `set` / `update` / `asReadonly`, and `subscribe`
 * (delegated to the `<name>Change` output). It carries the computed's signal
 * node, so a template can still pass it on to a child's `[(x)]`.
 *
 * The component passes its own `signal` / `computed` / `untracked`: this package
 * may resolve another copy of `@angular/core` than the app (another version, or
 * the same version installed twice), and a signal from that copy is invisible to
 * the app's change detection — the template never re-read it (measured: the
 * analogjs demo on Angular 21 with this package resolving Angular 19). For the
 * same reason the signal node is copied by symbol, not through `SIGNAL`.
 *
 * @public — runtime API consumed by emitted Angular components.
 */
import type { ModelSignal, OutputRefSubscription, Signal } from '@angular/core';

/** The component's own reactive primitives (see above). Typed by shape, like `input` / `change`. */
export interface RozieModelPrimitives {
  signal: <U>(initial: U) => { (): U; set(value: U): void };
  computed: <U>(fn: () => U) => () => U;
  untracked: <U>(fn: () => U) => U;
}

// `input` and `change` are typed by shape, not as `InputSignal` / `OutputEmitterRef`:
// a consumer whose `@angular/core` is another copy (another version, or the same
// version installed twice) would fail the nominal brand check.
// The return type `M` is named by the caller (`import('@angular/core').ModelSignal<T>`
// in the emitted component) for the same reason: the field is then typed by the
// component's own `@angular/core`, whatever copy this package resolved.
export function rozieModel<T, M = ModelSignal<T>>(
  input: () => T | undefined,
  change: { emit(value: T): void; subscribe(callback: (value: T) => void): OutputRefSubscription },
  initial: T,
  { signal, computed, untracked }: RozieModelPrimitives,
): M {
  const local = signal<T>(initial);
  // A required prop (`input.required`) that nothing binds throws NG0950 when read.
  // That is the forms case — `[formControl]` / `[(ngModel)]` feed the value through
  // `writeValue`, not the input — so an unset required input reads as "not bound".
  const bound = (): T | undefined => {
    try {
      return input();
    } catch {
      return undefined;
    }
  };
  const read = computed<T>(() => {
    const value = bound();
    return value === undefined ? local() : value;
  });
  const model = (() => read()) as unknown as ModelSignal<T>;
  // The computed's signal node, under the app's own `SIGNAL` symbol.
  for (const key of Object.getOwnPropertySymbols(read)) {
    (model as unknown as Record<symbol, unknown>)[key] = (read as unknown as Record<symbol, unknown>)[key];
  }
  model.set = (value: T): void => {
    if (untracked(bound) === undefined) local.set(value);
    change.emit(value);
  };
  model.update = (fn: (value: T) => T): void => model.set(fn(untracked(read)));
  model.asReadonly = (): Signal<T> => read as unknown as Signal<T>;
  model.subscribe = (callback: (value: T) => void): OutputRefSubscription => change.subscribe(callback);
  return model as unknown as M;
}
