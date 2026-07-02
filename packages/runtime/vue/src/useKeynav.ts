/**
 * `useKeynav` — the Vue composable for the `r-keynav` primitive (SPEC.md,
 * Phase 71). Modeled on the React REFERENCE implementation (Plan 71-04,
 * `packages/runtime/react/src/useKeynav.ts`) — same split, same
 * `@rozie/runtime-keynav-core` wiring, Vue-idiomatic shell.
 *
 * Wraps `@rozie/runtime-keynav-core`'s framework-neutral
 * `createKeynavStateMachine` (Plan 71-03) with a `onMounted` root
 * `keydown`/`pointerdown` delegation (no per-item listeners, SPEC §8) plus a
 * `watch(...)` keyed on the live active index for the imperative-only
 * concerns a declarative template binding genuinely cannot express: DOM
 * `.focus()` for the tabindex model, the SPEC §9 active-class toggle, and
 * scroll-into-view / windower `scrollToIndex` follow.
 *
 * VUE-SPECIFIC SIMPLIFICATION vs React: Vue's `setup()` runs EXACTLY ONCE
 * per component instance (the "setup-runs-once" reactivity model, see
 * PROJECT.md) — there is no per-render re-invocation the way React's
 * function-component body re-runs on every render. `opts` is therefore
 * captured ONCE, directly, with no `optsRef`/latest-ref indirection: every
 * closure below (`host.getSource`, `host.getActive`, …) already reads
 * through the SAME long-lived `opts` object for the composable's whole
 * lifetime — React's `useKeynav` needs a latest-ref stash specifically to
 * defend against re-render-driven stale closures, a class of bug that does
 * not exist here.
 *
 * The reactive-to-`active` `watch(...)` call is registered INSIDE
 * `onMounted` (not at the top level of the composable) for a load-bearing
 * reason: `{ immediate: true }` fires SYNCHRONOUSLY at watcher-creation
 * time, and `rootRef.value` is `null` until after the component mounts. A
 * top-level `watch(..., { immediate: true })` would therefore run its first
 * (initial-active-state) pass against a null root and silently no-op the
 * mount-time focus/scroll/active-class application. Registering the watcher
 * inside `onMounted` (which still runs within the component's active effect
 * scope, so Vue auto-stops it on unmount — no manual cleanup needed) means
 * the immediate first fire sees a populated `rootRef.value`.
 *
 * **What this composable does NOT do**: it never writes
 * `data-rozie-keynav-active` or `tabindex` itself — those are DECLARATIVE
 * template bindings the compiler emitter stamps onto each item (comparing
 * the loop index to the live active value the author's own
 * `r-keynav:<focus-model>="…"` binding owns), so they update on the SAME
 * render pass as the rest of the component with zero imperative DOM writes
 * (SPEC §8's "idiomatic wiring -> compiler emission" half of the split).
 * This composable owns only what the template cannot: focus, scroll, and
 * the imperative `r-keynav-active-class` toggle.
 *
 * @public — runtime API consumed by emitted Vue SFCs with an `r-keynav` root.
 */
import { onMounted, onBeforeUnmount, watch, type Ref } from 'vue';
import {
  createKeynavStateMachine,
  normalizeClassTokens,
  type ClassValue,
  type KeynavConfig,
  type KeynavHost,
  type KeynavWindower,
} from '@rozie/runtime-keynav-core';

export interface UseKeynavOpts {
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
   * normalizer Vue's own `rozieClass` uses for the native `:class` render
   * path, factored out per SPEC §9 so the two paths cannot drift.
   */
  activeClass?: ClassValue;
  /** Optional full-dataset addressing for virtualized lists (SPEC §10). */
  windower?: KeynavWindower;
}

export function useKeynav(
  rootRef: Ref<HTMLElement | null>,
  opts: UseKeynavOpts,
): void {
  onMounted(() => {
    const root = rootRef.value;
    if (!root) return;

    // `exactOptionalPropertyTypes` — build `windower` via conditional
    // property assignment rather than an object-literal `windower:
    // possiblyUndefined` (mirrors 71-03's `itemMetaAt` / the React
    // reference's identical fix): `KeynavHost['windower']` is optional-but-
    // absent, not optional-but-explicit-`undefined`.
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

    // T-71-05-01 (threat register) — `data-rozie-keynav-item` is an
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
    const onPointerDown = (e: PointerEvent): void => {
      const idx = resolveItemIndex(e.target);
      if (idx !== null) machine.onPointerActivate(idx);
    };

    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('pointerdown', onPointerDown);
    onBeforeUnmount(() => {
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('pointerdown', onPointerDown);
      machine.dispose();
    });

    // ---- Reactive to `active`: focus / scroll / active-class ----
    // A getter-form `watch` source: Vue tracks whatever reactive state
    // `opts.getActive()` reads INSIDE this call (the author's own
    // `ref`/`defineModel` binding), so the callback below fires exactly once
    // per active-change — never once per unrelated parent render. `{
    // immediate: true }` applies the initial (mount-time) active state; see
    // this module's doc comment for why the watcher is registered HERE
    // (inside onMounted) rather than at the composable's top level.
    watch(
      () => opts.getActive(),
      (active) => {
        if (!Number.isFinite(active)) return;
        const activeEl = root.querySelector<HTMLElement>(
          `[data-rozie-keynav-item="${active}"]`,
        );

        // SPEC §9 — additive active-class toggle. `data-rozie-keynav-active`
        // is ALWAYS present (emitter-owned, declarative, SPEC §9 first
        // paragraph); this is the OPTIONAL extra author-class toggle,
        // necessarily imperative because there is no reactive-render slot
        // for "the currently active list item" the way `:class` merges the
        // rest of an element's classes.
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
        // `tabindex` VALUE itself is a declarative template binding
        // (emitter-owned); only the imperative `.focus()` call belongs here.
        if (opts.config.focusModel === 'tabindex' && activeEl) {
          activeEl.focus();
        }

        // SPEC §10 — windower present: drive its `scrollToIndex`. No
        // windower: fall back to `scrollIntoView` on the rendered node.
        if (opts.windower) {
          opts.windower.scrollToIndex(active, { align: 'nearest' });
        } else if (activeEl) {
          activeEl.scrollIntoView({ block: 'nearest' });
        }
      },
      { immediate: true },
    );
  });
}
