---
surface_hash: 75fa191490d6
---

# Sortable libraries comparison

How `@rozie-ui/sortable-list` compares to the per-framework drag-and-drop reorderable-list ecosystem. Unlike the date-picker or rich-text ecosystems, this is not a single-engine landscape: some libraries are thin bindings over the [SortableJS](https://sortablejs.github.io/Sortable/) engine (react-sortablejs, vuedraggable, ngx-sortablejs; the family Rozie joins), while others are full native drag-and-drop toolkits with their *own* engines (dnd-kit, Angular CDK, svelte-dnd-action, solid-dnd). So the comparison spans two axes at once: engine (SortableJS vs bespoke) and framework reach. Rozie wraps SortableJS and ships the same `<SortableList>`, with the same props, events, two-way `items` binding, and imperative handle, to all six frameworks as pre-compiled per-framework packages.

> Research snapshot: 2026-08-10. Versions and download counts move; treat them as of that date. Weekly-download figures are an npm snapshot for the window 2026-08-03→08-09 — a popularity datum, *not* a quality verdict.

## The libraries at a glance

| Library | Engine | Frameworks | Latest | Weekly downloads | Maintenance | Key capability |
| --- | --- | --- | --- | --- | --- | --- |
| **[react-sortablejs](https://github.com/SortableJS/react-sortablejs)** | SortableJS | React | 6.1.4 | ~337k | **last published ~4 yr ago** | Same engine as Rozie; thin React binding |
| **[@dnd-kit/core](https://dndkit.com/)** | own | React | 6.3.1 | ~22.8M | active repo (v6.3.1, ~2 yr) | Modern React leader — sensors, virtualization, a11y |
| **[react-beautiful-dnd](https://github.com/atlassian/react-beautiful-dnd)** | own | React | 13.1.1 | ~2.22M | **deprecated; repo archived 2025-08** | Still widely used; **no React 19** |
| **[vuedraggable](https://github.com/SortableJS/vue.draggable.next)** | SortableJS | Vue 3 | 4.1.0 | ~1.44M | stale (maintained alt: vue-draggable-plus) | `v-model` array + SortableJS |
| **[svelte-dnd-action](https://github.com/isaacHagoel/svelte-dnd-action)** | own | Svelte | 0.9.78 | ~242k | active; **Svelte 5** | Action-based, FLIP animations, keyboard + a11y |
| **[@angular/cdk](https://material.angular.dev/cdk/drag-drop)** (drag-drop) | own | Angular | 22.x | ~4.06M¹ | active (first-party) | Connected lists, keyboard, `moveItemInArray` |
| **[@thisbeyond/solid-dnd](https://github.com/thisbeyond/solid-dnd)** | own | Solid | 0.7.5 | ~91k | **last published ~3 yr ago** | Solid primitives toolkit |
| **Lit** | — | — | — | — | — | ❌ no idiomatic DnD-list component |
| **Rozie** | SortableJS | **6** | pre-1.0 | — | pre-1.0, released together | Same API, six packages |

¹ `@angular/cdk` downloads are for the whole CDK; the drag-drop module is one entry point within it. The SortableJS engine itself (`sortablejs`) is at `1.15.7`, ~4.23M/wk, and is actively maintained. The engine is healthy; the per-framework **bindings** are the uneven part.

The shape of the problem differs from the other engine ports. Every framework *does* have a strong drag-and-drop option, but they are different engines with different APIs. The SortableJS bindings specifically are stale (react-sortablejs ~4 yr, vuedraggable's Vue-3 line maintenance-flagged), the most-loved React option (react-beautiful-dnd) is deprecated and archived, Solid's `@thisbeyond/solid-dnd` hasn't shipped in ~3 years, and Lit has no reorderable-list component at all. Standardizing one reorderable-list *contract* otherwise means learning six different libraries.

## Feature matrix

Per-framework column = the de-facto leader for that framework (React = `@dnd-kit`, the modern standard; the same-engine React binding is `react-sortablejs`, see ²). Cell legend: **✅** out-of-the-box · **❌** not supported · **~** partial / consumer-glue-required.

| Capability | `@dnd-kit`² (React) | `vuedraggable` (Vue) | `svelte-dnd-action` (Svelte) | `@angular/cdk` (Angular) | `@thisbeyond/solid-dnd` (Solid) | Lit (none) | **`@rozie-ui/sortable-list`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Render + reorder a list | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| Pointer / mouse drag | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| **Keyboard drag + a11y live-region** | ✅ | ❌ | ✅ | ✅ | ~ | hand-roll | ✅³ |
| Nested / cross-list transfer | ✅ | ~ (put/pull) | ✅ | ✅ (connected) | ~ | hand-roll | ✅⁴ |
| **Two-way bound data array** | ❌⁵ | ✅ (`v-model`) | ~ (consider/finalize) | ❌⁵ | ❌⁵ | hand-roll | ✅ `r-model:items` |
| Custom drag handle | ✅ | ✅ | ✅ | ✅ | ~ | hand-roll | ✅ `$classSelector` |
| Framework-native per-row slot/render | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ scoped slot |
| Imperative handle | ~ (context/sensors) | ~ (instance) | ~ | ~ (`CdkDropList`) | ~ | hand-roll | ✅⁶ 4-verb `$expose` |
| Latest-framework support | React 19 | Vue 3 | **Svelte 5** | Angular 22 | Solid 1.x (stale) | — | R18+/V3.4+/Sv5/Ng19+/Solid/Lit |
| Actively maintained | ✅ (~2 yr cadence) | ~ | ✅ | ✅ | ❌ | — | ✅ |
| Same API on all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

² **The React story is split three ways.** `@dnd-kit` (~22.8M/wk) is the modern React leader (own engine: sensors, virtualization-friendly, accessible); `react-beautiful-dnd` (~2.22M/wk) is deprecated and archived, with no React 19; and `react-sortablejs` (~337k/wk, ~4 yr since last publish) is the same-SortableJS-engine binding Rozie is the direct peer of. Rozie's React leaf is current and wraps SortableJS like react-sortablejs, but ships the keyboard / a11y / two-way contract react-sortablejs lacks.

³ **Keyboard drag is a feature of Rozie's `SortableList` source**, not of SortableJS: Space lifts / drops, ArrowUp / ArrowDown move, Escape cancels, Enter is an alternate drop, with `aria-live` announcements. The cross-target focus-restoration leak (Svelte / Solid / Lit keyed reconcilers re-create row DOM on reorder, dropping focus to `<body>`) is closed by Rozie's [`$restoreFocus`](/guide/engine-wrappers#restorefocus-selector-idx-—-keep-focus-on-a-row-across-keyed-reconciler-re-renders) sigil. `react-sortablejs` and `vuedraggable` ship no keyboard contract.

⁴ Nested + cross-list flows are shown by the `SortableListNested` / `KanbanColumn` and `SortableListPair` siblings: cross-column card drag with reorderable columns, and atomic A→B transfer across two bound arrays via SortableJS's `group` / clone modes and the `onAdd` / `onRemove` callbacks.

⁵ **No two-way data binding.** `@dnd-kit`, `@angular/cdk`, and `@thisbeyond/solid-dnd` hand you a drag-end event (`onDragEnd` / `cdkDropListDropped` / drag store) and you mutate state yourself (CDK ships a `moveItemInArray` helper, but you call it). `vuedraggable` is the exception with real `v-model`. Rozie gives every target a two-way `items` array: pass an array, get a reordered array back, no manual `onChange → setState` wiring.

⁶ Rozie's `SortableList` ships a uniform `$expose` imperative handle: `getInstance` (the raw SortableJS instance escape hatch), `toArray`, `sort`, and `option`, the *same* four verbs, grabbed with each framework's native ref mechanism. The competitors all expose *something* (the dnd-kit context, the SortableJS instance, `CdkDropList`), but each in its own way, per framework. See the [showcase Imperative handle section](/components/sortable-list#imperative-handle).

## Where Rozie wins today

- **First-class packages everywhere** — including the two the ecosystem underserves: **Solid** (`@thisbeyond/solid-dnd` ~91k/wk, ~3 yr stale) and **Lit** (no reorderable-list component exists). A Lit dev today hand-rolls SortableJS over their own DOM; a Solid dev reaches for a toolkit that hasn't shipped since 2023.
- **One reorderable-list contract everywhere.** The same props, events, two-way binding, and handle: one component to learn, document, and migrate across your stack.
- **Keyboard drag + screen-reader announcements built in**: Space / Arrow / Escape / Enter with `aria-live`, and the cross-framework focus-restoration leak closed by [`$restoreFocus`](/guide/engine-wrappers#restorefocus-selector-idx-—-keep-focus-on-a-row-across-keyed-reconciler-re-renders). dnd-kit, CDK, and svelte-dnd-action have keyboard stories too, but each is per-framework; react-sortablejs and vuedraggable have none.
- **Two-way bound `items` array** (`r-model:items`) — the thing every dnd-kit / CDK / solid-dnd consumer wires by hand. Pass an array, render rows through the scoped default slot, get the reordered array back.
- **Cross-list sync + nesting**: `SortableListPair` (atomic transfer across two bound arrays) and `SortableListNested` / `KanbanColumn` (reorderable columns of reorderable cards).
- **Custom drag handles via `$classSelector`**, which resolves on every target including React's scoped-CSS (authored class names render literally; `$classSelector` lowers to the literal `".grip"` per target and typo-checks it against your `<style>` at compile time).
- **A uniform imperative handle** (`$expose`): `getInstance` / `toArray` / `sort` / `option`, the *same* four verbs, grabbed with each framework's native ref. `getInstance()` is the raw-SortableJS escape hatch, so the full engine API is one hop away. See the [showcase Imperative handle section](/components/sortable-list#imperative-handle).
- **The hard part solved once.** The SortableJS-direct-DOM-mutation-vs-framework-reconciler dance (the reason these wrappers exist at all) is encapsulated in `useSortableJS()` plus the [`$reconcileAfterDomMutation()`](/guide/engine-wrappers#r-external-and-reconcileafterdommutation-—-dom-the-framework-doesn-t-own) sigil, hardened against SortableJS's fragile fallback-mode event shapes, across the six keyed reconcilers.

Recently shipped: the uniform imperative handle, plus live reconcile of `swapThreshold` and the `cloneable`-derived `group` shape via `instance.option()` with no remount.

The ✅ cells in Rozie's row are pinned per target by the [sortable-drag VR spec](https://github.com/One-Learning-Community/rozie.js/blob/main/tests/visual-regression/specs/sortable-drag.spec.ts), which measures *Rozie's* behavior across targets and says nothing measured about the competitors' behavior.

## What Rozie defers

- **Modern React leans dnd-kit, not SortableJS.** `@dnd-kit` (~22.8M/wk) is the React drag-and-drop standard in 2026 (sensors, virtualization, a rich ecosystem), and `react-beautiful-dnd` (~2.22M/wk), though deprecated and archived, is still everywhere. Rozie wraps SortableJS, a different engine with a simpler DOM-mutation model and its own tradeoffs. For a single-React app that needs virtualization or dnd-kit's sensor model, dnd-kit is the better pick. Rozie's value is cross-framework reach plus the keyboard, a11y, and two-way contract.
- **Angular CDK and svelte-dnd-action are first-rate native toolkits.** CDK (first-party, connected lists, keyboard) and svelte-dnd-action (FLIP animations, Svelte 5, actively maintained) are strong *single-framework* choices. The matrix scores cross-framework reach, not single-framework ergonomics.
- **No list virtualization.** SortableJS renders all rows; very large lists want windowing. dnd-kit composes with `@tanstack/virtual`; Rozie has no virtualization story yet.
- **No multi-select / multi-drag.** SortableJS's `MultiDrag` plugin is not mounted, so dragging multiple rows at once isn't wired. (Plain SortableJS options pass through via `:options`; plugins need a mount Rozie doesn't yet bridge.)
- **No FLIP / spring reorder animation.** Animation is SortableJS's `animation` (ms) + `easing` only, versus the choreography svelte-dnd-action and dnd-kit offer.
- **`forceFallback` is construction-time-only.** SortableJS reads it once at `new Sortable(el, …)`; changing it at runtime requires re-keying the component (the [documented re-mount pattern](/components/sortable-list#remount-on-construction-time-only-changes)).
- **`@rozie-ui/sortable-list` is pre-1.0** and younger than the established libraries, and it inherits SortableJS's engine-level limitations (touch-fallback fragility, no windowing) along with its strengths. The full surface is documented in the [showcase & API](/components/sortable-list).

## Cross-references

- [`SortableList` showcase & API](/components/sortable-list) — the full surface, quick starts, recipes, and the `SortableListPair` / `SortableListNested` / `KanbanColumn` siblings.
- [SortableList example & output](/examples/sortable-list) — the live demo with per-target compiled output side by side.
- [`SortableList.rozie` source](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/src/SortableList.rozie) and the [`useSortableJS()` bridge](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/src/internal/useSortableJS.ts).
- [`$restoreFocus()`](/guide/engine-wrappers#restorefocus-selector-idx-—-keep-focus-on-a-row-across-keyed-reconciler-re-renders) · [`$reconcileAfterDomMutation()`](/guide/engine-wrappers#r-external-and-reconcileafterdommutation-—-dom-the-framework-doesn-t-own) · [`$classSelector()`](/guide/engine-wrappers#classselector-—-handing-a-class-name-to-a-vanilla-js-engine) — the sigils that make the cross-framework SortableJS bridge work.
