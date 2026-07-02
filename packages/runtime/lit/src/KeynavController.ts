/**
 * `KeynavController` — the Lit controller for the `r-keynav` primitive
 * (SPEC.md, Phase 71). Modeled on `useKeynav` (Plan 71-04, REFERENCE) but
 * adapted to Lit's class-based world as a genuine `ReactiveController`
 * (SPEC §8 table) — NOT a plain attach function like the `.outside`
 * precedent (`attachOutsideClickListener.ts`). This is a NEW authoring
 * pattern for `@rozie/runtime-lit` (Landmine 6, Plan 71-08).
 *
 * Wraps `@rozie/runtime-keynav-core`'s framework-neutral
 * `createKeynavStateMachine`, split along the SAME "generic behavior ->
 * per-target runtime controller" line SPEC §8 describes, but expressed
 * through Lit's OWN controller lifecycle rather than two React effects:
 *
 *   - **`hostConnected()`** — mount-once-per-connect: builds the
 *     `KeynavHost` adapter (every getter/setter reads through `this.opts`,
 *     which the emitted class sets ONCE at construction — no latest-ref
 *     indirection is needed the way `useKeynav` needs `optsRef`, because a
 *     Lit class instance's `opts` closures already read live `this.<field>`
 *     state on every call, exactly like `createLitControllableProperty`'s
 *     opts), instantiates `createKeynavStateMachine`, and attaches a SINGLE
 *     delegated `keydown`/`pointerdown` listener pair on `host.renderRoot`
 *     (the shadow root) — no per-item listeners (SPEC §8). Delegation and
 *     marker queries operate INSIDE the shadow root (Landmine 6): Lit
 *     elements' `r-keynav-item`-marked children live behind the shadow
 *     boundary, so both the event listeners AND every `querySelector(All)`
 *     call below are scoped to `host.renderRoot`, never `document`.
 *
 *   - **`hostDisconnected()`** — detaches both listeners and disposes the
 *     state machine (typeahead buffer reset).
 *
 *   - **`hostUpdated()`** — Lit's own reactive-controller lifecycle hook,
 *     called by `ReactiveElement` after EVERY host update (i.e. after the
 *     DOM has been patched — SPEC §9's declarative `data-rozie-keynav-item`
 *     markers are guaranteed current at this point), mirroring
 *     `useKeynav`'s active-only second effect WITHOUT a framework
 *     dependency array: this controller manually diffs `getActive()`
 *     against the last-seen value and skips the imperative work (focus /
 *     scroll / active-class toggle) on any update that didn't change
 *     `active` — the exact "evaluated once ... toggles on active-change"
 *     semantics SPEC §9 requires. Because `ReactiveElement.connectedCallback`
 *     / `disconnectedCallback` call every registered controller's
 *     `hostConnected`/`hostDisconnected` SYNCHRONOUSLY (verified against
 *     `@lit/reactive-element`'s own source — no microtask deferral the way
 *     the emitted class's OWN `_disconnectCleanups` drain uses for
 *     third-party-engine reparent survival), a bare DOM re-parent safely
 *     detaches-then-reattaches this controller's listeners with no
 *     duplication and no leaked state — this controller owns no expensive
 *     external resource, so eager symmetric attach/detach is correct here
 *     even though the emitted class's OWN listener wiring defers teardown
 *     for OTHER reasons.
 *
 * **What this controller does NOT do**: it never writes
 * `data-rozie-keynav-active` or `tabindex` itself — those are DECLARATIVE
 * `html\`\`` template bindings the compiler emitter stamps onto each item
 * (comparing the loop index to the live active value the author's own
 * `r-keynav:<focus-model>="…"` binding owns), so they update on the SAME
 * render pass as the rest of the component with zero imperative DOM writes
 * (SPEC §8's "idiomatic wiring -> compiler emission" half of the split).
 * This controller owns only what a declarative template cannot: focus,
 * scroll, and the imperative `r-keynav-active-class` toggle.
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */
import type { LitElement, ReactiveController, ReactiveControllerHost } from 'lit';
import {
  createKeynavStateMachine,
  normalizeClassTokens,
  type ClassValue,
  type KeynavConfig,
  type KeynavHost,
  type KeynavStateMachine,
  type KeynavWindower,
} from '@rozie/runtime-keynav-core';

export interface KeynavControllerOpts {
  /** Resolved `r-keynav:<focus-model>[.<modifier>…]` configuration (SPEC §3). */
  config: KeynavConfig;
  /** The `:source` array — explicit, or synthesized from a co-located `r-for` (SPEC §5). */
  getSource: () => unknown[];
  /** The live active-index value — reads the author's `r-keynav:<focus-model>="…"` binding. */
  getActive: () => number;
  /** Writes the active index — the SAME binding's setter (two-way, mirrors `r-model`). */
  setActive: (i: number) => void;
  /** `@keynav-commit` — Enter / click-on-active (SPEC §6: active only, never selection). */
  onCommit: (i: number) => void;
  /**
   * `r-keynav-active-class="…"` (SPEC §9) — additive class tokens toggled on
   * the active item via `classList.add`/`.remove`, on top of the always-
   * present `data-rozie-keynav-active` marker. Any shape `normalizeClassTokens`
   * accepts (string / array / `{ token: cond }` object / nested).
   */
  activeClass?: ClassValue;
  /** Optional full-dataset addressing for virtualized lists (SPEC §10). */
  windower?: KeynavWindower;
}

/**
 * A `ReactiveControllerHost` that is also a `LitElement` — every emitted
 * component this controller is instantiated on satisfies this (the emitter
 * always passes `this` from inside a `LitElement` subclass's own field
 * initializer, mirroring `createLitControllableProperty`'s `host: this`
 * convention).
 */
