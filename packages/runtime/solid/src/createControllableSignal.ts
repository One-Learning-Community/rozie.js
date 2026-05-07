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
 * @param props   - The component's merged props object (from `splitProps`).
 * @param key     - The prop key that represents the controlled value (e.g. `"value"`).
 * @param defaultFallback - Fallback when neither `props[key]` nor `props["default<Key>"]` is set.
 * @returns `[getter, setter]` — Accessor<T> + Setter<T>.
 *   - Getter: in controlled mode returns `props[key]`; in uncontrolled mode returns internal signal.
 *   - Setter: in controlled mode calls `props["on<Key>Change"]` if present; in uncontrolled mode
 *     updates internal signal AND calls the callback.
 *
 * @example
 * ```tsx
 * const [value, setValue] = createControllableSignal(local, 'value', 0);
 * ```
 */
export function createControllableSignal<T>(
  props: Record<string, unknown>,
  key: string,
  defaultFallback: T,
): [Accessor<T>, Setter<T>] {
  const defaultKey = 'default' + key.charAt(0).toUpperCase() + key.slice(1);
  const callbackKey = 'on' + key.charAt(0).toUpperCase() + key.slice(1) + 'Change';

  const initialValue =
    props[defaultKey] !== undefined ? (props[defaultKey] as T) : defaultFallback;

  // Internal signal — only meaningful in uncontrolled mode.
  const [internal, setInternal] = createSignal<T>(initialValue);

  // Track initial controlled state to detect mid-lifecycle flips.
  const wasInitiallyControlled = props[key] !== undefined;
  let warnedAboutFlip = false;

  const isControlled = (): boolean => props[key] !== undefined;

  const getter: Accessor<T> = () => {
    if (isControlled()) {
      return props[key] as T;
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
    const currentValue = nowControlled ? (props[key] as T) : internal();
    const nextValue =
      typeof valueOrUpdater === 'function'
        ? (valueOrUpdater as (prev: T) => T)(currentValue)
        : valueOrUpdater;

    // Fire the optional change callback.
    const callback = props[callbackKey];
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
