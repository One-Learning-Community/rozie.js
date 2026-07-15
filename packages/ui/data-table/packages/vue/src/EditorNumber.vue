<template>

<input class="rdt-cell-editor" type="number" data-editing-cell="" :aria-label="props.columnId" :value="draft" @input="onInput($event)" @keydown="onKeydown($event)" @blur="onBlur()" />

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
     * The current cell value the local draft string seeds from (setup-once).
     */
    value?: Record<string, any> | null;
    /**
     * `(value) => void` — commit the cell. The draft is coerced with `Number()` at commit time; an empty/whitespace or non-numeric draft commits `null` (never `NaN`). Null-guarded at call sites.
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

// Seed the draft string once from the incoming value (setup-once).
draft.value = props.value != null ? String(props.value) : '';
const onInput = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
};
// Coerce to a Number at commit time. Defensive guard: an empty/whitespace draft
// commits null rather than NaN (Number('') === 0 is a silent footgun); a
// non-numeric draft also commits null. Otherwise commit the coerced number.
const doCommit = () => {
  if (!props.commit) return;
  const raw = draft.value;
  if (raw == null || String(raw).trim() === '') {
    props.commit(null);
    return;
  }
  const n = Number(raw);
  props.commit(Number.isNaN(n) ? null : n);
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
