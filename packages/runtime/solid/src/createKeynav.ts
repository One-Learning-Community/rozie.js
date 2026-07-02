/**
 * `createKeynav` — the Solid primitive for the `r-keynav` primitive
 * (SPEC.md, Phase 71). Modeled on the React REFERENCE implementation (Plan
 * 71-04, `packages/runtime/react/src/useKeynav.ts`) and the Vue/Svelte
 * target-pairs (Plans 71-05/71-06) — same `@rozie/runtime-keynav-core`
 * wiring, Solid-idiomatic shell (SPEC §8 table: "Solid | `createKeynav(...)`
 * primitive").
 *
 * Wraps `@rozie/runtime-keynav-core`'s framework-neutral
 * `createKeynavStateMachine` (Plan 71-03) with an `onMount` root
 * `keydown`/`pointerdown` delegation (no per-item listeners, SPEC §8) plus a
 * `createEffect` tracking the live active index for the imperative-only
 * concerns a declarative JSX binding genuinely cannot express: DOM
 * `.focus()` for the tabindex model, the SPEC §9 active-class toggle (via
 * `normalizeClassTokens`, the SAME normalizer Solid's own `rozieClass` uses
 * for the native `:class` render path), and scroll-into-view / windower
 * `scrollToIndex` follow.
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
 * **What this primitive does NOT do**: it never writes
 * `data-rozie-keynav-active` or `tabIndex` itself — those are DECLARATIVE
 * JSX bindings the compiler emitter stamps onto each item (comparing the
 * loop index to the live active value the author's own
 * `r-keynav:<focus-model>="…"` binding owns), so they update on the SAME
 * render pass as the rest of the component with zero imperative DOM writes
 * (SPEC §8's "idiomatic wiring -> compiler emission" half of the split).
 * This primitive owns only what JSX cannot: focus, scroll, and the
 * imperative `r-keynav-active-class` toggle.
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
    const machine = createKeynavStateMachine(host, opts.config);

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
    });
  });
}
