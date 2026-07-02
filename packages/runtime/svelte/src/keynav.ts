/**
 * `keynav` — the Svelte 5 action for the `r-keynav` primitive (SPEC.md,
 * Phase 71). Modeled on the React REFERENCE implementation (Plan 71-04,
 * `packages/runtime/react/src/useKeynav.ts`) and the Vue target-pair (Plan
 * 71-05, `packages/runtime/vue/src/useKeynav.ts`) — same
 * `@rozie/runtime-keynav-core` wiring, Svelte-idiomatic shell (SPEC §8 table:
 * "Svelte 5 | `keynav` action / `$effect`").
 *
 * Wraps `@rozie/runtime-keynav-core`'s framework-neutral
 * `createKeynavStateMachine` (Plan 71-03) with a mount-time root
 * `keydown`/`pointerdown` delegation (no per-item listeners, SPEC §8) plus
 * the imperative-only concerns a declarative template binding genuinely
 * cannot express: DOM `.focus()` for the tabindex model, the SPEC §9
 * active-class toggle (via `normalizeClassTokens`, the SAME normalizer the
 * native `:class`/`rozieClass` path uses, per SPEC §9's "factor that
 * normalizer out cleanly so the two paths cannot drift"), and
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
 * **What this action does NOT do**: it never writes
 * `data-rozie-keynav-active` or `tabindex` itself — those are DECLARATIVE
 * template bindings the compiler emitter stamps onto each item (comparing
 * the loop index to the live active value the author's own
 * `r-keynav:<focus-model>="…"` binding owns), so they update on the SAME
 * render pass as the rest of the component with zero imperative DOM writes
 * (SPEC §8's "idiomatic wiring -> compiler emission" half of the split).
 * This action owns only what the template cannot: focus, scroll, and the
 * imperative `r-keynav-active-class` toggle.
 *
 * @public — runtime API consumed by emitted `.svelte` files with an
 * `r-keynav` root.
 */
import {
  createKeynavStateMachine,
  normalizeClassTokens,
  type ClassValue,
  type KeynavConfig,
  type KeynavHost,
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
}

/**
 * The imperative-only active-change concerns a declarative template binding
 * cannot express: the SPEC §9 additive active-class toggle, `.focus()` for
 * the tabindex model, and scroll-into-view / windower `scrollToIndex`
 * follow. Called once at mount (for the starting active value) and again
 * from `update()` on every subsequent active-change (see this module's doc
 * comment for why `update()` fires reliably).
 */
function applyActiveEffects(
  node: Element,
  active: number,
  opts: KeynavActionOpts,
): void {
  if (!Number.isFinite(active)) return;
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
      for (const el of node.querySelectorAll<HTMLElement>('[data-rozie-keynav-item]')) {
        el.classList.remove(...tokens);
      }
      if (activeEl) activeEl.classList.add(...tokens);
    }
  }

  // Tabindex model (SPEC §3) — DOM focus follows the active item. The
  // `tabindex` VALUE itself is a declarative template binding (emitter-
  // owned); only the imperative `.focus()` call belongs here.
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
}

/**
 * Svelte 5 action: `use:keynav={{ config, active, getSource, getActive,
 * setActive, onCommit, activeClass?, windower? }}` on the `r-keynav` root
 * element. Attaches a single root `keydown`/`pointerdown` delegation (no
 * per-item listeners, SPEC §8) driving `@rozie/runtime-keynav-core`'s state
 * machine, and applies the imperative active-change effects (see
 * `applyActiveEffects`) once at mount and again on every subsequent
 * `update()` call (fired by Svelte whenever `opts.active` changes — see this
 * module's doc comment).
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
  const machine = createKeynavStateMachine(host, opts.config);

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

  const onKeyDown = (e: KeyboardEvent): void => machine.onKeydown(e);
  const onPointerDown = (e: PointerEvent): void => {
    const idx = resolveItemIndex(e.target);
    if (idx !== null) machine.onPointerActivate(idx);
  };

  node.addEventListener('keydown', onKeyDown);
  node.addEventListener('pointerdown', onPointerDown);

  // Apply the STARTING active value's imperative effects at mount — mirrors
  // the Vue reference's `{ immediate: true }` watch (the active-class/focus/
  // scroll wiring applies for index 0's initial state too, not merely
  // subsequent changes).
  applyActiveEffects(node, opts.getActive(), opts);

  return {
    update(next) {
      currentOpts = next;
      applyActiveEffects(node, next.getActive(), next);
    },
    destroy() {
      node.removeEventListener('keydown', onKeyDown);
      node.removeEventListener('pointerdown', onPointerDown);
      machine.dispose();
    },
  };
}
