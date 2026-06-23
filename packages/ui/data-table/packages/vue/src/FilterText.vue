<template>

<input class="rdt-col-filter" type="text" :aria-label="props.columnId" :value="draft" @input="onInput($event)" @keydown="onKeydown($event)" @blur="onBlur()" />

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ columnId?: string; column?: unknown | null; value?: unknown | null; setFilter?: ((...args: any[]) => any) | null }>(),
  { columnId: '', column: null, value: null, setFilter: null }
);

const draft = ref('');

// Seed the draft once at setup from the incoming value (setup-once, NOT in the
// template). Normalize null/undefined to '' so the input value binds to a string.
draft.value = props.value != null ? String(props.value) : '';

// Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
// ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
// Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
// ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
const onInput = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
};

// setFilter is a Function prop (default null) — guard before calling.
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