export type KeynavControllerHost = ReactiveControllerHost & LitElement;

export class KeynavController implements ReactiveController {
  private readonly host: KeynavControllerHost;
  private readonly opts: KeynavControllerOpts;
  private machine: KeynavStateMachine | null = null;
  /** Undefined until the first `hostUpdated()` runs — forces the initial active-change side effects to apply once, mirroring `useKeynav`'s effect running on mount. */
  private lastActive: number | undefined = undefined;

  constructor(host: KeynavControllerHost, opts: KeynavControllerOpts) {
    this.host = host;
    this.opts = opts;
    host.addController(this);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.machine?.onKeydown(e);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    const idx = this.resolveItemIndex(e.target);
    if (idx !== null) this.machine?.onPointerActivate(idx);
  };

  /**
   * T-71-08-01 (threat register) — `data-rozie-keynav-item` is an UNTRUSTED
   * DOM marker. Parse with `Number()` and bounds-check against the current
   * item count BEFORE it ever reaches the reducer; the reducer also clamps
   * as a second line of defense (71-03's `onPointerActivate`), but a
   * malformed/out-of-range index is REJECTED here first, never silently
   * coerced. `closest()` (not a direct attribute read off `e.target`) so a
   * pointerdown on a descendant of the marked item element still resolves.
   */
  private resolveItemIndex(target: EventTarget | null): number | null {
    if (!(target instanceof Element)) return null;
    const el = target.closest('[data-rozie-keynav-item]');
    if (!el) return null;
    const raw = el.getAttribute('data-rozie-keynav-item');
    if (raw === null) return null;
    const idx = Number(raw);
    if (!Number.isInteger(idx) || idx < 0) return null;
    const total = this.opts.windower
      ? this.opts.windower.count()
      : this.opts.getSource().length;
    if (idx >= total) return null;
    return idx;
  }

  hostConnected(): void {
    const host: KeynavHost = {
      getSource: () => this.opts.getSource(),
      getActive: () => this.opts.getActive(),
      setActive: (i) => this.opts.setActive(i),
      commit: (i) => this.opts.onCommit(i),
    };
    // `exactOptionalPropertyTypes` — conditional assignment, mirrors 71-03's
    // `itemMetaAt` fix / the React reference's identical `windower` build.
    if (this.opts.windower !== undefined) {
      host.windower = this.opts.windower;
    }
    this.machine = createKeynavStateMachine(host, this.opts.config);

    // Landmine 6 — delegation attaches on the SHADOW ROOT (`renderRoot`),
    // never `document`: `r-keynav-item`-marked children live behind the
    // shadow boundary, and a document-level listener would also miss
    // events that never cross the boundary depending on composed-path
    // semantics for non-composed synthetic events in tests.
    const root = this.host.renderRoot;
    root.addEventListener('keydown', this.onKeyDown as EventListener);
    root.addEventListener('pointerdown', this.onPointerDown as EventListener);

    // Force the next hostUpdated() to apply the active-change side effects
    // at least once per connect (mirrors useKeynav's effect running on
    // mount, since `active` is always a "change" from the undefined baseline).
    this.lastActive = undefined;
  }

  hostDisconnected(): void {
    const root = this.host.renderRoot;
    root.removeEventListener('keydown', this.onKeyDown as EventListener);
    root.removeEventListener(
      'pointerdown',
      this.onPointerDown as EventListener,
    );
    this.machine?.dispose();
    this.machine = null;
  }

  /**
   * Lit's own reactive-controller lifecycle hook — called by
   * `ReactiveElement` after EVERY host update, once the DOM has been
   * patched. Manually diffs `getActive()` against the last-seen value so the
   * imperative-only work below (focus / scroll / active-class) runs exactly
   * once per active-CHANGE (SPEC §9), never once per unrelated re-render —
   * the same guarantee `useKeynav`'s `[active, rootRef]`-keyed effect gives
   * React, expressed here via manual diffing instead of a dependency array
   * because `ReactiveController` has no built-in dependency-array concept.
   */
  hostUpdated(): void {
    const active = this.opts.getActive();
    if (active === this.lastActive) return;
    this.lastActive = active;
    this.applyActiveSideEffects(active);
  }

  private applyActiveSideEffects(active: number): void {
    if (!Number.isFinite(active)) return;
    const root = this.host.renderRoot;
    const activeEl = root.querySelector<HTMLElement>(
      `[data-rozie-keynav-item="${active}"]`,
    );

    // SPEC §9 — additive active-class toggle. `data-rozie-keynav-active` is
    // ALWAYS present (emitter-owned, declarative); this is the OPTIONAL
    // extra author-class toggle, necessarily imperative because there is no
    // reactive-render slot for "the currently active list item" the way a
    // `class=${…}` binding merges the rest of an element's classes.
    if (this.opts.activeClass !== undefined) {
      const tokens = normalizeClassTokens(this.opts.activeClass);
      if (tokens.length > 0) {
        for (const el of root.querySelectorAll<HTMLElement>(
          '[data-rozie-keynav-item]',
        )) {
          el.classList.remove(...tokens);
        }
        if (activeEl) activeEl.classList.add(...tokens);
      }
    }

    // Tabindex model (SPEC §3) — DOM focus follows the active item. The
    // `tabindex` VALUE itself is a declarative template binding
    // (emitter-owned); only the imperative `.focus()` call belongs here.
    if (this.opts.config.focusModel === 'tabindex' && activeEl) {
      activeEl.focus();
    }

    // SPEC §10 — windower present: drive its `scrollToIndex`. No windower:
    // fall back to `scrollIntoView` on the rendered node.
    if (this.opts.windower) {
      this.opts.windower.scrollToIndex(active, { align: 'nearest' });
    } else if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }
}
