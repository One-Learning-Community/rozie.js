# `r-roving` — a compiler-owned keyboard-navigation primitive — design

**Date:** 2026-07-02
**Status:** Approved (design) — pending spec review
**Topic:** Add a first-class author-side primitive for **roving keyboard list-navigation** (arrow/Home/End/typeahead + active-index + aria/id wiring + scroll-into-view) to the `.rozie` language. One declarative template directive → idiomatic native wiring in all six targets. Working name `r-roving` (see §12 open question on the name).

---

## 1. Why this primitive (the moat)

Across the ~28 `@rozie-ui` families, keyboard navigation is hand-rolled in **~23** sources and focus management in **~20** (Arrow/Home/End key switches, `.focus()`, `tabindex`, `aria-activedescendant`, per-option `:id`, scroll-into-view). The team already felt this so acutely it built `@rozie-ui/headless-core` (`listCore.rzts`, 243 LOC, ~25 fns) to dedupe the *behavior* — but every family still hand-wires ~30 lines per component, and `headless-core` is **component-library runtime code, not compiler-owned**.

Everyone else solves this at the runtime-library layer, imperatively:
- **Radix** `RovingFocusGroup` — wrapper component, roving-tabindex only, React-only, one package per framework.
- **React Aria** `useSelectableCollection` + `useTypeSelect` — the completeness gold standard (both focus models, virtualization-aware), but a pile of hooks returning prop-bags you spread; React-only.
- **Ark / Zag.js** — framework-agnostic state machines, but you still instantiate the machine and spread prop-getters per framework.

None is a **declarative template directive that compiles to idiomatic native wiring in six frameworks from one source.** That is the moat: Radix maintains six packages the *consumer* wires; a Rozie author writes `r-roving:activedescendant.vertical.loop` once and the *compiler* wires six idiomatic outputs. The guiding principle: **the primitive reads as markup, not as a hook** — everything the author touches lives in the template; the compiler owns the rest. This is the natural successor to `<listeners>` and `.outside`, which exist for exactly this "compiler owns the plumbing every author repeats" reason.

## 2. Scope

**v1 = roving list-navigation only.** One well-bounded primitive.

**Deferred (each a separate later spec):**
- **Focus trap + restore** (dialog/popover/command-palette overlays) — a sibling a11y primitive.
- **Standalone SSR-safe `$id`** (React-`useId`-style) — a small universal primitive; `r-roving` mints its own ids internally in v1.
- **Multiple nav groups per component** — v1 is one group per component (§7). No current family needs more; named groups (`r-roving="name"`) are a clean future extension.
- **Virtualization as a compiler primitive** — explicitly decoupled (§10). `r-roving` consumes a windowing *contract* the existing `headless-core` windowing already satisfies; promoting virtualization to a primitive is judged separately on its own (weaker) moat and its own (larger, `r-for`-touching) rebless.

## 3. Surface

Two template directives plus one optional config attribute and one event.

```
r-roving:<focus-model>[.<modifier>…]="<active-index binding>"   (on the nav root)
r-roving-item="{ label?, disabled? }"                            (on each item)
r-roving-active-class="<class spec>"                             (optional, on the root)
@roving-commit="…"                                              (Enter / click-on-active)
:source="<items array>"                                          (optional; else synthesized from co-located r-for)
```

**Focus models** (`<focus-model>` = the directive argument):
- `r-roving:activedescendant` — DOM focus stays on the root control; the active item is tracked virtually via `aria-activedescendant` pointing at its id. (listbox/combobox with an input.)
- `r-roving:tabindex` — DOM focus roves to the active item (`tabindex` `0`/`-1`, `.focus()` on change). (menu/toolbar/radio-group/tabs.)

**Modifiers** (reuse the existing dotted-modifier grammar):
- orientation: `.vertical` (default) / `.horizontal` / `.both`
- `.loop` — wrap past the ends (default: clamp)
- `.typeahead` — printable characters jump to a matching item by `label`
- `.skipdisabled` — skip `disabled` items (default: **on**; `.skipdisabled(false)` to include)

### 3.1 Examples

**Menu — roving-tabindex, items contained:**
```html
<div role="menu" r-roving:tabindex.vertical.loop="$data.active"
     :source="items" @roving-commit="run(items[$data.active])">
  <button role="menuitem" r-for="it in items :key it.id"
          r-roving-item="{ label: it.label, disabled: it.disabled }">
    {{ it.label }}
  </button>
</div>
```

**Combobox — activedescendant, input separate from the list (different subtrees):**
```html
<input role="combobox" r-roving:activedescendant.vertical="$data.active"
       :source="results" @roving-commit="choose(results[$data.active])"
       @input="onSearch($event)" />
<ul role="listbox">
  <li role="option" r-for="r in results :key r.id"
      r-roving-item="{ label: r.label }">{{ r.label }}</li>
</ul>
```

