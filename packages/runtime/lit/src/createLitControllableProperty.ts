/**
 * createLitControllableProperty — D-LIT-10 controllable property helper for
 * `@rozie/runtime-lit`.
 *
 * Mirrors @rozie/runtime-react's `useControllableState` (D-56 + D-57 hybrid
 * controlled/uncontrolled) but adapted to the class-based Lit world: the
 * helper is called from a Lit element's constructor / field initializer rather
 * than a React render. State lives in a **preact Signal** (NOT React
 * `useRef`/`useState`) so reads from inside a `SignalWatcher` render are
 * tracked and writes trigger a re-render.
 *
 * **Controlled mode** (`opts.initialControlledValue !== undefined`):
 *   `read()` returns the value last written via `notifyAttributeChange`
 *   (controlled value mirrors the host's `@property`). Calling `write(next)`
 *   dispatches the `eventName` CustomEvent on the host but does NOT mutate
 *   internal state — the parent owns the value via the attribute / property.
 *
 * **Uncontrolled mode** (`opts.initialControlledValue === undefined`):
 *   `read()` returns local signal state seeded from `opts.defaultValue`.
 *   Calling `write(next)` updates the local state AND dispatches the
 *   `eventName` CustomEvent on the host.
 *
 * **Parent-flip detection (D-LIT-10 / D-57 parity)**: if the controlled value
 * flips from `undefined` to defined (or vice versa) mid-lifecycle via
 * `notifyAttributeChange`, the helper silently follows the new value and emits
 * ONE `console.warn` with the stable `[ROZ840]` prefix — same DX as the React
 * runtime's ROZ550 warning. Mirrors Radix's behavior — flips are programmer
 * error in production but never silently break the UI.
 *
 * **HTML-parser-seed window**: the HTML parser populates attributes AFTER the
 * constructor runs, so the first `attributeChangedCallback` fires after the
 * controllable is constructed in uncontrolled mode. The emitter coerces a
 * `null` attribute value to the prop's default for primitives, so the parser
 * path can only deliver a DEFINED value through `notifyAttributeChange`. We
 * therefore treat the narrow case `constructor-uncontrolled + first defined
 * attribute before any write()` as initial seeding — set the value but do NOT
 * flip mode and do NOT warn. The genuine flip path
 * `constructor-controlled + notifyAttributeChange(undefined)` can ONLY come
 * from user JS removing the controlled mirror — never the HTML parser — and
 * still warns even before any write().
 *
 * **Functional updaters**: `write(prev => prev + 1)` works in both modes — the
 * resolver computes against the CURRENT value.
 *
 * **Reactive tracking**: the underlying `signal()` from `@preact/signals-core`
 * ensures `read()` participates in `SignalWatcher`'s reactive dependency
 * tracking. Without this, the emitted `get value() { return this._x.read(); }`
 * getter would return a plain JS variable that the watcher cannot observe,
 * and writes would not trigger a re-render (the original bug behind Counter
 * and Dropdown not re-rendering on internal state changes).
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */
import { signal } from '@preact/signals-core';

export interface LitControllableProperty<T> {
  /** Read the current value (controlled or uncontrolled). */
  read(): T;
  /**
   * Write a new value. In uncontrolled mode the internal state updates;
   * in controlled mode only the CustomEvent dispatches (parent owns value).
   * Always dispatches the `eventName` CustomEvent on the host element.
   */
  write(next: T | ((prev: T) => T)): void;
  /**
   * Called by the host element when the controlled attribute / property
   * changes from outside (e.g. parent reassigns). Updates internal mirror
   * AND detects controlled<->uncontrolled mode flips (D-LIT-10 / D-57).
   */
  notifyAttributeChange(next: T | undefined): void;
}

export interface CreateLitControllablePropertyOpts<T> {
  /** The Lit element instance — dispatchEvent target. */
  host: HTMLElement;
  /** Event name to dispatch on `write` — e.g. `'value-change'`. */
  eventName: string;
  /** Default value seeded into uncontrolled local state. */
  defaultValue: T;
  /**
   * Initial controlled value. `undefined` puts the helper into uncontrolled
   * mode (uses `defaultValue` as the initial local state).
   */
  initialControlledValue: T | undefined;
}

export function createLitControllableProperty<T>(
  opts: CreateLitControllablePropertyOpts<T>,
): LitControllableProperty<T> {
  const { host, eventName, defaultValue, initialControlledValue } = opts;

  // Closure state — replaces React's useRef/useState (class-based environment).
  // Backed by a preact Signal so SignalWatcher tracks read() calls from
  // inside render() and re-renders on write().
  let wasControlled = initialControlledValue !== undefined;
  const _state = signal<T>(
    wasControlled ? (initialControlledValue as T) : defaultValue,
  );
  // Tracks whether the user has interacted with the component via write()
  // since mount. Used to gate the HTML-parser-seed window — see notify
  // implementation below.
  let userHasWritten = false;

  const currentValue = (): T => _state.value;

  const dispatchChange = (next: T): void => {
    host.dispatchEvent(
      new CustomEvent(eventName, {
        detail: next,
        bubbles: true,
        composed: true,
        cancelable: false,
      }),
    );
  };

  return {
    read(): T {
      return currentValue();
    },
    write(next: T | ((prev: T) => T)): void {
      userHasWritten = true;
      const resolved: T =
        typeof next === 'function'
          ? (next as (prev: T) => T)(currentValue())
          : next;
      if (!wasControlled) {
        // Uncontrolled mode — update internal state.
        _state.value = resolved;
      }
      // Both modes — fire the change event so parent observers / two-way
      // binding helpers see the update. Controlled-mode parents typically
      // re-assert via `notifyAttributeChange` from their event handler.
      dispatchChange(resolved);
    },
    notifyAttributeChange(next: T | undefined): void {
      const nextIsControlled = next !== undefined;
      // HTML-parser-seed window: only short-circuit the very specific path
      // that the HTML parser can produce — constructor was uncontrolled AND
      // the incoming attribute is defined AND no write() has happened yet.
      // The emitted attributeChangedCallback coerces `null` to the prop's
      // default for primitives, so the HTML parser / setAttribute path
      // cannot deliver `undefined` here; an `undefined` always indicates
      // user JS removing the controlled mirror, which is a real mode flip
      // and must warn even before any write().
      if (!userHasWritten && !wasControlled && nextIsControlled) {
        _state.value = next as T;
        return;
      }
      if (wasControlled !== nextIsControlled) {
        // D-LIT-10 ROZ840 — silent-follow but emit ONE console.warn so the
        // consumer can grep production logs for unexpected flips. Stable
        // prefix per D-63 parity.
        // biome-ignore lint/suspicious/noConsole: intentional diagnostic
        console.warn(
          `[ROZ840] createLitControllableProperty: component is changing from ` +
            `${wasControlled ? 'controlled' : 'uncontrolled'} to ` +
            `${nextIsControlled ? 'controlled' : 'uncontrolled'}. ` +
            `Parents should not switch modes mid-lifecycle. Following new value.`,
        );
        wasControlled = nextIsControlled;
      }
      if (nextIsControlled) {
        _state.value = next as T;
      }
    },
  };
}
