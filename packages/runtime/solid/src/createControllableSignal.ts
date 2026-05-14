/**
 * createControllableSignal — hybrid controlled/uncontrolled signal (D-135).
 *
 * Mirrors React's `useControllableState` pattern for Solid.js.
 * Pure Solid — no external deps.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { createSignal } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';

/**
 * Create a Solid signal that can be driven by a parent (controlled) or manage
 * its own state (uncontrolled), matching the React controllable-state pattern.
 *
 * @param props   - The component's merged props object (from `splitProps`), or
 *                  `undefined` when the component was mounted with no props.
 * @param key     - The prop key that represents the controlled value (e.g. `"value"`).
 * @param defaultFallback - Fallback when neither `props[key]` nor `props["default<Key>"]` is set.
 * @returns `[getter, setter]` — Accessor<T> + Setter<T>.
 *   - Getter: in controlled mode returns `props[key]`; in uncontrolled mode returns internal signal.
 *   - Setter: in controlled mode calls `props["on<Key>Change"]` if present; in uncontrolled mode
 *     updates internal signal AND calls the callback.
 *
 * @remarks
 * **`T` must not be a function type.** The setter classifies its argument as a
 * functional updater purely via `typeof arg === 'function'`, so a function
 * argument is *always* treated as `(prev: T) => T` — a controllable signal whose
 * value is itself a function (a callback or render-prop stored as state) can
 * never be *set* to a new function. This is the same limitation the React
 * `useControllableState` runtime carries, kept consistent across both targets.
 * If function-valued state must be supported, an explicit updater-wrapper API is
 * required instead.
 *
 * @example
 * ```tsx
 * const [value, setValue] = createControllableSignal(local, 'value', 0);
 * ```
 */
export function createControllableSignal<T>(
  props: Record<string, unknown> | undefined,
  key: string,
  defaultFallback: T,
): [Accessor<T>, Setter<T>] {
  // D-VR-03: a Solid component mounted with no props at all (e.g. the
  // visual-regression host's bare `render(() => <Counter />)`) calls this
  // helper with `_props` === undefined. Tolerate an absent props object by
  // defaulting to `{}` so reads of `_props[defaultKey]` / `_props[key]` resolve
  // to `undefined` instead of throwing `Cannot read properties of undefined`.
  const _props: Record<string, unknown> = props ?? {};
  const defaultKey = 'default' + key.charAt(0).toUpperCase() + key.slice(1);
  const callbackKey = 'on' + key.charAt(0).toUpperCase() + key.slice(1) + 'Change';

  const initialValue =
    _props[defaultKey] !== undefined ? (_props[defaultKey] as T) : defaultFallback;

  // Internal signal — only meaningful in uncontrolled mode.
  const [internal, setInternal] = createSignal<T>(initialValue);

  // Track initial controlled state to detect mid-lifecycle flips.
  const wasInitiallyControlled = _props[key] !== undefined;
  let warnedAboutFlip = false;

  const isControlled = (): boolean => _props[key] !== undefined;

  const getter: Accessor<T> = () => {
    if (isControlled()) {
      return _props[key] as T;
    }
    return internal();
  };

  const setter: Setter<T> = ((valueOrUpdater: T | ((prev: T) => T)) => {
    // Detect mid-lifecycle controlled/uncontrolled flip.
    const nowControlled = isControlled();
    if (!warnedAboutFlip && nowControlled !== wasInitiallyControlled) {
      warnedAboutFlip = true;
      console.warn(
        `[ROZ812] createControllableSignal: component switched from ` +
          `${wasInitiallyControlled ? 'controlled' : 'uncontrolled'} to ` +
          `${nowControlled ? 'controlled' : 'uncontrolled'} mid-lifecycle. ` +
          `This is unsupported and may cause inconsistent UI state.`,
      );
    }

    // Resolve the next value (support functional updaters).
    const currentValue = nowControlled ? (_props[key] as T) : internal();
    const nextValue =
      typeof valueOrUpdater === 'function'
        ? (valueOrUpdater as (prev: T) => T)(currentValue)
        : valueOrUpdater;

    // Fire the optional change callback.
    const callback = _props[callbackKey];
    if (typeof callback === 'function') {
      callback(nextValue);
    }

    // In uncontrolled mode update the internal signal.
    if (!nowControlled) {
      setInternal(() => nextValue);
    }

    return nextValue;
  }) as Setter<T>;

  return [getter, setter];
}
