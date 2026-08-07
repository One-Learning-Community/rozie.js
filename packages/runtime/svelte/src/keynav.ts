/**
 * `keynav` — the Svelte 5 action for the `r-keynav` primitive (SPEC.md,
 * Phase 71 + Phase 77 grid/multi-group extension). Modeled on the React
 * REFERENCE implementation (Plan 71-04, extended Plan 77-03,
 * `packages/runtime/react/src/useKeynav.ts`) and the Vue target-pair (Plan
 * 71-05, extended Plan 77-04, `packages/runtime/vue/src/useKeynav.ts`) —
 * same `@rozie/runtime-keynav-core` wiring, Svelte-idiomatic shell (SPEC §8
 * table: "Svelte 5 | `keynav` action / `$effect`").
 *
 * Wraps `@rozie/runtime-keynav-core`'s framework-neutral
 * `createKeynavStateMachine` (Plan 71-03, grid branch Plan 77-01) with a
 * mount-time root `keydown`/`pointerdown` delegation (no per-item listeners,
 * SPEC §8) plus the imperative-only concerns a declarative template binding
 * genuinely cannot express: DOM `.focus()` for the tabindex model, the
 * SPEC §9 active-class toggle (via `normalizeClassTokens`, the SAME
 * normalizer the native `:class`/`rozieClass` path uses, per SPEC §9's
 * "factor that normalizer out cleanly so the two paths cannot drift"), and
 * scroll-into-view / windower `scrollToIndex` follow.
 *
 * SVELTE-5-SPECIFIC SHAPE — an action `update()`, not a separate `$effect`
 * block: this file is a PLAIN `.ts` module (no `.svelte`/`.svelte.ts`
 * extension), so it cannot itself call the `$effect(...)` rune — runes are
 * compiler macros only recognized inside files the Svelte preprocessor
 * compiles. Runtime-svelte's other helpers (`applyListeners`, `rozieClass`,
 * …) are ALL plain `.ts` for the same reason (this package ships SOURCE,
 * consumed directly by the consumer's own Svelte-aware build pipeline — see
 * `index.ts`'s module doc comment).
 *
 * Instead, `KeynavActionOpts` carries a bare top-level `active: number`
 * field (SEE its own doc comment below) alongside the functional
 * `getActive()` accessor. The compiler emits `active` as a genuine
 * (non-closure) read inside the `use:keynav={{ …, active, … }}` object
 * literal — ordinary, well-documented Svelte 5 reactivity: any `$state` read
 * directly during a reactive expression's evaluation (not deferred inside a
 * nested, uninvoked function) is a tracked dependency of that expression's
 * effect (the exact same mechanism `use:tooltip={{ text: message }}`-style
 * action parameters rely on everywhere in the Svelte ecosystem). Because the
 * object literal is rebuilt (a new reference) whenever `active` changes,
 * Svelte's own action contract — "`update(next)` runs when the action's
 * parameter changes, by reference" (see `applyListeners.ts`'s identical
 * citation) — calls `update(next)` on every active-change, and `update` runs
 * the SAME imperative active-effects (`applyActiveEffects`) `keynav` itself
 * runs once at mount for the STARTING active value. No `$effect` is needed:
 * Svelte's own template reactivity IS the "watch active" mechanism here.
 *
 * Phase 77 — `onPage` (grid boundary/paging, forwarded as `host.page`) and
 * `gridColumns` (the `.grid(<expr>)` column-count getter) are both OPTIONAL;
 * presence is snapshotted from the INITIAL `opts` at action-mount time
 * (mirrors the pre-existing `windower` convention: no v1 fixture flips a
 * component between grid/non-grid or paged/non-paged mid-lifecycle), while
 * the VALUE `gridColumns()` returns is re-read fresh on every keydown via
 * `currentOpts.gridColumns!()` — the SAME `currentOpts` indirection every
 * other opt already goes through on `update()`, so a rune-backed column
 * count stays live across re-renders without re-instantiating the machine.
 *
 * Phase 77 (T-77-03-03) — an author may set the active index in the SAME
 * tick a dataset swaps (grid paging), so the item element for the new active
 * index may not exist in the DOM yet when `applyActiveEffects` runs (at
 * mount OR from `update()`). `runActiveEffects` (below) applies the normal
 * focus/scroll/class-toggle pass once synchronously; if no element is found,
 * it schedules exactly ONE `requestAnimationFrame`-deferred re-query. A new
 * active-change (a fresh `update()` call) cancels any still-pending deferred
 * pass from the PREVIOUS change before running its own (mirrors the React
 * reference's effect-cleanup-cancels-prior-rAF behavior); the deferred
 * callback is additionally guarded so it only re-applies if `active` is
 * STILL the value it was scheduled for — a stale pass must never steal focus
 * from a newer navigation. No polling loop, no bespoke scheduler.
 *
 * **What this action does NOT do**: it never writes
 * `data-rozie-keynav-active` or `tabindex` itself — those are DECLARATIVE
 * template bindings the compiler emitter stamps onto each item (comparing
 * the loop index to the live active value the author's own
 * `r-keynav:<focus-model>="…"` binding owns), so they update on the SAME
 * render pass as the rest of the component with zero imperative DOM writes
 * (SPEC §8's "idiomatic wiring -> compiler emission" half of the split).
 * This action owns only what the template cannot: focus, scroll, and the
 * imperative `r-keynav-active-class` toggle. It also never computes grid
 * stride/boundary arithmetic itself — that is entirely the reducer's job
 * (`@rozie/runtime-keynav-core`'s grid branch); this action's only new
 * Phase-77 responsibility is plumbing `onPage`/`gridColumns` through to the
 * machine.
 *
 * Plan 260806-lz7 — the tabindex model's first/redundant focus+scroll pass
 * (mount, or an `{#if}`-gated root re-appearing as a fresh action instance)
 * is gated by `@rozie/runtime-keynav-core`'s `focusIsWithinScope`
 * strict-containment predicate: it only runs when DOM focus is already
 * inside the owning component (via the optional `getFocusScope` opt, or the
 * compiler-emitted root itself). A genuine navigation pass (the active INDEX
 * changing) is never gated. See `focusGuard.ts`'s module doc comment for the
 * full rule.
 *
 * @public — runtime API consumed by emitted `.svelte` files with an
 * `r-keynav` root.
 */
