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
 * **Property-binding controlled-mode entry (`notifyPropertyWrite`)**: a Lit
 * consumer drives a two-way model with the `.items=${…}` *property* binding
 * (dot syntax), which lands on the host's public `set items(v)` and NEVER
 * reaches `attributeChangedCallback`. The emitted property setter therefore
 * routes through `notifyPropertyWrite` (NOT `write`) so a property-bound
 * parent establishes / keeps controlled mode — a single source of truth —
 * exactly as the attribute path does. The PRODUCER's own model mutations
 * (`$props.items = next` in the `.rozie` `<script>`) are emitted as direct
 * `write(...)` calls and stay clear of the public setter, so they never
 * spuriously flip a standalone (uncontrolled) producer.
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
 * **Authoritative-at-render in controlled mode (nested-Kanban reset fix)**:
 * in CONTROLLED mode `read()` returns a plain, NON-reactive `controlledValue`
 * latch — NOT the `_state` signal. This is deliberate. A `SignalWatcher`
 * render that reads a tracked signal re-renders whenever that signal changes,
 * including at a moment when the value is STALE relative to the parent's true
 * bound value — e.g. a reactively-scheduled re-render firing BEFORE the parent
 * has flushed its latest `.prop=${…}` binding down. That stale re-render then
 * re-propagates the old value into the producer's own children (the nested
 * SortableList Kanban whole-board reset: the outer controlled list re-passed
 * SEED `scope.item.cards` into a child column, clobbering a just-committed
 * card move). Mirrors `@rozie/runtime-react`'s `useControllableState`, where a
 * controlled component reads `currentValue === opts.value` — the LIVE prop —
 * and never a lagging copy. To preserve reactivity without a stale mirror, the
 * parent's authoritative flush (`notifyPropertyWrite` / `notifyAttributeChange`)
 * updates the latch AND calls `host.requestUpdate()`, so in controlled mode the
 * producer re-renders STRICTLY AFTER — and driven solely by — the parent's
 * value landing. Uncontrolled mode is unchanged: it keeps the tracked `_state`
 * signal so a producer-owned `write()` re-renders the standalone component
 * (Counter / Dropdown).
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */
import { signal } from '@preact/signals-core';

export interface LitControllableProperty<T> {
  /** Read the current value (controlled or uncontrolled). */
  read(): T;
  /**
   * Write a new value from the PRODUCER's own code (the component mutating its
   * own model — e.g. `$props.items = next` inside the `.rozie` `<script>`).
   * In uncontrolled mode the internal state updates; in controlled mode only
   * the CustomEvent dispatches (parent owns value). Always dispatches the
   * `eventName` CustomEvent on the host element. NEVER flips controlled mode —
   * a producer mutating its own model is not a parent assertion.
   */
  write(next: T | ((prev: T) => T)): void;
  /**
   * Called by the host element when the controlled attribute changes from
   * outside (e.g. parent `setAttribute`). Updates internal mirror AND detects
   * controlled<->uncontrolled mode flips (D-LIT-10 / D-57).
   */
  notifyAttributeChange(next: T | undefined): void;
  /**
   * Called by the host element's public PROPERTY setter (`set items(v)`) when a
   * parent reassigns via a Lit `.items=${…}` property binding. A property
   * binding bypasses `attributeChangedCallback` entirely, so without this hook
   * a property-bound two-way parent would never push the producer into
   * controlled mode — leaving producer and consumer holding two divergent
   * copies, synced only loosely by `*-change` CustomEvent round-trips.
   *
   * Semantically a property write from a parent IS the controlled signal:
   * it establishes / keeps controlled mode, mirroring `notifyAttributeChange`
   * for a defined value. The HTML-parser-seed window and the `[ROZ840]`
   * mode-flip warning contract are honoured identically.
   */
  notifyPropertyWrite(next: T): void;
}

