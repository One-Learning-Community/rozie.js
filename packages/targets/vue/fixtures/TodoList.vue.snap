<template>

<div class="todo-list" v-bind="$attrs">
  <header>
    <slot name="header" :remaining="remaining" :total="items.length">
      
      <h3>{{ props.title }} ({{ remaining }} remaining)</h3>
    </slot>
  </header>

  <form @submit.prevent="add">
    <input v-model="draft" placeholder="What needs doing?" />
    <button type="submit" :disabled="!draft.trim()">Add</button>
  </form>

  <ul v-if="items.length > 0">
    <li v-for="item in items" :key="item.id" :class="{ done: item.done }">
      
      <slot :item="item" :toggle="() => toggle(item.id)" :remove="() => removeItem(item.id)">
        <label><input type="checkbox" :checked="item.done" @change="toggle(item.id)" /><span>{{ item.text }}</span></label>
        <button aria-label="Remove" @click="removeItem(item.id)">×</button>
      </slot>
    </li>
  </ul><p v-else class="empty">
    <slot name="empty">Nothing to do. ✨</slot>
  </p></div>

</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{ title?: string }>(),
  { title: 'Todo' }
);

const items = defineModel<any[]>('items', { default: () => [] });

const emit = defineEmits<{
  add: [...args: any[]];
  toggle: [...args: any[]];
  remove: [...args: any[]];
}>();

defineSlots<{
  header(props: { remaining: any; total: any }): any;
  default(props: { item: any; toggle: any; remove: any }): any;
  empty(props: {  }): any;
}>();

const draft = ref('');

const remaining = computed(() => items.value.filter((i: any) => !i.done).length);

const add = () => {
  const text = draft.value.trim();
  if (!text) return;
  items.value = [...items.value, {
    id: crypto.randomUUID(),
    text,
    done: false
  }];
  draft.value = '';
  emit('add', text);
};
const toggle = (id: any) => {
  items.value = items.value.map((i: any) => i.id === id ? {
    ...i,
    done: !i.done
  } : i);
  emit('toggle', id);
};

// Internal method renamed from `remove` to `removeItem` to avoid colliding
// with `HTMLElement.prototype.remove()` on the Lit target — Lit emits user
// methods as class fields and the resulting `remove(id)` signature is
// incompatible with the inherited `remove(): void`. Public API is unchanged:
// the slot param is still `:remove`, the emitted event is still `'remove'`.
// Internal method renamed from `remove` to `removeItem` to avoid colliding
// with `HTMLElement.prototype.remove()` on the Lit target — Lit emits user
// methods as class fields and the resulting `remove(id)` signature is
// incompatible with the inherited `remove(): void`. Public API is unchanged:
// the slot param is still `:remove`, the emitted event is still `'remove'`.
const removeItem = (id: any) => {
  items.value = items.value.filter((i: any) => i.id !== id);
  emit('remove', id);
};
</script>

<style scoped>
.todo-list { font-family: system-ui, sans-serif; }
ul { list-style: none; padding: 0; }
li { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
li.done span { text-decoration: line-through; opacity: 0.5; }
.empty { color: rgba(0, 0, 0, 0.4); font-style: italic; }
form { display: flex; gap: 0.25rem; margin-block: 0.5rem; }
</style>