import {
  createKeynavStateMachine,
  focusIsWithinScope,
  normalizeClassTokens,
  type ClassValue,
  type KeynavConfig,
  type KeynavHost,
  type KeynavPageDetail,
  type KeynavWindower,
} from '@rozie/runtime-keynav-core';

export interface KeynavActionOpts {
  /** Resolved `r-keynav:<focus-model>[.<modifier>…]` configuration (SPEC §3). */
  config: KeynavConfig;
  /**
   * The live active-index value, read DIRECTLY (not via `getActive()`) at
   * `use:keynav={{ …, active, … }}` construction time — the ONLY reason this
   * field exists is so Svelte's fine-grained template reactivity tracks it
   * as a genuine dependency of the action's parameter expression, which is
   * what makes Svelte call `update(next)` on every active-change (see this
   * module's doc comment). Never read for its VALUE inside this file — every
   * actual read goes through `getActive()` below, which is always live
   * regardless of when its closure was captured.
   */
  active: number;
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
   * index. Read through `currentOpts`, same as `onCommit`.
   */
  onPage?: (detail: KeynavPageDetail) => void;
  /**
   * `.grid(<expr>)` (SPEC §3, §7.1, Phase 77) — the column-count getter that
   * selects the 2D grid branch of the reducer. Presence is snapshotted once
   * at action-mount time (same convention as `windower`); the VALUE it
   * returns is re-read fresh on every keydown via `currentOpts.gridColumns`,
   * so a dynamic/reactive column count (`$state`-backed) never goes stale.
   * Absent means 1D mode — `config` is handed to the machine completely
   * unmodified (no `grid` key), which is what keeps every existing 1D
   * behavior and emitted call byte-identical.
   */
  gridColumns?: () => number;
  /**
   * Plan 260806-lz7 — the strict-containment focus scope. Lazily resolved
   * component-scope element refs (read fresh every pass, never captured
   * once). Optional and additive: an older leaf that omits this field takes
   * the `documentHasRealFocus` compatibility fallback rather than strict
   * containment — see `keynav.ts`'s module doc comment.
   */
  getFocusScope?: () => Element | readonly (Element | null)[] | null;
}