export interface CreateLitControllablePropertyOpts<T> {
  /**
   * The Lit element instance — `dispatchEvent` target AND the re-render driver
   * in controlled mode. The helper duck-types `requestUpdate()` off the host
   * (every `LitElement` has it) so that, when controlled, the producer's
   * re-render is scheduled by the PARENT's authoritative property/attribute
   * flush rather than by an internal signal mirror that can be read stale
   * mid-flush. See the "Authoritative-at-render in controlled mode" note on
   * the factory below.
   */
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

/**
 * Minimal duck-typed shape of the re-render driver the helper needs in
 * controlled mode. Every `LitElement` satisfies it; the emitter always passes
 * `host: this`. Typed separately (rather than widening `host`) so the public
 * `HTMLElement` contract is preserved and a non-Lit host (test mocks) degrades
 * gracefully via the optional-call.
 */
interface RequestUpdateCapable {
  requestUpdate?: () => void;
}

export function createLitControllableProperty<T>(
  opts: CreateLitControllablePropertyOpts<T>,
): LitControllableProperty<T> {
  const { host, eventName, defaultValue, initialControlledValue } = opts;

  // The re-render driver (controlled mode). Duck-typed — every LitElement has
  // `requestUpdate`; a plain test-mock host simply degrades to no scheduled
  // update (the unit tests assert state directly, not renders).
  const updatable = host as unknown as RequestUpdateCapable;
  const scheduleRender = (): void => {
    updatable.requestUpdate?.();
  };

  // Closure state — replaces React's useRef/useState (class-based environment).
  // UNCONTROLLED reads/writes go through this preact Signal so SignalWatcher
  // tracks read() calls from inside render() and re-renders on write().
  let wasControlled = initialControlledValue !== undefined;
  const _state = signal<T>(
    wasControlled ? (initialControlledValue as T) : defaultValue,
  );
  // CONTROLLED authoritative latch — the value the PARENT last pushed down via
  // a property/attribute binding. `read()` returns THIS (not the tracked
  // signal) while controlled, so a stale reactively-scheduled re-render can
  // never read-and-re-propagate a value older than the parent's last flush.
  // Updated in lockstep with `_state` on every controlled write so the two
  // never diverge; the signal stays maintained for the controlled→uncontrolled
  // flip path (where reads switch back to the tracked signal).
  let controlledValue: T = wasControlled
    ? (initialControlledValue as T)
    : defaultValue;
  // Tracks whether the user has interacted with the component via write()
  // since mount. Used to gate the HTML-parser-seed window — see notify
  // implementation below.
  let userHasWritten = false;
  // One-shot token: holds the value of our most recent self-dispatched event.
  // When `notifyPropertyWrite(next)` arrives with `next` matching this token,
  // we recognise it as the parent listener's round-trip re-bind (the producer
  // wrote → CustomEvent → parent setState → parent re-render → setter calls
  // notifyPropertyWrite with the same value) and silently suppress one
  // re-dispatch. The token is cleared after that single suppression so any
  // subsequent same-value property write (e.g. external imperative `el.prop =
  // value` from arbitrary JS) still fires a change event.
  let pendingRoundTripValue: { v: T } | undefined;

  // Non-reactive read of the current value for functional-updater resolution
  // (`write(prev => …)`). In controlled mode this is the parent-authoritative
  // latch; in uncontrolled mode it peeks the signal. Either way it must NOT
  // establish a SignalWatcher dependency (it is called from inside `write`,
  // not from `render`), which `_state.peek()` guarantees for the uncontrolled
  // branch.
  const currentValue = (): T =>
    wasControlled ? controlledValue : _state.peek();

  const dispatchChange = (next: T): void => {
    // WR-04: scope the round-trip suppression token to the SAME synchronous
    // task. Previously the token was set indefinitely and only cleared by
    // the consuming `notifyPropertyWrite`. If an EXTERNAL imperative write
    // (e.g. vanilla JS doing `el.prop = sameValue`) landed BEFORE the async
    // parent re-bind round-trip, it would silently match the token and the
    // external write's change event would be swallowed. A microtask boundary
    // is enough to expire the token: the synchronous round-trip (producer
    // write → CustomEvent → SYNCHRONOUS parent setter → notifyPropertyWrite)
    // runs entirely before the microtask fires; any LATER write — including
    // an async parent re-bind that arrives after a microtask, OR an external
    // same-value write — sees a cleared token and dispatches correctly.
    const token: { v: T } = { v: next };
    pendingRoundTripValue = token;
    // `bubbles: false` / `composed: false` — a `<prop>-change` model event is
    // delivered to whoever bound to THIS element. Both Rozie binding shapes —
    // the r-model two-way `@<prop>-change` and a manual consumer `@<prop>-change`
    // — attach the listener directly on the component host, so the event fires
    // AT_TARGET without bubbling. Bubbling/composed previously let a model event
    // cross every shadow boundary and be caught by a SAME-NAMED listener on an
    // ANCESTOR — e.g. two nested `<SortableList>`s both emit `items-change`, so
    // the inner list's event bubbled into the outer list's consumer handler and
    // overwrote the outer model with the inner's array (nested-Kanban corruption).
    // Scoping the event to its target element is the correct semantic and the
    // standard web-component guidance for component-internal state-change events.
    host.dispatchEvent(
      new CustomEvent(eventName, {
        detail: next,
        bubbles: false,
        composed: false,
        cancelable: false,
      }),
    );
    queueMicrotask(() => {
      if (pendingRoundTripValue === token) pendingRoundTripValue = undefined;
    });
  };

  return {
    read(): T {
      // CONTROLLED: return the parent-authoritative latch WITHOUT touching the
      // tracked signal — so a `SignalWatcher` render does not subscribe to the
      // internal mirror and can never be reactively re-scheduled to read a
      // stale value ahead of the parent's flush. Re-renders in controlled mode
      // are driven exclusively by `scheduleRender()` on the parent's flush.
      // UNCONTROLLED: read the tracked signal so producer-owned `write()`s
      // re-render the standalone component.
      return wasControlled ? controlledValue : _state.value;
    },
    write(next: T | ((prev: T) => T)): void {
      userHasWritten = true;
      const resolved: T =
        typeof next === 'function'
          ? (next as (prev: T) => T)(currentValue())
          : next;
      if (!wasControlled) {
        // Uncontrolled mode — update internal state (tracked signal → the
        // SignalWatcher re-renders the standalone component).
        _state.value = resolved;
      }
      // Controlled mode: the parent owns the value. We do NOT mutate the
      // `controlledValue` latch here — the parent re-asserts the authoritative
      // value via `notifyAttributeChange` / `notifyPropertyWrite` from its
      // event handler, which both updates the latch and schedules the render.
      // This is what keeps the producer's render strictly downstream of the
      // parent's flush (authoritative-at-render).
      //
      // Both modes — fire the change event so parent observers / two-way
      // binding helpers see the update.
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
        // Seeding window — element stays uncontrolled, so reads still go
        // through the tracked signal. Mirror the seed into the latch too so a
        // subsequent flip to controlled has a coherent starting value.
        _state.value = next as T;
        controlledValue = next as T;
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
        // CONTROLLED flush: update the authoritative latch (which `read()`
        // returns) AND keep the signal in sync for the flip path. Because
        // controlled reads no longer subscribe to `_state`, the render must be
        // scheduled explicitly — this is what orders the producer's re-render
        // strictly AFTER the parent's authoritative value lands.
        controlledValue = next as T;
        _state.value = next as T;
        scheduleRender();
      }
      // When `nextIsControlled` is false the incoming value is `undefined`
      // (the controlled mirror was removed). We do NOT write `undefined` into
      // `_state` — the element has flipped to uncontrolled and now reads the
      // signal's last real value (matching the pre-fix behavior, which only
      // touched `_state` on the controlled path).
    },
    notifyPropertyWrite(next: T): void {
      // A `.prop=${…}` Lit binding always carries a DEFINED value (the parent's
      // bound expression) and re-applies on EVERY parent render — including the
      // round-trip that follows the producer's own `write()` → `*-change`
      // CustomEvent → parent state update → parent re-render. That round-trip
      // is the NORMAL, EXPECTED two-way data flow, NOT a programmer error.
      //
      // Therefore this path silently ESTABLISHES / KEEPS controlled mode and
      // deliberately does NOT emit the `[ROZ840]` flip warning: a property-
      // bound parent IS the controlled signal, and warning on the legitimate
      // property-binding path would be spurious noise (the ROZ840 warning is
      // reserved for `notifyAttributeChange`, where an attribute appearing /
      // disappearing mid-lifecycle is genuinely surprising). Adopting the
      // parent's value here gives producer + consumer a single source of truth
      // and eliminates the dual-copy desync.
      //
      // A property binding can never make the component uncontrolled — `next`
      // is always defined — so there is no uncontrolled-direction flip to
      // consider.
      //
      // Dispatch policy (Phase 14-adjacent fix, 2026-05-22):
      //   `notifyPropertyWrite` now dispatches a `*-change` CustomEvent on a
      //   real, non-round-trip value change. This restores observability of
      //   EXTERNAL imperative writes — vanilla JS doing `el.prop = X` lands on
      //   `set X(v) { _xControllable.notifyPropertyWrite(v); }`, and observers
      //   listening to `'<event>-change'` (or test harnesses) need to see that
      //   value change just as they would for a producer-side `write(...)`.
      //   The original "never dispatch" rule was over-broad: it suppressed
      //   producer→listener→re-bind round-trips (correct) but also swallowed
      //   external writes (incorrect). We now use a one-shot
      //   `pendingRoundTripValue` token set by `dispatchChange`: when a parent
      //   re-bind comes back carrying the same value we just dispatched, the
      //   token matches and we silently consume it (no re-dispatch, no loop).
      //   Outside that single suppression window, real value changes — which
      //   in practice means external imperative writes and parent-initiated
      //   value bumps — fire the event once, on actual change. Matches the
      //   "fire change events only on actual change" semantics shared by the
      //   other 5 target frameworks.
      // `prev` is the value the component currently shows — the controlled
      // latch if already controlled, else the uncontrolled signal's current
      // value (a fresh element receiving its FIRST property binding after an
      // uncontrolled `write()` must compare against that written value, not the
      // never-touched latch). `currentValue()` resolves the right source
      // because `wasControlled` has not been flipped yet at this point.
      const prev = currentValue();
      wasControlled = true;
      controlledValue = next;
      _state.value = next;
      // Schedule the producer's re-render off the parent's authoritative flush.
      // Controlled reads no longer subscribe to the `_state` signal, so the
      // property-binding flush is the sole render trigger — guaranteeing the
      // producer renders AFTER (and from) the value the parent just pushed,
      // never from a stale mirror (the nested-Kanban whole-board reset fix).
      scheduleRender();
      if (
        pendingRoundTripValue !== undefined &&
        Object.is(pendingRoundTripValue.v, next)
      ) {
        // Producer's own dispatch echoing back via parent's listener re-bind.
        // Consume the token (one-shot) and skip the re-dispatch.
        pendingRoundTripValue = undefined;
        return;
      }
      if (!Object.is(next, prev)) {
        dispatchChange(next);
      }
    },
  };
}
