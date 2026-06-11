---
title: SortableList — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import SortableList from '@rozie-ui/sortable-list-vue';

// A self-contained, network-free task list — plain `{ id, label }` objects so
// the demo works offline and in CI with no external assets.
const SEED = () => [
  { id: 'a', label: '☕  Brew coffee' },
  { id: 'b', label: '📥  Triage inbox' },
  { id: 'c', label: '✍️  Write the docs page' },
  { id: 'd', label: '🧪  Run the test matrix' },
  { id: 'e', label: '🚢  Ship it' },
];

const sortable = ref();
const items = ref(SEED());
let nextId = 0;

const shuffle = () => {
  const next = [...items.value];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  items.value = next;
};
const reset = () => { items.value = SEED(); };
const addItem = () => { items.value = [...items.value, { id: 'new-' + nextId++, label: '✨  New task ' + nextId }]; };
const removeLast = () => { items.value = items.value.slice(0, -1); };
const toggleDisabled = () => {
  const now = sortable.value?.option('disabled') ?? false;
  sortable.value?.option('disabled', !now);
};
</script>

# SortableList — live demo

This is the **real `@rozie-ui/sortable-list-vue` package** running on this page (VitePress is itself a Vue app). Drag the rows by the **⋮⋮** handle to reorder them — or use the keyboard (Tab to a row, Space to lift, ArrowUp/ArrowDown to move, Space to drop). The buttons mutate the bound array directly, and the live readout proves the two-way order updates. Everything below is driven by the same `SortableList.rozie` source that compiles to all six frameworks.

<ClientOnly>
<div class="sortable-live">
  <div class="sortable-live__controls">
    <button @click="shuffle">🔀 Shuffle</button>
    <button @click="reset">Reset</button>
    <span class="sortable-live__sep" />
    <button @click="addItem">＋ Add item</button>
    <button @click="removeLast">－ Remove last</button>
    <span class="sortable-live__sep" />
    <button @click="toggleDisabled">Toggle drag</button>
    <button class="sortable-live__primary" @click="reset">Reset ▸</button>
  </div>

  <div class="sortable-live__stage">
    <SortableList
      ref="sortable"
      v-model:items="items"
      item-key="id"
      :handle="'.grip'"
      :animation="180"
    >
      <template #default="{ item, index }">
        <div class="sortable-live__row">
          <span class="grip" aria-label="Drag handle">⋮⋮</span>
          <span class="sortable-live__num">{{ index + 1 }}</span>
          <span class="sortable-live__label">{{ item.label }}</span>
        </div>
      </template>
    </SortableList>
  </div>

  <div class="sortable-live__readout">
    <code>order · {{ items.map(i => i.id).join(' → ') }}</code>
  </div>
</div>
</ClientOnly>

The list is two-way bound with `v-model:items` — the readout above updates live as you drag or press the buttons, and "Toggle drag" drives the imperative handle (`option('disabled', …)`). The component renders each row through its **default scoped slot** (`{ item, index }`), and `item-key="id"` keeps the keyed reconciler stable across reorders. See the [full API](/components/sortable-list) for the complete prop/event/handle surface.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/sortable-list/src/SortableList.rozie{html}[SortableList.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/sortable-list-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/sortable-list/packages/react/src/SortableList.tsx[React]
<<< ../../packages/ui/sortable-list/packages/vue/src/SortableList.vue[Vue]
<<< ../../packages/ui/sortable-list/packages/svelte/src/SortableList.svelte[Svelte]
<<< ../../packages/ui/sortable-list/packages/angular/src/SortableList.ts[Angular]
<<< ../../packages/ui/sortable-list/packages/solid/src/SortableList.tsx[Solid]
<<< ../../packages/ui/sortable-list/packages/lit/src/SortableList.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Same props, same events, same imperative handle, same default scoped slot, all from the one source above.

## See also

- [SortableList — showcase & API](/components/sortable-list) — install, quick starts for all six frameworks, and the full reference.
- [Sortable libraries comparison](/components/sortable-comparison) — how `@rozie-ui/sortable-list` stacks up against react-sortablejs, dnd-kit, Vue.Draggable, svelte-dnd-action, and the Angular CDK.

<style scoped>
.sortable-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.sortable-live__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}
.sortable-live__controls button {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.sortable-live__controls button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.sortable-live__controls button.sortable-live__primary {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
}
.sortable-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.3rem;
  background: var(--vp-c-divider);
}
.sortable-live__stage {
  background: var(--vp-c-bg);
  border-radius: 8px;
  padding: 0.5rem;
}
.sortable-live__row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.7rem;
  margin: 0.3rem 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}
.sortable-live__row .grip {
  cursor: grab;
  color: var(--vp-c-text-3);
  font-weight: 700;
  letter-spacing: -2px;
  user-select: none;
}
.sortable-live__row .grip:active {
  cursor: grabbing;
}
.sortable-live__num {
  min-width: 1.4rem;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-3);
}
.sortable-live__label {
  color: var(--vp-c-text-1);
}
.sortable-live__readout {
  min-height: 1.4rem;
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
</style>
