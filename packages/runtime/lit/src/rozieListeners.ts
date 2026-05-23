/**
 * rozieListeners — Phase 15 / Plan 15-05 / D-12 / 15-RESEARCH Pattern 7.
 *
 * lit-html element-position `AsyncDirective` attaching an arbitrary listener
 * object to its host element. Emitted by `@rozie/target-lit` for every
 * `r-on="<expr>"` dynamic listener spread (and the synthesized `$listeners`
 * auto-fallthrough spread).
 *
 * **Why a directive (not native syntax):** Lit's `@event=${fn}` directive only
 * supports compile-time-known event names. There is no native dynamic-key
 * object-form listener spread (no Vue 3 `v-on="obj"`, no Svelte 5
 * `use:applyListeners`, no React JSX-spread). The element-position
 * `PartType.ELEMENT` directive contract gives us a per-element hook with state
 * (`prevListenersByElement` snapshot) so we can `removeEventListener` keys
 * that disappear between renders.
 *
 * **Why `AsyncDirective` (NOT regular `Directive`):** A2 / Pitfall 7 LOCKED.
 * Lit's regular `Directive` (the base class `rozieSpread` extends) has NO
 * `disconnected()` callback. That's safe for setAttribute/removeAttribute
 * because once an element is GC'd it has no observable state. But
 * `rozieListeners` ATTACHES event listeners that must be removed on element
 * disposal — if the host element is moved across parents (lit-html
 * `setConnected(false)` cycles, `live`/`unsafeHTML` patterns), listeners
 * leak. `AsyncDirective` is the ONLY Lit directive base class that exposes
 * `disconnected()` / `reconnected()` lifecycle hooks per
 * [lit.dev/docs/api/custom-directives].
 *
 * **Semantics per render:**
 *   1. Capture `this.#hostElement = part.element` on every `update()` call
 *      (cheap; ensures `disconnected()` always has the latest reference).
 *   2. Read prev = the WeakMap entry for the host element (or new Map).
 *   3. Phase 1: iterate prev; for each key, look up safeObj; if missing or
 *      reference-changed, `removeEventListener(k, prevFn)`.
 *   4. Phase 2: iterate `Object.entries(safeObj)`, skip FORBIDDEN_KEYS, skip
 *      non-function values; if missing or reference-changed, addEventListener
 *      and record the new pair.
 *   5. Snapshot the new map for the next render.
 *
 * **Cleanup (D-14):** On `disconnected()` — the AsyncDirective lifecycle hook
 * called when the part is detached from the DOM — iterate the WeakMap entry
 * and `removeEventListener` every captured pair, then `prev.clear()` (in-place
 * clear; the WeakMap entry stays so a `reconnected()` re-attach is a clean
 * diff against an empty Map). The next `update()` repopulates.
 *
 * **Security (T-15-V5-03):** module-level `FORBIDDEN_KEYS` Set (byte-equal to
 * the Vue/Svelte/React/Solid runtime helpers' guard) skips `__proto__`,
 * `constructor`, `prototype` — never calls `addEventListener` for those keys.
 * `addEventListener` itself is the safe DOM API — it does NOT parse HTML and
 * cannot inject markup.
 *
 * **Security (T-15-V5-04):** the AsyncDirective disconnected-hook contract
 * is what makes Lit safe-from-listener-leak; without `AsyncDirective` (i.e.
 * if we used regular `Directive` like `rozieSpread`) listeners would survive
 * across element disposal cycles and accumulate over time. The Plan 15-07
 * Lit teardown e2e probe asserts this end-to-end.
 *
 * **Position guard:** the constructor enforces `PartType.ELEMENT` — using
 * `rozieListeners(...)` in any other part position (attribute, child,
 * property) throws a descriptive error at template-instantiation time.
 *
 * **Auto-fallthrough target (CONTEXT.md A1 — Lit):** the synthesized
 * `$listeners` `ListenerSpread` from Plan 15-02 lands on the template-root
 * element INSIDE the component's shadow tree (the `<button>` the author
 * wrote), NEVER the host custom element. The Lit emitter places the
 * `${rozieListeners(...)}` binding on the inner element it sees in the
 * author's template.
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */
import { noChange } from 'lit';
import { AsyncDirective, directive } from 'lit/async-directive.js';
import type { ElementPart, PartInfo } from 'lit/directive.js';
import { PartType } from 'lit/directive.js';

