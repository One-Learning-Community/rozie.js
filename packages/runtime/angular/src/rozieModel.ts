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
 * (delegated to the `<name>Change` output). It carries the computed's `SIGNAL`
 * node, so a template can still pass it on to a child's `[(x)]`.
 *
 * @public — runtime API consumed by emitted Angular components.
 */
import { computed, signal, untracked } from '@angular/core';
import type { ModelSignal, OutputRefSubscription, Signal } from '@angular/core';
import { SIGNAL } from '@angular/core/primitives/signals';

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
  const model = (() => read()) as ModelSignal<T>;
  (model as unknown as Record<symbol, unknown>)[SIGNAL] = (read as unknown as Record<symbol, unknown>)[SIGNAL];
  model.set = (value: T): void => {
    if (untracked(bound) === undefined) local.set(value);
    change.emit(value);
  };
  model.update = (fn: (value: T) => T): void => model.set(fn(untracked(read)));
  model.asReadonly = (): Signal<T> => read;
  model.subscribe = (callback: (value: T) => void): OutputRefSubscription => change.subscribe(callback);
  return model as unknown as M;
}
