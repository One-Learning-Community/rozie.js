/**
 * `createKeynav` — the Solid primitive for the `r-keynav` primitive
 * (SPEC.md, Phase 71 + Phase 77 grid/multi-group extension). Modeled on the
 * React REFERENCE implementation (Plan 71-04, extended Plan 77-03,
 * `packages/runtime/react/src/useKeynav.ts`) and the Vue/Svelte target-pairs
 * (Plans 71-05/71-06, extended Plans 77-04) — same
 * `@rozie/runtime-keynav-core` wiring, Solid-idiomatic shell (SPEC §8 table:
 * "Solid | `createKeynav(...)` primitive").
 *
 * Wraps `@rozie/runtime-keynav-core`'s framework-neutral
 * `createKeynavStateMachine` (Plan 71-03, grid branch Plan 77-01) with an
 * `onMount` root `keydown`/`pointerdown` delegation (no per-item listeners,
 * SPEC §8) plus a `createEffect` tracking the live active index for the
 * imperative-only concerns a declarative JSX binding genuinely cannot
 * express: DOM `.focus()` for the tabindex model, the SPEC §9 active-class
 * toggle (via `normalizeClassTokens`, the SAME normalizer Solid's own
 * `rozieClass` uses for the native `:class` render path), and
 * scroll-into-view / windower `scrollToIndex` follow.
 *
 * SOLID-SPECIFIC SHAPE — a callback-ref ACCESSOR, not a ref OBJECT: Solid's
 * idiom for a DOM ref is a plain `let fooRef: HTMLElement | null = null;`
 * variable assigned via a JSX callback ref (`ref={(el) => { fooRef = el; }}`
 * — see `packages/targets/solid/src/emit/emitScript.ts`'s ref-decl comment /
 * `emitTemplateAttribute.ts`'s `ref=` branch), NOT a `createSignal`/ref-object
 * wrapper. `createKeynav` therefore takes `rootRef: () => HTMLElement | null
 * | undefined` (an ACCESSOR closing over that plain variable), mirroring
 * `createOutsideClick`'s identical `refs: Array<() => Element | null |
 * undefined>` shape (`packages/runtime/solid/src/createOutsideClick.ts`) — by
 * the time `onMount` runs, the callback ref has already populated the
 * variable (Solid assigns callback refs synchronously while building the JSX
 * tree, which completes before `onMount` fires), so `rootRef()` reads a
 * non-null element inside the effect below.
 *
 * The reactive-to-`active` `createEffect(...)` fires IMMEDIATELY on
 * registration (Solid's `createEffect` runs its callback synchronously once
 * at creation, THEN re-runs on each tracked-dependency change) — no separate
 * `{ immediate: true }` flag is needed the way Vue's `watch` requires one;
 * this is Solid's default `createEffect` behavior, applying the initial
 * (mount-time, index-0) active state exactly like the Vue reference's `{
 * immediate: true }` watch. Reading `opts.getActive()` INSIDE the effect body
 * is what makes Solid track it as a dependency — the SAME "read the tracked
 * value directly inside the reactive scope" discipline every other Solid
 * effect in this codebase already follows (e.g. `emitScript.ts`'s `$watch`
 * lowering).
 *
 * The effect is registered INSIDE `onMount` (not at `createKeynav`'s top
 * level) for the SAME load-bearing reason the Vue reference documents:
 * `rootRef()` is `null`/`undefined` until after the component's initial JSX
 * tree is built, so a top-level effect's first (mount-time) pass would
 * silently no-op against a null root.
 *
 * Phase 77 — `onPage` (grid boundary/paging, forwarded as `host.page`) and
 * `gridColumns` (the `.grid(<expr>)` column-count getter) are both OPTIONAL.
 * Solid's component function runs exactly once per instance (like Vue), so
 * `opts` itself is the stable, whole-lifetime snapshot — no latest-ref
 * indirection needed. `gridColumns` is NOT read directly into the machine's
 * config — `config.grid.columns` delegates through `opts.gridColumns!()` on
 * every call (`opts.gridColumns` is itself the emitted `() => cols()`
 * closure, already reactive, so this stays live without re-instantiating the
 * machine).
 *
 * Phase 77 (T-77-03-03) — an author may set the active index in the SAME
 * tick a dataset swaps (grid paging), so the item element for the new active
 * index may not exist in the DOM yet when the effect body runs. The effect
 * applies its normal focus/scroll/class-toggle pass once synchronously; if
 * no element is found for the current active index, it schedules exactly
 * ONE `requestAnimationFrame`-deferred re-query, cancelled via Solid's own
 * `onCleanup` — called INSIDE `createEffect`, `onCleanup` registers a
 * cleanup that fires automatically right before the effect's NEXT re-run (a
 * newer active-change) or on disposal, which is exactly the
 * cancel-the-prior-pending-pass behavior the React reference's
 * effect-cleanup achieves, idiomatically, with no extra outer-scope state.
 * The deferred callback is additionally guarded so it only re-applies if
 * `active` is STILL the value it was scheduled for — a stale pass must never
 * steal focus from a newer navigation. No polling loop, no bespoke
 * scheduler.
 *
 * **What this primitive does NOT do**: it never writes
 * `data-rozie-keynav-active` or `tabIndex` itself — those are DECLARATIVE
 * JSX bindings the compiler emitter stamps onto each item (comparing the
 * loop index to the live active value the author's own
 * `r-keynav:<focus-model>="…"` binding owns), so they update on the SAME
 * render pass as the rest of the component with zero imperative DOM writes
 * (SPEC §8's "idiomatic wiring -> compiler emission" half of the split).
 * This primitive owns only what JSX cannot: focus, scroll, and the
 * imperative `r-keynav-active-class` toggle. It also never computes grid
 * stride/boundary arithmetic itself — that is entirely the reducer's job
 * (`@rozie/runtime-keynav-core`'s grid branch); this primitive's only new
 * Phase-77 responsibility is plumbing `onPage`/`gridColumns` through to the
 * machine.
 *
 * @public — runtime API consumed by emitted .tsx files with an `r-keynav` root.
 */