/**
 * Per-element listener snapshot. Stored OFF the directive instance because
 * lit-html may re-instantiate a directive across renders in some configurations
 * (notably under bundler-resolved mixed dev/prod lit-html where the
 * `parent.__directive` cache isn't reused), and the cross-render diff would
 * silently lose its `prev` snapshot — leaving stale listeners attached. Keying
 * by the host `Element` ensures the snapshot persists across render cycles
 * regardless of directive-instance identity, so the diff stays correct.
 *
 * A `WeakMap` lets the GC reclaim per-element state when the element itself is
 * garbage-collected.
 */
const prevListenersByElement = new WeakMap<Element, Map<string, EventListener>>();

/**
 * T-15-V5-03 — keys that would either trigger prototype-pollution on
 * iteration or attempt to invoke `addEventListener` for non-DOM-event names
 * (the latter is benign — no `__proto__` event fires — but the silent skip
 * keeps the runtime helper consistent with the other five Phase 15 runtime
 * helpers' guard and provides defence-in-depth across changes in spec).
 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

class RozieListenersDirective extends AsyncDirective {
  #hostElement: Element | null = null;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error(
        'rozieListeners can only be used in element position (e.g. `<button ${rozieListeners(obj)}>`).',
      );
    }
  }

  override update(
    part: ElementPart,
    [obj]: [Record<string, unknown> | null | undefined],
  ): symbol {
    const el = part.element as Element;
    // Capture on every update so disconnected() always has the latest
    // reference (lit-html guarantees the same instance for a given part, but
    // the assignment is cheap and defensive).
    this.#hostElement = el;

    // CR-03 — a manual `r-on` whose expression resolves to null/undefined at
    // runtime (e.g. `$data.maybeNull`, an inline `cond ? listeners : null`)
    // previously crashed inside `for (const [k] of prev)` and
    // `Object.entries(obj)` — the latter throws on `null`. Coerce nullish to
    // `{}` so the path becomes a clean remove-all-then-no-op, matching the
    // silent-no-op semantics of Vue `v-on=null`, React `{...null}`, and the
    // Phase 14 `rozieSpread` nullish handling.
    const safeObj: Record<string, unknown> = obj ?? {};
    const prev =
      prevListenersByElement.get(el) ?? new Map<string, EventListener>();
    const next = new Map<string, EventListener>();

    // Phase 1: remove keys that disappeared OR whose reference changed.
    for (const [k, prevFn] of prev) {
      const incoming = safeObj[k];
      if (incoming === undefined || incoming !== prevFn) {
        el.removeEventListener(k, prevFn);
      }
    }

    // Phase 2: add keys that are new OR whose reference changed.
    for (const [k, v] of Object.entries(safeObj)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      if (typeof v !== 'function') continue;
      const fn = v as EventListener;
      const prevFn = prev.get(k);
      if (prevFn !== fn) {
        el.addEventListener(k, fn);
      }
      next.set(k, fn);
    }

    prevListenersByElement.set(el, next);
    return noChange;
  }

  /**
   * `disconnected()` is the AsyncDirective lifecycle hook called when the
   * part is detached from the DOM (e.g. lit-html `setConnected(false)`,
   * element removed from a parent template). Iterate every captured pair and
   * call `removeEventListener` so no listeners survive element disposal
   * (T-15-V5-04). `prev.clear()` keeps the WeakMap entry but empties it, so a
   * subsequent `reconnected()` followed by `update()` re-attaches every
   * listener via the normal diff path against an empty prior snapshot.
   */
  protected override disconnected(): void {
    const el = this.#hostElement;
    if (el === null) return;
    const prev = prevListenersByElement.get(el);
    if (prev === undefined) return;
    for (const [k, fn] of prev) {
      el.removeEventListener(k, fn);
    }
    prev.clear();
  }

  /**
   * `reconnected()` is a no-op — the next `update()` will diff against the
   * cleared Map and re-attach every listener. We do NOT eagerly re-attach
   * here because we don't have the current listener object until the next
   * `update()` call (the cleared Map intentionally has zero entries; eagerly
   * walking it would attach nothing).
   */
  protected override reconnected(): void {
    // intentionally empty — update() handles re-attach via diff
  }

  /**
   * The `render(obj)` contract is required by lit-html's `Directive` base, but
   * the element-position directive does its work in `update(part, args)` —
   * `render()`'s return value is unused for element parts.
   */
  render(_obj: Record<string, unknown> | null | undefined): symbol {
    return noChange;
  }
}

export const rozieListeners = directive(RozieListenersDirective);
