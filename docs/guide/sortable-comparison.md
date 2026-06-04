# Sortable libraries comparison

Drag-and-drop reorderable lists are one of the most-requested UI primitives in any
modern component library — and one of the most frequently re-implemented per
framework. The JavaScript ecosystem has converged on a small set of dominant
solutions, but every one of them is either tied to a specific framework or
forces consumers to drop down to imperative engine code at the edges.

Rozie's `SortableList` (and its `SortableListPair` / `SortableListNested`
siblings) is the killer demo for [Rozie's competitive wedge](/guide/why):
one `.rozie` file compiles to idiomatic React, Vue, Svelte, Angular, Solid,
and Lit consumers — and ships a feature set that every standalone library
on this page either skips entirely or supports partially.

## Comparison matrix

| Library                            | Frameworks                  | Mouse drag | Keyboard drag | Nested droppables | Cross-list state sync | Custom drag handles |
| ---------------------------------- | --------------------------- | :--------: | :-----------: | :---------------: | :-------------------: | :-----------------: |
| **[Rozie SortableList](/examples/sortable-list)** | **React + Vue + Svelte + Angular + Solid + Lit** | **✓** | **✓** | **✓** | **✓** | **✓** |
| [react-sortablejs](https://github.com/SortableJS/react-sortablejs) | React only | ✓ | ✗ | partial | ✗ | ✓ |
| [react-beautiful-dnd](https://github.com/atlassian/react-beautiful-dnd) | React only | ✓ | ✓ | partial | ✗ | ✓ |
| [dnd-kit](https://dndkit.com/) | React only | ✓ | ✓ | ✓ | partial | ✓ |
| [Vue.Draggable](https://github.com/SortableJS/Vue.Draggable) | Vue only | ✓ | ✗ | partial | partial | ✓ |
| [svelte-dnd-action](https://github.com/isaacHagoel/svelte-dnd-action) | Svelte only | ✓ | ✓ | partial | partial | ✓ |
| [Angular CDK Drag-Drop](https://material.angular.io/cdk/drag-drop) | Angular only | ✓ | ✓ | ✓ | partial | ✓ |

The matrix scores each library against the feature set that ships out of the
box, without consumer-authored workarounds. "Partial" means the library
exposes lower-level primitives but doesn't provide a turnkey solution for the
column.

## Why Rozie's row reads ✓ on every column

- **Mouse drag.** SortableList wraps the battle-tested
  [SortableJS](https://sortablejs.github.io/Sortable/) engine; Rozie's per-target
  emit reconciles the engine's direct DOM mutation with each framework's
  keyed-list reconciler via the
  [`$reconcileAfterDomMutation()`](/guide/features#r-external-and-reconcileafterdommutation-—-dom-the-framework-doesn-t-own)
  sigil so it doesn't fight on any of the six targets. The
  [sortable-drag VR spec](https://github.com/One-Learning-Community/rozie.js/blob/main/tests/visual-regression/specs/sortable-drag.spec.ts)
  pins this for every target cell.
- **Keyboard drag.** A Space-lift / ArrowDown-move / Space-drop / Escape-cancel
  keymap with aria-live announcements lives in user source — but the
  cross-target focus-restoration leak (Svelte / Solid / Lit's keyed
  reconcilers re-create row DOM on reorder, dropping focus to `<body>`) is
  closed by Rozie's
  [`$restoreFocus(selector, idx)`](/guide/features#restorefocus-selector-idx-—-keep-focus-on-a-row-across-keyed-reconciler-re-renders)
  sigil. No per-target user-source workarounds needed.
- **Nested droppables.** `SortableListNested` composes `SortableList` with
  itself (a Kanban-column demo) and via `KanbanColumn` wrapper, exercising
  cross-column card drag with reorderable columns. The same source compiles
  to all six targets unchanged.
- **Cross-list state sync.** `SortableListPair` exercises SortableList's
  `onAdd` / `onRemove` engine callbacks plus a module-level transfer slot —
  dragging an item from list A to list B updates BOTH bound arrays atomically.
  No per-framework state-management glue.
- **Custom drag handles.** `:handle="$classSelector('grip')"` resolves on every
  target, including React — authored class names render literally everywhere
  (React scopes via `[data-rozie-s-<hash>]`, it doesn't hash the class name), and
  `$classSelector` lowers to the literal `".grip"` per target while typo-checking
  it against your `<style>` at compile time. Most React-side libraries either
  skip scoped-CSS support or require consumers to wire selectors around a class
  mangler manually.

## Caveats

- **The keyboard cell is a feature of Rozie's SortableList example**, not a
  property of every library that wraps SortableJS. The keyboard map +
  aria-live announcements live in `packages/ui/sortable-list/src/SortableList.rozie`; the
  cross-target focus restoration is Rozie's `$restoreFocus` sigil. Library
  authors who fork SortableList and want the same keyboard contract get it
  for free.
- The matrix scores library out-of-the-box capability. Every "partial" column
  is reachable on those libraries with consumer-authored glue, but Rozie's
  `✓` means *no consumer glue required*.
- Rozie compiles to six targets — react-beautiful-dnd, dnd-kit, Vue.Draggable,
  svelte-dnd-action, and Angular CDK are excellent single-framework choices.
  The comparison is about cross-framework reach, not single-framework
  ergonomics.

## Try the live demo

The [SortableList example page](/examples/sortable-list) lives in the
documentation; the [SortableListDemo source](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/SortableListDemo.rozie)
is the same `.rozie` file that powers every target cell in the matrix above —
including the screen-reader-driven keyboard contract.

Ready to ship it? The [`SortableList` showcase + API reference](/guide/sortable-list)
documents the `@rozie-ui/sortable-list-*` packages — one pre-compiled,
per-framework install (`npm i @rozie-ui/sortable-list-react`, etc.) with no
Rozie toolchain required.
