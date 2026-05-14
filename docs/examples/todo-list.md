<script setup>
import { ref } from 'vue';
import TodoList from '../../examples/TodoList.rozie';

const items = ref([
  { id: '1', text: 'Try the live demo', done: true },
  { id: '2', text: 'Add another item below', done: false },
  { id: '3', text: 'Toggle some checkboxes', done: false },
]);
</script>

# TodoList

Demonstrates `r-for` with required `:key`, two-way bound `items` array via `model: true`, multiple `$emit` calls for `add`/`toggle`/`remove`, named slot with fallback content (`#header` falls back to a default heading), default slot with per-item scoped params (the marquee scoped-slot pattern — consumer can override the row renderer), and `r-if` / `r-else` for the empty-state branch.

This is the heaviest scoped-slots example. The React output shows the documented divergence: instead of children-as-JSX, React consumers see a render-prop callback (`children?: (ctx) => ReactNode`, `renderHeader?: (ctx) => ReactNode`). The other four targets keep an idiomatic markup form.

## Live demo

Two-way bound to the page's `items` ref. Add, toggle, remove — every mutation flows back through `v-model:items` to the parent state. Delete every item and the empty-state slot's fallback kicks in.

<div class="rozie-demo">
  <ClientOnly>
    <TodoList v-model:items="items" title="Demo todos" />
  </ClientOnly>

  <p>Items on the page-level ref: <strong>{{ items.length }}</strong> ({{ items.filter(i => !i.done).length }} remaining)</p>
</div>

## Source — TodoList.rozie

```rozie-src TodoList
```

## Vue output

```rozie-out TodoList vue
```

## React output

```rozie-out TodoList react
```

## Svelte output

```rozie-out TodoList svelte
```

## Angular output

```rozie-out TodoList angular
```

## Solid output

```rozie-out TodoList solid
```

## Lit output

```rozie-out TodoList lit
```