// Plan 260806-lz7 — builds the anchor list `focusIsWithinScope` checks
// containment against. When `getFocusScope` is ABSENT (an older leaf calling
// this action without having been regenerated), NO anchor list is built at
// all — `focusIsWithinScope` then takes its pinned `documentHasRealFocus`
// fallback, preserving the pre-fix document-scoped behavior for that leaf.
// When `getFocusScope` IS present, its resolved value is combined with the
// keynav root itself — appending the root is a no-op in the normal case
// (the root is inside the component) and is what keeps a
// `<slot portal />`-relocated keynav root working, since focus inside a
// portalled root is still "within the component" for this primitive.
function resolveFocusScope(
  opts: KeynavActionOpts,
  node: HTMLElement,
): Element | readonly (Element | null)[] | null | undefined {
  if (opts.getFocusScope === undefined) return undefined;
  const extra = opts.getFocusScope();
  const list = extra == null ? [] : Array.isArray(extra) ? [...extra] : [extra];
  list.push(node);
  return list;
}

/**
 * The imperative-only active-change concerns a declarative template binding
 * cannot express: the SPEC §9 additive active-class toggle, `.focus()` for
 * the tabindex model, and scroll-into-view / windower `scrollToIndex`
 * follow. Called once at mount (for the starting active value) and again
 * from `update()` on every subsequent active-change (see this module's doc
 * comment for why `update()` fires reliably). Returns whether an element for
 * `active` was found in the DOM — Phase 77's `runActiveEffects` uses this to
 * decide whether to schedule a deferred retry (T-77-03-03).
 *
 * `mayApply` (Plan 260806-lz7) — computed ONCE by the caller
 * (`runActiveEffects`, for both its synchronous call and its deferred rAF
 * retry, which reuses the SAME value rather than recomputing) and threaded
 * down as a plain parameter, since this function is a pure module-level
 * helper with no closure state of its own to consult. Gates the focus +
 * scroll calls only — the SPEC §9 active-class toggle stays unconditional.
 */
