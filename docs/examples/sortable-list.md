<script setup>
import SortableListDemo from '../../examples/demos/SortableListDemo.rozie';
</script>

# SortableList (drag & drop)

A data-bound port of [SortableJS](https://sortablejs.github.io/Sortable/). SortableJS reorders DOM nodes directly on drop — which is precisely what every framework's reconciler then fights, producing snap-back, lost focus, and broken animations. Every framework has a wrapper that solves this independently (`react-sortablejs`, `vuedraggable`, `ngx-sortablejs`, `svelte-sortablejs`); `SortableList.rozie` solves it once and compiles to all six.

What the wrapper demonstrates:

- **`model: true` two-way bind on an *array*** — consumers pass an array and get the reordered array back via `r-model:items="…"`, with no `onChange → setState` wiring. (Contrast `Flatpickr`'s scalar `r-model:date`.)
- **The DOM-reconciler workaround** — on `onUpdate`, the wrapper *restores* the pre-drag DOM order before writing the model. The framework then sees a model change against an unchanged DOM and reconciles cleanly, moving keyed nodes with proper transitions. This is the bug every per-framework wrapper has to fix; here it is fixed once.
- **A default scoped slot** (`:item` / `:index`) so consumers render whatever they like per row, **`$watch`** reconciling `disabled` / `group` / `handle` into the live instance via `instance.option()`, and **`$emit`** for `start` / `end` / `change`.

This page shows the live demo plus the per-target compiled output. For the full API reference, recipes, and the published `@rozie-ui/sortable-list-*` packages (one pre-compiled, per-framework install — no Rozie toolchain required), see the [SortableList showcase + package docs](/components/sortable-list).

## Live demo

`SortableListDemo.rozie` is the companion consumer. Grab a row by its handle (⋮⋮) and drop it elsewhere — the bound array on the right updates in real time. Add and remove rows; the list and its bound state stay in sync.

<div class="rozie-demo">
  <ClientOnly>
    <SortableListDemo />
  </ClientOnly>
</div>

## Source — SortableList.rozie

```rozie-src SortableList
```

## Vue output

```rozie-out SortableList vue
```

## React output

```rozie-out SortableList react
```

## Svelte output

```rozie-out SortableList svelte
```

## Angular output

```rozie-out SortableList angular
```

## Solid output

```rozie-out SortableList solid
```

## Lit output

```rozie-out SortableList lit
```

## Demo source — SortableListDemo.rozie

```rozie-src SortableListDemo
```
