# Sortable libraries comparison

How `@rozie-ui/sortable-list` compares to the per-framework drag-and-drop reorderable-list ecosystem. Unlike the date-picker or rich-text ecosystems, this is **not** a single-engine landscape: some libraries are thin bindings over the [SortableJS](https://sortablejs.github.io/Sortable/) engine (react-sortablejs, vuedraggable, ngx-sortablejs — the family Rozie joins), while others are full native drag-and-drop toolkits with their *own* engines (dnd-kit, Angular CDK, svelte-dnd-action, solid-dnd). So the comparison spans two axes at once: **engine** (SortableJS vs bespoke) and **framework reach**. Rozie wraps SortableJS and ships one source to all six frameworks.

> Research snapshot: 2026-06-07. Versions and download counts move; treat them as of that date. Weekly-download figures are an npm snapshot for the window 2026-05-27→06-02 — a popularity datum, *not* a quality verdict.

## The libraries at a glance

| Library | Engine | Frameworks | Latest | Weekly downloads | Maintenance | Key capability |
| --- | --- | --- | --- | --- | --- | --- |
| **[react-sortablejs](https://github.com/SortableJS/react-sortablejs)** | SortableJS | React | 6.1.4 | ~364k | **last published ~4 yr ago** | Same engine as Rozie; thin React binding |
| **[@dnd-kit/core](https://dndkit.com/)** | own | React | 6.3.1 | ~17.0M | active (v6.3.1, ~2 yr) | Modern React leader — sensors, virtualization, a11y |
| **[react-beautiful-dnd](https://github.com/atlassian/react-beautiful-dnd)** | own | React | 13.1.1 | ~2.32M | **deprecated; repo archived 2025-08** | Still widely used; **no React 19** |
| **[vuedraggable](https://github.com/SortableJS/vue.draggable.next)** | SortableJS | Vue 3 | 4.1.0 | ~1.35M | stale (maintained alt: vue-draggable-plus) | `v-model` array + SortableJS |
| **[svelte-dnd-action](https://github.com/isaacHagoel/svelte-dnd-action)** | own | Svelte | 0.9.69 | ~142k | active; **Svelte 5** | Action-based, FLIP animations, keyboard + a11y |
| **[@angular/cdk](https://material.angular.dev/cdk/drag-drop)** (drag-drop) | own | Angular | 21.x | ~3.73M¹ | active (first-party) | Connected lists, keyboard, `moveItemInArray` |
| **[@thisbeyond/solid-dnd](https://github.com/thisbeyond/solid-dnd)** | own | Solid | 0.7.5 | ~54k | **last published ~2 yr ago** | Solid primitives toolkit |
| **Lit** | — | — | — | — | — | ❌ no idiomatic DnD-list component |
| **Rozie** | SortableJS | **6** | 0.1.0 | — | this repo (2026-06) | One source → six idiomatic packages |

¹ `@angular/cdk` downloads are for the whole CDK; the drag-drop module is one entry point within it. The SortableJS engine itself (`sortablejs`) is at `1.15.7`, ~3.73M/wk, and is actively maintained — the engine is healthy; the per-framework **bindings** are the uneven part.

The wedge here is different in shape from the other engine ports. Every framework *does* have a strong drag-and-drop option — but they are **different engines with different APIs**, the SortableJS bindings specifically are stale (react-sortablejs ~4 yr, vuedraggable's Vue-3 line maintenance-flagged), the most-loved React option (react-beautiful-dnd) is **deprecated and archived**, **Solid's `@thisbeyond/solid-dnd` hasn't shipped in ~2 years**, and **Lit has no idiomatic reorderable-list component at all**. Standardizing one reorderable-list *contract* across all six frameworks means learning six different libraries — or compiling one `.rozie` source.

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
| Latest-framework support | React 19 | Vue 3 | **Svelte 5** | Angular 21 | Solid 1.x (stale) | — | R18+/V3.4+/Sv5/Ng19+/Solid/Lit |
| Actively maintained | ✅ (~2 yr cadence) | ~ | ✅ | ✅ | ❌ | — | ✅ |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

² **The React story is split three ways.** `@dnd-kit` (~17.0M/wk) is the modern React leader (own engine — sensors, virtualization-friendly, accessible); `react-beautiful-dnd` (~2.32M/wk) is **deprecated and archived** (no React 19); and `react-sortablejs` (~364k/wk, **~4 yr since last publish**) is the same-SortableJS-engine binding Rozie is the direct peer of. Rozie's React leaf is current and wraps SortableJS like react-sortablejs, but ships the keyboard / a11y / two-way contract react-sortablejs lacks.

³ **Keyboard drag is a feature of Rozie's `SortableList` source**, not of SortableJS: Space lifts / drops, ArrowUp / ArrowDown move, Escape cancels, Enter is an alternate drop — with `aria-live` announcements. The cross-target focus-restoration leak (Svelte / Solid / Lit keyed reconcilers re-create row DOM on reorder, dropping focus to `<body>`) is closed by Rozie's [`$restoreFocus`](/guide/features#restorefocus-selector-idx-—-keep-focus-on-a-row-across-keyed-reconciler-re-renders) sigil. `react-sortablejs` and `vuedraggable` ship no keyboard contract.

⁴ Nested + cross-list flows are shown by the `SortableListNested` / `KanbanColumn` and `SortableListPair` siblings — cross-column card drag with reorderable columns, and atomic A→B transfer across two bound arrays via SortableJS's `group` / clone modes and the `onAdd` / `onRemove` callbacks — from the same source on all six targets.

⁵ **No two-way data binding.** `@dnd-kit`, `@angular/cdk`, and `@thisbeyond/solid-dnd` hand you a drag-end event (`onDragEnd` / `cdkDropListDropped` / drag store) and you mutate state yourself (CDK ships a `moveItemInArray` helper, but you call it). `vuedraggable` is the exception with real `v-model`. Rozie gives every target a two-way `items` array — pass an array, get a reordered array back, no manual `onChange → setState` wiring.

⁶ **Rozie's `SortableList` now ships a uniform `$expose` imperative handle** — `getInstance` (raw SortableJS instance escape hatch) / `toArray` / `sort` / `option` — the *same* four verbs on all six targets, grabbed with each framework's native ref mechanism. The competitors all expose *something* (the dnd-kit context, the SortableJS instance, `CdkDropList`), but each its own way and per-framework; Rozie's is one shape everywhere. See [G1](#gap-status-what-shipped-what-s-still-deferred).

## Where Rozie wins today

- **One definition, six idiomatic packages** — including the two frameworks the ecosystem underserves: **Solid (`@thisbeyond/solid-dnd` ~54k/wk, ~2 yr stale)** and **Lit (no idiomatic reorderable-list component exists)**. A Lit dev today hand-rolls SortableJS over their own DOM; a Solid dev reaches for a toolkit that hasn't shipped since 2024.
- **Keyboard drag + screen-reader announcements built into the source** — Space / Arrow / Escape / Enter with `aria-live`, and the cross-framework focus-restoration leak closed by [`$restoreFocus`](/guide/features#restorefocus-selector-idx-—-keep-focus-on-a-row-across-keyed-reconciler-re-renders). dnd-kit, CDK, and svelte-dnd-action have keyboard stories too — but each is per-framework; react-sortablejs and vuedraggable have none.
- **Two-way bound `items` array** (`r-model:items`) on all six — the thing every dnd-kit / CDK / solid-dnd consumer wires by hand. Pass an array, render rows through the scoped default slot, get the reordered array back.
- **Cross-list sync + nesting from one source** — `SortableListPair` (atomic transfer across two bound arrays) and `SortableListNested` / `KanbanColumn` (reorderable columns of reorderable cards), the same `.rozie` compiled to all six targets.
- **Custom drag handles via `$classSelector`** — resolves on every target including React's scoped-CSS (authored class names render literally; `$classSelector` lowers to the literal `".grip"` per target and typo-checks it against your `<style>` at compile time).
- **A uniform imperative handle** (`$expose`) — `getInstance` / `toArray` / `sort` / `option`, the *same* four verbs on all six targets, grabbed with each framework's native ref. `getInstance()` is the raw-SortableJS escape hatch, so the full engine API is one hop away. The competitors all expose *something* (the dnd-kit context, the SortableJS instance, `CdkDropList`) — but each its own way, per framework. See the [showcase Imperative handle section](/guide/sortable-list#imperative-handle).
- **The hard part solved once** — the SortableJS-direct-DOM-mutation-vs-framework-reconciler dance (the reason these wrappers exist at all) is encapsulated in `useSortableJS()` plus the [`$reconcileAfterDomMutation()`](/guide/features#r-external-and-reconcileafterdommutation-—-dom-the-framework-doesn-t-own) sigil, hardened against SortableJS's fragile fallback-mode event shapes, across all six keyed reconcilers.

The ✅ cells in Rozie's row are pinned per target by the [sortable-drag VR spec](https://github.com/One-Learning-Community/rozie.js/blob/main/tests/visual-regression/specs/sortable-drag.spec.ts) — which measures *Rozie's* behavior across targets and says nothing measured about the competitors' behavior.

## Gap status — what shipped, what's still deferred {#gap-status-what-shipped-what-s-still-deferred}

This page concedes where the standalone libraries are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

| Gap | Who has it | Severity | Rozie status |
| --- | --- | --- | --- |
| **G1 — Imperative `$expose` handle** | `@dnd-kit` (sensors/context), CDK (`CdkDropList`) | **Medium** | **✅ SHIPPED** — a uniform 4-verb handle (`getInstance` / `toArray` / `sort` / `option`) on all six targets, the same shape everywhere, grabbed with each framework's native ref. `getInstance()` is the raw-SortableJS escape hatch; rows now carry `data-id` so `toArray()` / `sort()` operate on the rendered key order. See the [showcase Imperative handle section](/guide/sortable-list#imperative-handle). |
| G2 — Live reconcile of construction-time knobs | (engine-level) | Low | **⏳ Deferred (by design)** — `forceFallback` / `swapThreshold` / `cloneable` are construction-time-only SortableJS knobs; changing them at runtime requires re-keying the component (the [documented re-mount pattern](/guide/sortable-list#remount-on-construction-time-only-changes)). The runtime-updatable props *are* live-reconciled via `instance.option()`. |
| G3 — List virtualization for large datasets | `@dnd-kit` (+ virtualizers) | Medium | **⏳ Deferred** — SortableJS renders all rows; very large lists want windowing. dnd-kit composes with `@tanstack/virtual`; Rozie has no virtualization story yet. |
| G4 — Multi-select / multi-drag | `@dnd-kit`, SortableJS MultiDrag plugin | Low | **⏳ Deferred** — SortableJS's `MultiDrag` plugin is not mounted, so dragging multiple rows at once isn't wired. (Plain SortableJS options pass through via `:options`; plugins need a mount Rozie doesn't yet bridge.) |
| G5 — Spring / FLIP reorder animation | `svelte-dnd-action`, `@dnd-kit` | Low | **⏳ Deferred** — animation is SortableJS's `animation` (ms) + `easing` only; no FLIP/spring-grade reorder choreography. |

## Honest caveats

- **Modern React leans dnd-kit, not SortableJS.** `@dnd-kit` (~17.0M/wk) is the React drag-and-drop standard in 2026 — sensors, virtualization, a rich ecosystem — and `react-beautiful-dnd` (~2.32M/wk), though deprecated/archived, is still everywhere. Rozie wraps **SortableJS**, a different engine with a simpler DOM-mutation model and its own tradeoffs. For a single-React app that needs virtualization or dnd-kit's sensor model, dnd-kit is the better pick. Rozie's value is cross-framework reach plus the keyboard / a11y / two-way contract from one source — not "better than dnd-kit on React."
- **Angular CDK and svelte-dnd-action are first-rate native toolkits.** CDK (first-party, connected lists, keyboard) and svelte-dnd-action (FLIP animations, Svelte 5, actively maintained) are excellent *single-framework* choices. The matrix scores cross-framework reach, not single-framework ergonomics.
- **`@rozie-ui/sortable-list` is `0.1.0`.** The surface (17 props / 5 events / scoped row slot) is stable and VR-pinned, but younger than the established libraries — and it inherits SortableJS's engine-level limitations (touch-fallback fragility, no windowing) along with its strengths.

## Cross-references

- [`SortableList` showcase & API](/guide/sortable-list) — the full surface, quick starts, recipes, and the `SortableListPair` / `SortableListNested` / `KanbanColumn` siblings.
- [SortableList example & output](/examples/sortable-list) — the live demo with per-target compiled output side by side.
- [`SortableList.rozie` source](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/src/SortableList.rozie) and the [`useSortableJS()` bridge](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/sortable-list/src/internal/useSortableJS.ts).
- [`$restoreFocus()`](/guide/features#restorefocus-selector-idx-—-keep-focus-on-a-row-across-keyed-reconciler-re-renders) · [`$reconcileAfterDomMutation()`](/guide/features#r-external-and-reconcileafterdommutation-—-dom-the-framework-doesn-t-own) · [`$classSelector()`](/guide/features#classselector-—-handing-a-class-name-to-a-vanilla-js-engine) — the sigils that make the cross-framework SortableJS bridge work.