The single `r-roving` directive replaces, per family: the `active` state, the entire `@keydown` switch, per-item `:id`/`@pointermove`, `:aria-activedescendant`, and the scroll-into-view `$watch`.

## 4. Keyboard map

| Key | Action |
|---|---|
| Arrow (per orientation) | move active ±1 (wrap if `.loop`, skip disabled if `.skipdisabled`) |
| Home / End | move to first / last enabled |
| Enter | `@roving-commit` with the active index |
| printable chars | typeahead to matching `label` (if `.typeahead`) — case-insensitive prefix match, ~500ms buffer reset |
| (click on an item) | set active to it + `@roving-commit` |

`Escape`, `Tab`, and open/close semantics stay with the author (they belong to the surrounding widget, not to navigation).

## 5. Data model — data-driven core, DOM-driven sugar

The item set is a **data array**, not the rendered DOM — the hard-won React-Aria lesson, and required because the list may be virtualized (the listbox already is; the active item at index 5,000 has no rendered node to address).

- Explicit: `:source="results"` on the root — the same array `r-for` iterates.
- Sugar: omit `:source`, and the compiler **synthesizes it from the co-located `r-for`** it already sees in the IR, so a static menu reads clean and never mentions a source. One code path underneath (always the array), so virtualization is free.

`r-roving-item` tags each rendered row and conveys `{ label?, disabled? }` (label for typeahead; disabled for skip). Item index comes from the `r-for` context.

## 6. Boundary — the primitive owns *active*, not *selection*

`r-roving` manages the active index, DOM focus, and aria wiring. The **author** owns selection semantics via `@roving-commit` + the live active index (`run(...)`, `choose(...)`), and any selected-set state. Navigation ≠ selection; conflating them (single vs multiple, toggle vs replace, checkbox semantics) is where other libraries get muddy. This keeps the primitive small and un-opinionated about the widget it serves.

## 7. Association — shared state, not DOM containment

The directive and its items associate through **shared reactive state + `:source`**, not nesting — which is why the combobox case (input and `<ul>` in different subtrees) works: the compiler wires `:aria-activedescendant` on the input to the active `<li>`'s id and stamps id/active-marker onto each `<li>` because they share `$data.active` and `:source`, not because of DOM structure.

**v1: one nav group per component.** `r-roving-item` binds to *the* `r-roving` in the component. This avoids brittle "match items to directive by comparing `:source` expressions." Multiple independent lists in one component would use named groups — deferred (§2).

## 8. Emission architecture — hybrid, mirroring `.outside`

Split by what varies across frameworks:

**Generic behavior → per-target runtime controller.** The keydown state machine (move/wrap/skip-disabled/Home-End/typeahead/commit), pointer delegation, roving `.focus()`, and scroll-into-view are identical logic everywhere; they need only the source, the active-index get/set, and config. This lives in `@rozie/runtime-{react,vue,svelte,solid,angular,lit}` — **the same packages that already ship `useOutsideClick`/`createOutsideClick`** — as a small controller, idiomatic per target:

| Target | Runtime shape |
|---|---|
| React | `useRovingNav(...)` hook + effects |
| Vue | `useRovingNav(...)` composable in setup |
| Svelte 5 | `rovingNav` action / `$effect` |
| Solid | `createRovingNav(...)` primitive |
| Angular | reactive controller in the component class |
| Lit | `RovingNavController` (ReactiveController) |

**Idiomatic wiring → compiler emission.** The compiler emits, per target: on the root, the keydown hookup + `:aria-activedescendant` (activedescendant mode) + a stable group id + a mount-time registration (root, config, source getter, index get/set, commit callback, optional windower); on each item, a stable id, a `tabindex` binding (roving mode), and one linchpin attribute — `data-rozie-roving-item="<index>"`.

**The `data-rozie-roving-item` marker does triple duty** (keeps the controller tiny): **event delegation** (one root `@keydown`/`@pointermove` reads the index off `event.target` — no per-item listeners emitted), **focus targeting** (roving mode queries `[data-rozie-roving-item="i"]`), and **scroll fallback** (`scrollIntoView` when there is no windower).

