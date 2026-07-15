<template>

<input class="rdt-col-filter" part="col-filter" type="text" :aria-label="props.columnId" :value="draft" @input="onInput($event)" @keydown="onKeydown($event)" @blur="onBlur()" />

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label`.
     */
    columnId?: string;
    /**
     * The table-core column object (opaque passthrough from the `#filter` slot scope).
     */
    column?: Record<string, any> | null;
    /**
     * The current column filter value the local draft seeds from (setup-once).
     */
    value?: Record<string, any> | null;
    /**
     * `(columnId, value) => void` — apply the column filter (Enter / blur applies, Escape clears). Null-guarded at call sites.
     */
    setFilter?: ((...args: any[]) => any) | null;
  }>(),
  { columnId: '', column: null, value: null, setFilter: null }
);

const draft = ref('');

// Seed the draft once at setup from the incoming value (setup-once, NOT in the
// template). Normalize null/undefined to '' so the input value binds to a string.
draft.value = props.value != null ? String(props.value) : '';
// Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
// ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
const onInput = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
};
// setFilter is a Function prop (default null) — guard before calling.
const applyFilter = () => {
  props.setFilter && props.setFilter(props.columnId, draft.value);
};
const clearFilter = () => {
  draft.value = '';
  props.setFilter && props.setFilter(props.columnId, '');
};
const onKeydown = (e: any) => {
  if (e && e.key === 'Enter') {
    e.preventDefault();
    applyFilter();
  } else if (e && e.key === 'Escape') {
    e.preventDefault();
    clearFilter();
  }
};
const onBlur = () => {
  applyFilter();
};
</script>
