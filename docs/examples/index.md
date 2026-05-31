# Examples

Fourteen example pages, each kept live against the compiler: every source listing and per-target output (Vue, React, Svelte, Angular, Solid, Lit) is regenerated from the real `.rozie` file through `@rozie/core` on every docs build, so the docs can't drift. Pick whichever lines up with the feature you're trying to evaluate.

## By complexity

- [Counter](/examples/counter) — `<props>` with `model: true`, `<data>`, `$computed`, template event handlers. The smallest example that's still interesting.
- [SearchInput](/examples/search-input) — `.debounce(300)` modifier, `$emit`, `$onMount` with a teardown return, `r-if` / `r-else`, `$refs`. Single-component scope with rich event-handling.
- [Modal](/examples/modal) — `<listeners>` block with side-effect handlers (body-scroll lock, focus), `.self` modifier on a backdrop click, multiple colocated lifecycle hooks, slots with scoped params, `<components>` embed. The heaviest single-file example.
- [Dropdown](/examples/dropdown) — `.outside(...$refs)`, `.throttle(100).passive`, reactive `r-if` conditional-attach on each `<listener>`, `$watch` on a prop transition, named slot with scoped params. The marquee `<listeners>` showcase.
- [TreeNode](/examples/tree-node) — self-recursion via `<components>` self-import; minimal `<props>`-only component. Demonstrates the per-target self-reference idioms.
- [Card (with CardHeader)](/examples/card) — wrapper-pair composition. Two `.rozie` files; shows the kebab/camel prop bridge and the per-target child-component import + selector rewrite (notably Angular's `<rozie-card-header>`).
- [TodoList](/examples/todo-list) — `r-for` with `:key`, multiple `$emit` channels, named + default slots with per-item scoped params, fallback content, `r-if` / `r-else` empty state. Calls out the documented React render-prop divergence in slot consumer ergonomics.
- [Table](/examples/table) — slot-driven UI-library table (named scoped slots for header/cell/empty), a **consumer-side dynamic slot fill** (`` <template #[`footer${mode}`]> ``) toggling between two footer renderers, and an `r-match` / `r-case` / `r-default` switch in the consumer's `#cell` template. The dynamic-slot and `r-match` showcase.
- [PortalList](/examples/portal-list) — **portal-slot primitive** demo. A tiny inline vanilla-JS engine owns row containers but the per-row CONTENT is rendered through `<slot name="item" portal />` + `$portals.item(container, scope)`. The cross-target equivalent of FullCalendar's `eventContent`, AG-Grid's `cellRenderer`, Swiper's slide content.

## Engine wrappers

Vanilla-JS libraries — drag-and-drop, date pickers, charts — each ported to a single `.rozie` source that compiles to all six framework wrappers at once. One source replaces the stack of per-framework wrapper libraries those engines ship today. Each page embeds a companion demo (`*Demo.rozie`) that is itself a Rozie file, so the demo is its own six-way integration proof.

- [SortableList](/examples/sortable-list) — SortableJS drag-and-drop. `model: true` two-way bind on an array, the cross-framework DOM-reconciler workaround, a default scoped slot, `$watch` reconciliation via `instance.option()`.
- [Flatpickr](/examples/flatpickr) — the flatpickr date picker. Scalar `model: true` two-way bind, `$onMount` teardown, `$watch` pushing `mode` / bounds changes into the live instance with no remount.
- [LineChart](/examples/line-chart) — a Chart.js canvas chart. One-way reactivity over a deeply-nested prop, `$snapshot` for the Svelte `$state`-proxy interop, in-place `chart.data` reconciliation.

## Authoring features

Pages that showcase a `<block>`-level authoring feature rather than a component pattern.

- [SCSS styling](/examples/scss) — `<style lang="scss">`: compile-time dart-sass, a Sass map iterated with `@each`, `@for` / `@function` with `@if` control flow, `%placeholder` + `@extend`, `#{…}` interpolation.
- [TypeScript authoring](/examples/typescript) — `<script lang="ts">`: author-declared `interface` / `type`, a type-only import, typed `$computed` declarations, and the statement-position type-hoist for the class-based targets.

## By feature

If you're looking for a specific authoring feature:

| Feature | See |
| --- | --- |
| `model: true` two-way binding | [Counter](/examples/counter), [Modal](/examples/modal), [Dropdown](/examples/dropdown), [TodoList](/examples/todo-list) |
| `r-model:prop` consumer-side two-way bind | [Flatpickr](/examples/flatpickr) (scalar), [SortableList](/examples/sortable-list) (array) |
| `$computed` | [Counter](/examples/counter), [SearchInput](/examples/search-input), [TodoList](/examples/todo-list) |
| `$emit` | [SearchInput](/examples/search-input), [Modal](/examples/modal), [TodoList](/examples/todo-list) |
| `$refs` in script | [SearchInput](/examples/search-input), [Modal](/examples/modal), [Dropdown](/examples/dropdown) |
| `$onMount` with teardown return | [SearchInput](/examples/search-input), [Modal](/examples/modal) |
| `$onMount` / `$onUnmount` colocated pair | [Modal](/examples/modal) |
| Multiple `$onMount` hooks | [Modal](/examples/modal), [Dropdown](/examples/dropdown) |
| `$watch(() => getter, cb)` | [Dropdown](/examples/dropdown), [Flatpickr](/examples/flatpickr), [LineChart](/examples/line-chart), [SortableList](/examples/sortable-list) |
| `$snapshot` (Svelte `$state`-proxy interop) | [LineChart](/examples/line-chart) |
| `<listeners>` block (`<listener>` elements with reactive `r-if` attach) | [Modal](/examples/modal), [Dropdown](/examples/dropdown) |
| `.debounce(ms)` modifier | [SearchInput](/examples/search-input) |
| `.throttle(ms).passive` modifier chain | [Dropdown](/examples/dropdown) |
| `.outside(...$refs)` modifier | [Dropdown](/examples/dropdown) |
| `.self` modifier | [Modal](/examples/modal) |
| `.enter` / `.escape` key filters | [SearchInput](/examples/search-input) |
| `<components>` block | [Modal](/examples/modal), [Card](/examples/card), [TreeNode](/examples/tree-node) |
| Self-recursion | [TreeNode](/examples/tree-node) |
| `r-for` with `:key` | [TodoList](/examples/todo-list), [TreeNode](/examples/tree-node) |
| `r-if` / `r-else` | [SearchInput](/examples/search-input), [TodoList](/examples/todo-list) |
| `r-match` / `r-case` / `r-default` switch | [Table](/examples/table) |
| `r-model` | [SearchInput](/examples/search-input), [TodoList](/examples/todo-list) |
| Named slots | [Modal](/examples/modal), [Dropdown](/examples/dropdown), [TodoList](/examples/todo-list) |
| Default slot with scoped params | [Modal](/examples/modal), [Dropdown](/examples/dropdown), [TodoList](/examples/todo-list) |
| Slot fallback content | [TodoList](/examples/todo-list) |
| Dynamic slot fills (consumer-side `<template #[expr]>`) | [Table](/examples/table) |
| Portal slots (`<slot portal />` + `$portals.X`) | [PortalList](/examples/portal-list) |
| Vanilla-JS engine wrapper | [SortableList](/examples/sortable-list), [Flatpickr](/examples/flatpickr), [LineChart](/examples/line-chart) |
| `<style lang="scss">` | [SCSS styling](/examples/scss) |
| `<script lang="ts">` typed blocks | [TypeScript authoring](/examples/typescript) |
| `:root { }` global escape hatch in `<style>` | [Modal](/examples/modal), [Dropdown](/examples/dropdown) |

For the design rationale behind each of these, see [Features & design choices](/guide/features).