Moat framing holds under scrutiny: the runtime controllers are Rozie infrastructure (like React's own runtime), not author surface. Radix ships six packages the consumer wires; Rozie ships six controllers the compiler wires, from markup the author never leaves.

## 9. Active-item styling

The compiler **always** stamps `data-rozie-roving-active` on the active item (cheap; the controller relies on the `data-rozie-roving-*` markers anyway; gives VR/tests and default styling one canonical hook). Authors targeting scoped `<style>` write `[data-rozie-roving-active] { … }` and set nothing.

Optionally, `r-roving-active-class="…"` tells the controller to **also** toggle author classes on the active item — additive, never a replacement (keeping the attribute canonical prevents the internals and the styling story from diverging). It accepts the same shapes `:class` does (`'is-active'`, `['is-active','ring']`, `{ 'is-active': cond }`) via the existing `rozieClass` normalization (Vue natively).

**Two semantics to document for authors (usage docs):**
1. **Evaluated once (static config), not a live per-render binding.** The controller normalizes the class spec at setup and toggles the token set on active-change. If the active item's styling must change *while* active, use the always-present `[data-rozie-roving-active]` attribute instead.
2. **Object form composes with activeness** — `{ 'is-active': cond }` applies truthy keys only when the item is active AND the key's condition holds. Degrades gracefully.

Implementation note: the toggle is **imperative** (outside the template render-merge), so it reuses only the *normalization* step of `rozieClass` (shape → token list). Factor that normalizer out cleanly so the two paths cannot drift (e.g. on falsy object values). Scoping holds for all shapes — the active element already carries `data-rozie-s-<hash>`, so `.token[data-rozie-s-hash]` scoped rules match tokens the controller adds.

## 10. Windowing contract (decoupled, designed now)

The controller consumes an **optional** windower:

```ts
interface RovingWindower {
  count(): number;                              // total items, not just rendered
  itemMeta(i: number): { label?: string; disabled?: boolean };
  scrollToIndex(i: number, opts?: { align?: 'center' | 'nearest' }): void;
}
```

- **No windower** → the controller derives count/meta from the `:source` array and falls back to `scrollIntoView` on the rendered node.
- **Windower present** → count/typeahead/Home-End address the full data set; `scrollToIndex` drives the virtualizer. Today's `@rozie-ui/headless-core` windowing already satisfies this signature (the listbox's `virtualizer.scrollToIndex(active)`), so `r-roving` plays with existing virtualization on day one. If virtualization later graduates to a compiler primitive, it implements the same contract and `r-roving` needs zero changes.

## 11. Testing & gates

- **Additive to the compiler** — `r-roving`/`r-roving-item` are new directives no shipped `.rozie` uses (verified: zero corpus hits), so existing emit stays byte-identical → **no corpus rebless** for the primitive itself. New runtime controllers are additive packages.
- **Red-first, surgical per seam** (per `feedback_emitter_seam_surgical_per_seam`): each emitter seam gets a red fixture first, then byte-checked emit.
- **Behavior tests, not just snapshots** (per `feedback_snapshot_tests_cement_bugs`): assert the round-trip — key events move active, aria-activedescendant/tabindex/`data-rozie-roving-active` update, commit fires, typeahead lands, disabled is skipped, loop wraps. A DOM-driven test per target (the gap that let the Solid class bug hide) — not IR-shape-only.
- **VR cells** for a representative menu (tabindex) + combobox (activedescendant), Linux baselines only (`feedback_vr_linux_baselines`).
- **Retrofitting an existing family** (e.g. listbox) onto `r-roving` is a **separate, opt-in migration** that reblesses *that* family — proves dogfooding but is not required for the additive primitive to land. v1 ships the primitive + a fresh example/demo; flagship retrofit is a fast-follow.

### Gate order
1. Template-parser + IR: `r-roving`/`r-roving-item`/`r-roving-active-class` parse into IR nodes; `:source` synthesis from co-located `r-for`; collision/validation (a `r-roving` with no items, no matching group, bad focus-model arg → clear ROZ diagnostics).
2. Per-target emitters ×6 + runtime controllers ×6 (red-first per seam).
3. `turbo run typecheck --force --continue` + leaf `tsc --noEmit`.
4. `turbo run test --force --continue` (surface + behavior).
5. VR (menu + combobox cells) + Playwright smoke (real DOM, all six).

**No auto-push** (`feedback_no_autopush`) — commit atomically on `main`, stop.

## 12. Open questions (resolved by defaults; revisit if a gate objects)

- **Directive name.** `r-roving` is the shared working vocabulary, but "roving" is technically the *tabindex* model; the directive also covers `activedescendant`. Alternatives: `r-keynav` / `r-nav`. Keeping `r-roving` unless review prefers otherwise.
- **Typeahead matching.** Prefix + case-insensitive + ~500ms buffer for v1; fuzzy/substring deferred.
- **`itemMeta` label source.** From `r-roving-item="{ label }"`; if omitted, typeahead falls back to the item element's `textContent` (rendered items only) — documented limitation under windowing.
