<template>

<select class="rdt-cell-editor" data-editing-cell="" :aria-label="props.columnId" :value="draft" @change="onChange($event)" @keydown="onKeydown($event)" @blur="onBlur()">
  <option v-for="opt in props.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
</select>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The column id (mirrors the `#editor` slot scope). Used as the select `aria-label`.
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
     * The current cell value the local draft seeds from (setup-once); String-coerced for the `<select>` binding.
     */
    value?: Record<string, any> | null;
    /**
     * `(value) => void` — commit the cell with the selected value (Enter / blur). Null-guarded at call sites.
     */
    commit?: ((...args: any[]) => any) | null;
    /**
     * `() => void` — revert the edit (Escape). Null-guarded at call sites.
     */
    cancel?: ((...args: any[]) => any) | null;
    /**
     * The select options — `[{ value, label }]`. Mirrors `<Column editorOptions>`.
     */
    options?: any[];
  }>(),
  { columnId: '', column: null, row: null, value: null, commit: null, cancel: null, options: () => [] }
);

const draft = ref('');

// Seed the draft once from the incoming value (setup-once). Normalize null/undefined
// to '' so the <select> binds to a string.
draft.value = props.value != null ? String(props.value) : '';

// Picking/arrow-cycling an option updates the draft only — no commit.
// Picking/arrow-cycling an option updates the draft only — no commit.
const onChange = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
};

// commit/cancel are Function props (default null) — guard before calling.
// commit/cancel are Function props (default null) — guard before calling.
const doCommit = () => {
  props.commit && props.commit(draft.value);
};
const doCancel = () => {
  props.cancel && props.cancel();
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
