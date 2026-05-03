/**
 * `useControllableState` — D-56 + D-57 hybrid controlled/uncontrolled hook
 * for `@rozie/runtime-react`.
 *
 * The single most-used helper from the React runtime — every Rozie `<props>`
 * declaration with `model: true` compiles to a call into this hook.
 *
 * Returns `[currentValue, setValue]` where:
 *  - **Controlled mode** (`opts.value !== undefined`): `currentValue === opts.value`.
 *    Calling `setValue(next)` invokes `opts.onValueChange?.(next)` but does NOT
 *    mutate any local state — the parent owns the value. This matches Radix /
 *    Reach UI / shadcn semantics.
 *  - **Uncontrolled mode** (`opts.value === undefined`): `currentValue` is local
 *    state seeded from `opts.defaultValue`. Calling `setValue(next)` updates the
 *    local state AND invokes `opts.onValueChange?.(next)` so consumers can still
 *    observe writes.
 *
 * **Parent-flip detection (D-57)**: if `opts.value` flips from `undefined` to
 * defined (or vice versa) mid-lifecycle, the hook silently follows the new
 * value and emits ONE `console.warn` per component instance with the stable
 * `[ROZ550]` prefix (see `RUNTIME_REACT_CONTROLLABLE_MODE_FLIP` in
 * `packages/core/src/diagnostics/codes.ts`). Mirrors Radix's behavior — flips
 * are programmer error in production but never silently break the UI.
 *
 * **Functional updaters**: `setValue(prev => prev + 1)` works in both modes —
 * the resolver computes against the CURRENT value (props in controlled, state
 * in uncontrolled).
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { useCallback, useRef, useState } from 'react';

export interface UseControllableStateOpts<T> {
  /** When defined, hook operates in controlled mode (parent owns value). */
  value?: T | undefined;
  /** Initial value when uncontrolled. Required (use `null` to mean "no default"). */
  defaultValue: T;
  /** Called whenever the local value changes (both modes). Optional. */
  onValueChange?: ((next: T) => void) | undefined;
}

export function useControllableState<T>(
  opts: UseControllableStateOpts<T>,
): [T, (next: T | ((prev: T) => T)) => void] {
  const { value, defaultValue, onValueChange } = opts;
  const isControlled = value !== undefined;

  // Track the previous mode so we can detect flips. Uses a ref because we
  // need to compare across renders without triggering a render ourselves.
  const wasControlledRef = useRef(isControlled);

  const [uncontrolledValue, setUncontrolledValue] = useState<T>(defaultValue);

  if (wasControlledRef.current !== isControlled) {
    // D-57 ROZ550 — silent-follow but emit one console.warn so the consumer
    // can grep production logs for unexpected flips. Stable prefix per D-63.
    console.warn(
      `[ROZ550] useControllableState: component is changing from ` +
        `${wasControlledRef.current ? 'controlled' : 'uncontrolled'} to ` +
        `${isControlled ? 'controlled' : 'uncontrolled'}. ` +
        `Parents should not switch modes mid-lifecycle. Following new value.`,
    );
    wasControlledRef.current = isControlled;
  }

  const currentValue = isControlled ? (value as T) : uncontrolledValue;

  // **Identity-stable setValue** (REACT-T-03 floor) — consumers include
  // `setValue` in useEffect dep arrays expecting `useState`-setter
  // semantics: same identity across every render. We achieve this by:
  //   1. Storing the latest `currentValue`, `isControlled`, and
  //      `onValueChange` in refs (updated every render)
  //   2. Building setValue via `useCallback(..., [])` so identity never changes
  //   3. Reading from the refs inside the callback so it always sees the
  //      LATEST value (D-61 stale-closure defense)
  // This gives consumers a setValue that BOTH (a) has stable identity for
  // exhaustive-deps lint and (b) always reads fresh closure values.
  const currentValueRef = useRef(currentValue);
  const isControlledRef = useRef(isControlled);
  const onValueChangeRef = useRef(onValueChange);
  currentValueRef.current = currentValue;
  isControlledRef.current = isControlled;
  onValueChangeRef.current = onValueChange;

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === 'function'
          ? (next as (prev: T) => T)(currentValueRef.current)
          : next;
      if (!isControlledRef.current) {
        setUncontrolledValue(resolved);
      }
      onValueChangeRef.current?.(resolved);
    },
    [],
  );

  return [currentValue, setValue];
}
