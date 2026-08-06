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
  type KeynavPageDetail,
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
  /**
   * `@keynav-page` (SPEC §3, §4.1, Phase 77) — forwarded as the state
   * machine's `host.page` hook. The grid branch of the reducer never moves
   * `active` on a boundary/page key; it reports the attempted move and the
   * author (who owns the dataset) advances the page and sets the landing
   * index.
   */
  onPage?: (detail: KeynavPageDetail) => void;
  /**
   * `.grid(<expr>)` (SPEC §3, §7.1, Phase 77) — the column-count getter that
   * selects the 2D grid branch of the reducer. Read fresh on every keydown
   * via `this.opts.gridColumns!()` — a Lit class instance's `opts` object is
   * long-lived and its closures already read live `this.<field>` state on
   * every call (no `useRef`-style latest-ref indirection needed, unlike the
   * React reference — see the module doc comment). Absent means 1D mode —
   * `config` is handed to the machine completely unmodified (no `grid` key),
   * which is what keeps every existing 1D behavior and emitted construction
   * byte-identical.
   */
  gridColumns?: () => number;
  /**
   * Phase 77 multi-root DOM containment scoping (SPEC §6; see
   * `emitKeynav.ts`'s module doc comment for the full rationale). ONLY
   * present when the component has more than one `r-keynav` root — every
   * delegated event this controller handles is first checked against
   * `e.target.closest('[data-rozie-keynav-root="<rootMarker>"]')`, and every
   * `hostUpdated()` item query is scoped to that SAME subtree, so a
   * same-index item in a DIFFERENT group is never touched. Absent (the
   * overwhelming single-root case) disables the check entirely — every event
   * is processed and every query runs against the whole shadow root, exactly
   * as before Phase 77.
   */
  rootMarker?: string;
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
  /**
   * 77-07 — the element `applyActiveSideEffects` last actually focused (or
   * `null` if none was found). `hostConnected()`/`hostDisconnected()` are
   * tied to the CUSTOM ELEMENT's own connection to the document, which never
   * toggles for content conditionally rendered INSIDE that element's shadow
   * root (e.g. the date-picker drill panels behind `r-if`) — so, unlike
   * React/Vue's controllers, this controller's listener attachment was never
   * broken by a conditionally-mounted root (delegation lives on the
   * persistent `renderRoot`). The gap here is narrower but real: the
   * `lastActive`-only diff in `hostUpdated()` below would skip re-applying
   * focus when a panel is torn down and RECREATED (a fresh DOM subtree) but
   * happens to resolve to the SAME numeric active index as its previous
   * incarnation — the OLD focused element reference is gone, but nothing
   * would notice, since the diff only compares two numbers. Tracking
   * `.isConnected` on the last-applied element lets `hostUpdated()` detect
   * "the DOM I last focused no longer exists" and force a fresh apply even
   * when `active` itself repeats.
   */
  private lastAppliedEl: HTMLElement | null = null;
  /**
   * Phase 77 (T-77-05-03) — the single outstanding `requestAnimationFrame`
   * retry id (or `null`), mirroring the React reference's `rafId` local —
   * cancelled on a newer active-change and on `hostDisconnected()`.
   */
  private pendingRafId: number | null = null;

  constructor(host: KeynavControllerHost, opts: KeynavControllerOpts) {
    this.host = host;
    this.opts = opts;
    host.addController(this);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.matchesRootScope(e.target)) return;
    this.machine?.onKeydown(e);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (!this.matchesRootScope(e.target)) return;
    const idx = this.resolveItemIndex(e.target);
    if (idx !== null) this.machine?.onPointerActivate(idx);
  };

  // DOM focus can land on an item WITHOUT a keydown or pointerdown ever
  // firing on the root — a programmatic `.focus()` call (assistive tech,
  // test automation) is the common case, but it's really any focus arrival
  // this delegation model can't otherwise observe. `focusin` bubbles AND
  // composes across the shadow boundary (unlike `focus`), so the SAME
  // renderRoot-level listener catches it exactly like keydown/pointerdown
  // already do. `moveTo` only sets `active`, never commits — syncing the
  // roving-tabindex model's notion of "current item" to wherever DOM focus
  // ACTUALLY is, so a subsequent arrow key moves relative to the real focus
  // target instead of a stale prior `active` (T-77-08-05 — found via 77-08's
  // real-DOM Docker VR run: date-picker's 260802-hla spec `.focus()`s a day
  // cell directly, then presses ArrowRight, which used to move relative to
  // whatever `active` happened to be BEFORE that focus call).
  private readonly onFocusIn = (e: FocusEvent): void => {
    if (!this.matchesRootScope(e.target)) return;
    const idx = this.resolveItemIndex(e.target);
    if (idx !== null) this.machine?.moveTo(idx);
  };

  /**
   * Phase 77 multi-root DOM containment scoping (SPEC §6; `emitKeynav.ts`'s
   * module doc comment). `opts.rootMarker` is ONLY present for a component
   * with more than one `r-keynav` root — every other (single-root) component
   * skips this check entirely and processes every delegated event, exactly
   * as before Phase 77. When present, an event is in scope only if its
   * target has a `[data-rozie-keynav-root="<rootMarker>"]` ancestor — i.e.
   * it actually originated inside THIS group's subtree, not a sibling
   * group's. Evaluated lazily at real event-dispatch time (always after the
   * component's first render — nothing can dispatch a DOM event against
   * content that doesn't exist yet), so this needs no additional
   * first-update bookkeeping.
   */
  private matchesRootScope(target: EventTarget | null): boolean {
    if (this.opts.rootMarker === undefined) return true;
    if (!(target instanceof Element)) return false;
    return (
      target.closest(`[data-rozie-keynav-root="${this.opts.rootMarker}"]`) !==
      null
    );
  }

  /**
   * The DOM subtree this controller's item queries (`applyActiveSideEffects`)
   * are scoped to — the specific root element identified by `rootMarker` for
   * a multi-root component, else the whole shadow root (single-root case,
   * unchanged from before Phase 77). Returns `null` when `rootMarker` is
   * defined but its marked element isn't currently in the DOM — i.e. this
   * controller's OWN group isn't the one being shown right now (e.g. a
   * conditionally-rendered — `r-if` — drill/grid panel, such as
   * date-picker's months/years panels).
   *
   * lit-drill-seed-january (found 2026-08-05): this used to fall back to
   * `this.host.renderRoot` — the whole shadow root — under the (violated)
   * assumption that a marked root "should not happen [to be absent] once
   * the component has rendered at least once". A conditionally-rendered
   * panel is EXACTLY the case where that assumption doesn't hold, and the
   * fallback is unsafe: `data-rozie-keynav-item` index values are reused
   * 0..N-1 across every `r-keynav` group sharing one shadow root, so an
   * unscoped whole-root query can coincidentally match a DIFFERENT,
   * currently-visible group's item at the SAME numeric index. Concretely,
   * this caused an INACTIVE controller (whose own `active` never changed,
   * but whose `lastAppliedEl` went stale merely because a SIBLING group's
   * content was swapped by that OTHER group's own r-if) to steal DOM focus
   * — and then, via `onFocusIn` -> `moveTo()`, even the ACTIVE group's own
   * index — away from the group actually being entered (date-picker's
   * months-drill entry landing on January instead of the selected June).
   * Returning `null` here lets `applyActiveSideEffects` treat "my own group
   * isn't rendered" as nothing-to-do, never searching outside its own
   * group's boundary.
   */
  private queryScope(): ParentNode | null {
    if (this.opts.rootMarker === undefined) return this.host.renderRoot;
    return this.host.renderRoot.querySelector(
      `[data-rozie-keynav-root="${this.opts.rootMarker}"]`,
    );
  }

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
    // Phase 77 — `onPage` forwards to the state machine's `host.page` hook,
    // reading through `this.opts` on every call (long-lived class-field
    // opts object — no latest-ref indirection needed, see the module doc
    // comment).
    if (this.opts.onPage !== undefined) {
      host.page = (detail) => this.opts.onPage?.(detail);
    }

    // Phase 77 — grid config. `config` gains a `grid` entry ONLY when
    // `gridColumns` is present; the `columns()` getter permanently
    // delegates through `this.opts.gridColumns!()` so a dynamic/reactive
    // column count stays live without re-instantiating the machine (SPEC
    // §10). Absent: `config` is handed to the machine completely
    // unmodified — no `grid` key, byte-identical to pre-Phase-77 1D
    // behavior.
    const config: KeynavConfig =
      this.opts.gridColumns !== undefined
        ? {
            ...this.opts.config,
            grid: { columns: () => this.opts.gridColumns!() },
          }
        : this.opts.config;
    this.machine = createKeynavStateMachine(host, config);

    // Landmine 6 — delegation attaches on the SHADOW ROOT (`renderRoot`),
    // never `document`: `r-keynav-item`-marked children live behind the
    // shadow boundary, and a document-level listener would also miss
    // events that never cross the boundary depending on composed-path
    // semantics for non-composed synthetic events in tests. Phase 77 —
    // STILL true for a multi-root component: rather than minting a
    // per-root listener target (a controller re-architecture SPEC §6
    // explicitly avoids), every controller instance delegates on the SAME
    // shared shadow root and filters by `matchesRootScope()` inside the
    // handlers above.
    const root = this.host.renderRoot;
    root.addEventListener('keydown', this.onKeyDown as EventListener);
    root.addEventListener('pointerdown', this.onPointerDown as EventListener);
    root.addEventListener('focusin', this.onFocusIn as EventListener);

    // Force the next hostUpdated() to apply the active-change side effects
    // at least once per connect (mirrors useKeynav's effect running on
    // mount, since `active` is always a "change" from the undefined baseline).
    this.lastActive = undefined;
    this.lastAppliedEl = null;
  }

  hostDisconnected(): void {
    const root = this.host.renderRoot;
    root.removeEventListener('keydown', this.onKeyDown as EventListener);
    root.removeEventListener(
      'pointerdown',
      this.onPointerDown as EventListener,
    );
    root.removeEventListener('focusin', this.onFocusIn as EventListener);
    this.cancelPendingRetry();
    this.machine?.dispose();
    this.machine = null;
  }

  private cancelPendingRetry(): void {
    if (this.pendingRafId !== null) {
      cancelAnimationFrame(this.pendingRafId);
      this.pendingRafId = null;
    }
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
   *
   * Phase 77 (T-77-05-03) — an author may set the active index in the SAME
   * tick a dataset swaps (grid paging); by the time `hostUpdated()` runs the
   * DOM HAS been patched (Lit's own guarantee — this hook never fires before
   * the host's first update completes, reusing that existing ordering
   * guarantee rather than inventing a new "have we rendered yet" flag), but
   * the item for the NEW active index specifically may still be a frame
   * away if it depends on a second, cascading re-render. Mirrors the React
   * reference exactly: apply the normal pass once synchronously; if no
   * element was found, schedule exactly ONE `requestAnimationFrame`-deferred
   * retry, cancelled on a newer active-change/disconnect and guarded so it
   * only re-applies if `active` is STILL the value it was scheduled for.
   */
  hostUpdated(): void {
    const active = this.opts.getActive();
    // 77-07 — re-apply when EITHER `active` changed OR the last-focused
    // element is no longer connected (its subtree was torn down and
    // recreated by a conditionally-rendered — `r-if` — ancestor, e.g. the
    // date-picker drill panels; see the module doc comment on
    // `lastAppliedEl`). Without the second condition, re-entering such a
    // panel with the SAME resolved active index as its previous incarnation
    // would silently skip re-focusing, since the diff would only ever see
    // two equal numbers.
    const staleEl = this.lastAppliedEl !== null && !this.lastAppliedEl.isConnected;
    if (active === this.lastActive && !staleEl) return;
    this.lastActive = active;
    this.cancelPendingRetry();
    if (!Number.isFinite(active)) return;

    const result = this.applyActiveSideEffects(active);
    if (result === 'no-scope') {
      // lit-drill-seed-january follow-up — this controller's own group
      // isn't currently rendered (see `queryScope()`'s doc comment). Do NOT
      // leave `lastActive` recorded as "settled" at this value: if we did,
      // the NEXT time this exact numeric active value recurs once the
      // group's root reappears (e.g. date-picker's selectYear() re-resolving
      // $data.activeMonth back to the SAME already-selected month), the
      // `active === lastActive` guard above would short-circuit before
      // `staleEl` is even relevant — `lastAppliedEl` is null, not merely
      // disconnected, so `staleEl` reads false too — and this method would
      // return early forever, never re-applying focus to the remounted
      // group. Resetting to the pre-connect sentinel forces the very next
      // real update of this group to be treated as a fresh change.
      this.lastActive = undefined;
    } else if (result === 'not-found') {
      this.pendingRafId = requestAnimationFrame(() => {
        this.pendingRafId = null;
        if (this.opts.getActive() !== active) return;
        this.applyActiveSideEffects(active);
      });
    }
  }

  /**
   * Applies focus/scroll/class-toggle side effects for `active`, scoped to
   * this controller's own group. Returns `'no-scope'` when this group isn't
   * currently rendered at all (see `queryScope()`), `'not-found'` when the
   * group IS rendered but the specific item for `active` isn't (yet) in the
   * DOM (SPEC §10's one-frame-late case), or `'found'` on success.
   */
  private applyActiveSideEffects(active: number): 'no-scope' | 'not-found' | 'found' {
    const root = this.queryScope();
    if (root === null) {
      // This controller's own group isn't currently rendered (see
      // `queryScope()`'s doc comment — lit-drill-seed-january). There is
      // nothing in the DOM for THIS group to focus/scroll/class-toggle, and
      // — critically — no other group's item is a safe substitute. Clear
      // `lastAppliedEl` so a stale reference from before this group was torn
      // down doesn't linger (mirrors the "not found" bookkeeping below).
      this.lastAppliedEl = null;
      return 'no-scope';
    }
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

    // 77-07 — remember which element (if any) this pass actually applied
    // to, so a future `hostUpdated()` can detect "that element is gone"
    // even when `active`'s numeric value repeats (see `lastAppliedEl`'s
    // doc comment).
    this.lastAppliedEl = activeEl;

    return activeEl !== null ? 'found' : 'not-found';
  }
}