import { onMount, onCleanup, createEffect } from 'solid-js';
import {
  createKeynavStateMachine,
  normalizeClassTokens,
  type ClassValue,
  type KeynavConfig,
  type KeynavHost,
  type KeynavPageDetail,
  type KeynavWindower,
} from '@rozie/runtime-keynav-core';

export interface CreateKeynavOpts {
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
   * accepts (string / array / `{ token: cond }` object / nested) — the SAME
   * normalizer Solid's own `rozieClass` uses for the native `:class` render
   * path, factored out per SPEC §9 so the two paths cannot drift.
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
   * selects the 2D grid branch of the reducer. Absent means 1D mode —
   * `config` is handed to the machine completely unmodified (no `grid` key),
   * which is what keeps every existing 1D behavior and emitted call
   * byte-identical.
   */
  gridColumns?: () => number;
}

export function createKeynav(
  rootRef: () => HTMLElement | null | undefined,
  opts: CreateKeynavOpts,
): void {
  onMount(() => {
    const root = rootRef();
    if (!root) return;

    // `exactOptionalPropertyTypes` — build `windower` via conditional
    // property assignment rather than an object-literal `windower:
    // possiblyUndefined` (mirrors 71-03's `itemMetaAt` / the React/Vue/
    // Svelte references' identical fix): `KeynavHost['windower']` is
    // optional-but-absent, not optional-but-explicit-`undefined`.
    const host: KeynavHost = {
      getSource: () => opts.getSource(),
      getActive: () => opts.getActive(),
      setActive: (i) => opts.setActive(i),
      commit: (i) => opts.onCommit(i),
    };
    if (opts.windower !== undefined) {
      host.windower = opts.windower;
    }
    // Phase 77 — `onPage` forwards to `host.page` when the author wired
    // `@keynav-page`; absent entirely otherwise (no grid/page usage stays
    // byte-identical to pre-Phase-77).
    if (opts.onPage !== undefined) {
      host.page = (detail) => opts.onPage?.(detail);
    }

    // Phase 77 — grid config. When `gridColumns` is supplied, the machine's
    // config gains a `grid` entry whose `columns()` getter delegates through
    // `opts.gridColumns` on every call — see the module doc comment for why
    // no extra latest-ref indirection is needed here (Solid's
    // component-runs-once model means `opts` itself never goes stale).
    // Absent: `config` is handed to the machine completely unmodified — no
    // `grid` key, byte-identical to pre-Phase-77 1D behavior.
    const config: KeynavConfig =
      opts.gridColumns !== undefined
        ? { ...opts.config, grid: { columns: () => opts.gridColumns!() } }
        : opts.config;
    const machine = createKeynavStateMachine(host, config);

    // T-71-07-01 (threat register) — `data-rozie-keynav-item` is an
    // UNTRUSTED DOM marker. Parse with `Number()` and bounds-check against
    // the current item count BEFORE it ever reaches the reducer; the reducer
    // also clamps as a second line of defense (71-03's `onPointerActivate`),
    // but a malformed/out-of-range index is REJECTED here first, never
    // silently coerced.
    const resolveItemIndex = (target: EventTarget | null): number | null => {
      if (!(target instanceof Element)) return null;
      const el = target.closest('[data-rozie-keynav-item]');
      if (!el) return null;
      const raw = el.getAttribute('data-rozie-keynav-item');
      if (raw === null) return null;
      const idx = Number(raw);
      if (!Number.isInteger(idx) || idx < 0) return null;
      const total = opts.windower ? opts.windower.count() : opts.getSource().length;
      if (idx >= total) return null;
      return idx;
    };

    const onKeyDown = (e: KeyboardEvent): void => machine.onKeydown(e);
    const onPointerDown = (e: Event): void => {
      const idx = resolveItemIndex(e.target);
      if (idx !== null) machine.onPointerActivate(idx);
    };

    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('pointerdown', onPointerDown);
    onCleanup(() => {
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('pointerdown', onPointerDown);
      machine.dispose();
    });

    // ---- Reactive to `active`: focus / scroll / active-class ----
    // Reading `opts.getActive()` here (rather than outside the effect) is
    // what makes Solid track it — this effect re-runs exactly once per
    // active-change, and its FIRST run (synchronous, at registration) applies
    // the mount-time (index-0) active state, mirroring the Vue reference's
    // `{ immediate: true }` watch.
    createEffect(() => {
      const active = opts.getActive();
      if (!Number.isFinite(active)) return;

      // Extracted so it can run a SECOND time from the deferred rAF pass
      // below (Phase 77) without duplicating the focus/scroll/class-toggle
      // logic. Returns whether an element for `active` was found in the DOM.
      const applyActiveEffects = (): boolean => {
        const activeEl = root.querySelector<HTMLElement>(
          `[data-rozie-keynav-item="${active}"]`,
        );

        // SPEC §9 — additive active-class toggle. `data-rozie-keynav-active`
        // is ALWAYS present (emitter-owned, declarative, SPEC §9 first
        // paragraph); this is the OPTIONAL extra author-class toggle,
        // necessarily imperative because there is no reactive-render slot for
        // "the currently active list item" the way `:class` merges the rest of
        // an element's classes.
        if (opts.activeClass !== undefined) {
          const tokens = normalizeClassTokens(opts.activeClass);
          if (tokens.length > 0) {
            for (const el of root.querySelectorAll<HTMLElement>('[data-rozie-keynav-item]')) {
              el.classList.remove(...tokens);
            }
            if (activeEl) activeEl.classList.add(...tokens);
          }
        }

        // Tabindex model (SPEC §3) — DOM focus follows the active item. The
        // `tabIndex` VALUE itself is a declarative JSX binding (emitter-owned);
        // only the imperative `.focus()` call belongs here.
        if (opts.config.focusModel === 'tabindex' && activeEl) {
          activeEl.focus();
        }

        // SPEC §10 — windower present: drive its `scrollToIndex`. No windower:
        // fall back to `scrollIntoView` on the rendered node.
        if (opts.windower) {
          opts.windower.scrollToIndex(active, { align: 'nearest' });
        } else if (activeEl) {
          activeEl.scrollIntoView({ block: 'nearest' });
        }

        return activeEl !== null;
      };

      const found = applyActiveEffects();

      // Phase 77 (T-77-03-03) — an author may set the active index in the
      // SAME tick a dataset swaps (grid paging), so the item element for the
      // new active index may not exist yet at effect time. Retry EXACTLY
      // ONCE after the browser has painted — no polling loop, no bespoke
      // scheduler. `onCleanup` (called INSIDE the effect) fires
      // automatically right before this effect's NEXT re-run OR on
      // disposal — Solid's idiomatic equivalent of the React reference's
      // effect-cleanup-cancels-prior-rAF behavior, requiring no extra
      // outer-scope state. The deferred callback is additionally guarded so
      // it only re-applies if `active` is STILL the value it was scheduled
      // for; a stale pass must never steal focus from a newer navigation.
      if (!found) {
        const rafId = requestAnimationFrame(() => {
          if (opts.getActive() !== active) return;
          applyActiveEffects();
        });
        onCleanup(() => cancelAnimationFrame(rafId));
      }
    });
  });
}
