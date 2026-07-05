<template>

<input class="rdt-cell-editor" type="date" data-editing-cell="" :aria-label="props.columnId" :value="draft" @input="onInput($event)" @change="onChange($event)" @keydown="onKeydown($event)" @blur="onBlur()" />

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
     */
    columnId?: string;
    /**
     * The table-core column object (opaque passthrough from the `#editor` slot scope).
     */
    column?: Record<string, any> | null;
    /**
     * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
     */
    row?: Record<string, any> | null;
    /**
     * The current cell value the local draft seeds from (setup-once); String-coerced to an ISO `YYYY-MM-DD` string for the native date input.
     */
    value?: Record<string, any> | null;
    /**
     * `(value) => void` — commit the cell with the ISO `YYYY-MM-DD` string (Enter / blur). Null-guarded at call sites.
     */
    commit?: ((...args: any[]) => any) | null;
    /**
     * `() => void` — revert the edit (Escape). Null-guarded at call sites.
     */
    cancel?: ((...args: any[]) => any) | null;
  }>(),
  { columnId: '', column: null, row: null, value: null, commit: null, cancel: null }
);

const draft = ref('');

// Seed the draft once from the incoming value (setup-once). A native date input
// only accepts `YYYY-MM-DD`; normalize null/undefined to ''.
draft.value = props.value != null ? String(props.value) : '';
const onInput = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
};
const doCommit = () => {
  // commit the ISO date string the native control already produced.
  props.commit && props.commit(draft.value);
};
const doCancel = () => {
  props.cancel && props.cancel();
};
const onChange = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
};
const onKeydown = (e: any) => {
  if (e && e.key === 'Enter') {
    e.preventDefault();
    doCommit();
  } else if (e && e.key === 'Escape') {
    e.preventDefault();
    doCancel();
  }
};
const onBlur = () => {
  doCommit();
};
</script>