function applyActiveEffects(
  node: Element,
  active: number,
  opts: KeynavActionOpts,
  mayApply: boolean,
): boolean {
  if (!Number.isFinite(active)) return true;
  const activeEl = node.querySelector<HTMLElement>(
    `[data-rozie-keynav-item="${active}"]`,
  );

  // SPEC §9 — additive active-class toggle. `data-rozie-keynav-active` is
  // ALWAYS present (emitter-owned, declarative, SPEC §9 first paragraph);
  // this is the OPTIONAL extra author-class toggle, necessarily imperative
  // because there is no reactive-render slot for "the currently active list
  // item" the way `:class` merges the rest of an element's classes.
  if (opts.activeClass !== undefined) {
    const tokens = normalizeClassTokens(opts.activeClass);
    if (tokens.length > 0) {
      // `.forEach(...)`, not `for...of` — `NodeListOf<T>` only gets a
      // `[Symbol.iterator]()` when a consumer's tsconfig includes the
      // `DOM.Iterable` lib. This package ships raw `.ts` source (Svelte
      // components compile against the author's own source, unlike
      // React/Vue's pre-built `dist/*.d.ts`), so a consumer's tsc
      // typechecks this function body directly — `forEach` is defined on
      // `NodeListOf` unconditionally (base `DOM` lib), so this stays
      // portable regardless of the consumer's `lib` array.
      node.querySelectorAll<HTMLElement>('[data-rozie-keynav-item]').forEach((el) => {
        el.classList.remove(...tokens);
      });
      if (activeEl) activeEl.classList.add(...tokens);
    }
  }

  // Tabindex model (SPEC §3) — DOM focus follows the active item. The
  // `tabindex` VALUE itself is a declarative template binding (emitter-
  // owned); only the imperative `.focus()` call belongs here. Plan
  // 260806-lz7: gated behind `mayApply` — a first/redundant pass only
  // focuses when the composed active element is already inside the owning
  // component; a genuine navigation pass always focuses.
  if (mayApply && opts.config.focusModel === 'tabindex' && activeEl) {
    activeEl.focus();
  }

  // SPEC §10 — windower present: drive its `scrollToIndex`. No windower:
  // fall back to `scrollIntoView` on the rendered node. Plan 260806-lz7:
  // same `mayApply` gate as the focus call above.
  if (mayApply) {
    if (opts.windower) {
      opts.windower.scrollToIndex(active, { align: 'nearest' });
    } else if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  return activeEl !== null;
}

/**
 * Svelte 5 action: `use:keynav={{ config, active, getSource, getActive,
 * setActive, onCommit, activeClass?, windower?, onPage?, gridColumns? }}` on
 * the `r-keynav` root element. Attaches a single root
 * `keydown`/`pointerdown` delegation (no per-item listeners, SPEC §8)
 * driving `@rozie/runtime-keynav-core`'s state machine, and applies the
 * imperative active-change effects (see `applyActiveEffects`) once at mount
 * and again on every subsequent `update()` call (fired by Svelte whenever
 * `opts.active` changes — see this module's doc comment).
 */
export function keynav(
  node: HTMLElement,
  opts: KeynavActionOpts,
): { update(next: KeynavActionOpts): void; destroy(): void } {
  // Mutable stash — kept in sync by `update()` so the host's closures (used
  // by the state machine at arbitrary future event times) always read the
  // LATEST callbacks/config, mirroring the defensive latest-ref discipline
  // the React/Vue references use (`optsRef`/direct `opts` capture).
  let currentOpts = opts;

  const host: KeynavHost = {
    getSource: () => currentOpts.getSource(),
    getActive: () => currentOpts.getActive(),
    setActive: (i) => currentOpts.setActive(i),
    commit: (i) => currentOpts.onCommit(i),
  };
  // `exactOptionalPropertyTypes` — build `windower` via conditional property
  // assignment rather than an object-literal `windower: possiblyUndefined`
  // (mirrors 71-03's `itemMetaAt` / the React and Vue references' identical
  // fix): `KeynavHost['windower']` is optional-but-absent, not
  // optional-but-explicit-`undefined`. Snapshot at mount — no v1 fixture
  // swaps a windower's identity mid-lifecycle (SPEC §10 wiring lands with a
  // future virtualized-list plan); revisit if that changes.
  if (opts.windower !== undefined) {
    host.windower = opts.windower;
  }
  // Phase 77 — `onPage` presence snapshotted once at mount (same convention
  // as `windower` above); the forwarded function itself always delegates
  // through `currentOpts`, so a re-rendered handler identity never requires
  // re-attaching the root listeners.
  if (opts.onPage !== undefined) {
    host.page = (detail) => currentOpts.onPage?.(detail);
  }

  // Phase 77 — grid config. `gridColumns` presence is ALSO snapshotted once
  // at mount; when present, the machine's config gains a `grid` entry whose
  // `columns()` getter permanently delegates through `currentOpts` (never
  // captures a single mount's closure directly — see the module doc
  // comment) so a dynamic/reactive column count stays live across
  // `update()` calls without re-instantiating the machine. Absent: `config`
  // is handed to the machine completely unmodified — no `grid` key, byte-
  // identical to pre-Phase-77 1D behavior.
  const config: KeynavConfig =
    opts.gridColumns !== undefined
      ? { ...opts.config, grid: { columns: () => currentOpts.gridColumns!() } }
      : opts.config;
  const machine = createKeynavStateMachine(host, config);

  // T-71-06-01 (threat register) — `data-rozie-keynav-item` is an
  // UNTRUSTED DOM marker. Parse with `Number()` and bounds-check against the
  // current item count BEFORE it ever reaches the reducer; the reducer also
  // clamps as a second line of defense (71-03's `onPointerActivate`), but a
  // malformed/out-of-range index is REJECTED here first, never silently
  // coerced.
  const resolveItemIndex = (target: EventTarget | null): number | null => {
    if (!(target instanceof Element)) return null;
    const el = target.closest('[data-rozie-keynav-item]');
    if (!el) return null;
    const raw = el.getAttribute('data-rozie-keynav-item');
    if (raw === null) return null;
    const idx = Number(raw);
    if (!Number.isInteger(idx) || idx < 0) return null;
    const total = currentOpts.windower
      ? currentOpts.windower.count()
      : currentOpts.getSource().length;
    if (idx >= total) return null;
    return idx;
  };

  // Plan 260806-lz7 — each delegated handler marks the attachment as
  // "really interacted with" BEFORE dispatching into the state machine, so
  // the active-change pass this same event triggers (via `update()`) sees
  // the flag already set when it runs.
  const onKeyDown = (e: KeyboardEvent): void => {
    hasInteracted = true;
    machine.onKeydown(e);
  };
  const onPointerDown = (e: PointerEvent): void => {
    hasInteracted = true;
    const idx = resolveItemIndex(e.target);
    if (idx !== null) machine.onPointerActivate(idx);
  };
  // DOM focus can land on an item WITHOUT a keydown or pointerdown ever
  // firing on the node — a programmatic `.focus()` call (assistive tech,
  // test automation) is the common case, but it's really any focus arrival
  // this delegation model can't otherwise observe. `focusin` bubbles (unlike
  // `focus`), so a single node listener catches it the same way keydown/
  // pointerdown already do. `moveTo` only sets `active`, never commits —
  // syncing the roving-tabindex model's notion of "current item" to
  // wherever DOM focus ACTUALLY is, so a subsequent arrow key moves
  // relative to the real focus target instead of a stale prior `active`
  // (T-77-08-05 — found via 77-08's real-DOM Docker VR run: date-picker's
  // 260802-hla spec `.focus()`s a day cell directly, then presses
  // ArrowRight, which used to move relative to whatever `active` happened
  // to be BEFORE that focus call).
  const onFocusIn = (e: FocusEvent): void => {
    hasInteracted = true;
    const idx = resolveItemIndex(e.target);
    if (idx !== null) machine.moveTo(idx);
  };

  node.addEventListener('keydown', onKeyDown);
  node.addEventListener('pointerdown', onPointerDown);
  node.addEventListener('focusin', onFocusIn);

  // Phase 77 (T-77-03-03) — tracks the currently-pending deferred rAF pass
  // (if any) so a NEW active-change can cancel it before scheduling its
  // own, and so `destroy()` can cancel a still-pending pass.
  let activeRafId: number | null = null;

  // Plan 260806-lz7 — the last active index a focus/scroll pass actually
  // resolved for THIS attachment (one action instance = one keynav root
  // element). Distinguishes a first/redundant pass (guarded by
  // `focusIsWithinScope`) from a genuine navigation pass (unconditional).
  // Seeded null; lives in the action's closure, so a fresh `keynav(node,
  // opts)` call (a new action instance — Svelte destroys and recreates the
  // action on root identity change, e.g. an `{#if}`-gated root) naturally
  // starts a new one.
  let lastFocusedActive: number | null = null;
  // Plan 260806-lz7 — true once a REAL DOM interaction (keydown, pointerdown,
  // or focusin) has reached this attachment's delegated listeners. A value
  // change alone is NOT sufficient evidence of a navigation — a consumer may
  // resolve its true mount-time active index through an app-level effect
  // deferred after the initial render (date-picker's `seedActiveDay`, one
  // `requestAnimationFrame` after mount), which looks identical to a real
  // navigation on a plain value diff — found via this plan's own Docker VR
  // run against @rozie-ui/date-picker.
  let hasInteracted = false;

  // Runs `applyActiveEffects` once synchronously; if no element was found
  // for `active` (e.g. a same-tick grid-paging dataset swap hasn't rendered
  // the landing item yet), schedules exactly ONE `requestAnimationFrame`-
  // deferred re-query, guarded so it only re-applies if `active` is STILL
  // the value it was scheduled for — a stale pass must never steal focus
  // from a newer navigation. Called both at mount and from every subsequent
  // `update()`.
  function runActiveEffects(active: number, opts: KeynavActionOpts): void {
    if (activeRafId !== null) {
      cancelAnimationFrame(activeRafId);
      activeRafId = null;
    }

    // Plan 260806-lz7 — computed ONCE per `runActiveEffects` invocation (not
    // per `applyActiveEffects` call) so the deferred rAF retry below reuses
    // the SAME may-apply decision the synchronous pass made, rather than
    // re-evaluating against a `lastFocusedActive` this same invocation
    // already advanced to `active`. This is what keeps Svelte's
    // unconditional `update()` re-application guarded too, symmetric with
    // the other five implementations. Also requires `hasInteracted` — see
    // its declaration's doc comment.
    const isNavigationPass =
      hasInteracted && lastFocusedActive !== null && lastFocusedActive !== active;
    const mayApply =
      isNavigationPass || focusIsWithinScope(resolveFocusScope(opts, node), node.ownerDocument);
    lastFocusedActive = active;

    const found = applyActiveEffects(node, active, opts, mayApply);
    if (!found) {
      activeRafId = requestAnimationFrame(() => {
        activeRafId = null;
        if (currentOpts.getActive() !== active) return;
        applyActiveEffects(node, active, currentOpts, mayApply);
      });
    }
  }

  // Apply the STARTING active value's imperative effects at mount — mirrors
  // the Vue reference's `{ immediate: true }` watch (the active-class/focus/
  // scroll wiring applies for index 0's initial state too, not merely
  // subsequent changes).
  runActiveEffects(opts.getActive(), opts);

  return {
    update(next) {
      currentOpts = next;
      runActiveEffects(next.getActive(), next);
    },
    destroy() {
      node.removeEventListener('keydown', onKeyDown);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('focusin', onFocusIn);
      if (activeRafId !== null) {
        cancelAnimationFrame(activeRafId);
        activeRafId = null;
      }
      machine.dispose();
    },
  };
}
