<template>

<input class="rdt-cell-editor" type="checkbox" data-editing-cell="" :aria-label="props.columnId" :checked="!!props.value" @change="onChange($event)" @keydown="onKeydown($event)" />

</template>

<script setup lang="ts">
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
     * The current cell value — coerced to a real boolean via `!!` to seed the checkbox `checked` state.
     */
    value?: Record<string, any> | null;
    /**
     * `(value) => void` — commit the cell. This editor immediately commits the boolean checked state on `@change`. Null-guarded at call sites.
     */
    commit?: ((...args: any[]) => any) | null;
    /**
     * `() => void` — revert the edit (Escape). Null-guarded at call sites.
     */
    cancel?: ((...args: any[]) => any) | null;
  }>(),
  { columnId: '', column: null, row: null, value: null, commit: null, cancel: null }
);

// Immediate-commit-on-change: read .checked the global-filter way, coerce to a
// real boolean, and commit it directly.
const onChange = (e: any) => {
  props.commit && props.commit(!!(e && e.target ? e.target.checked : false));
};
const onKeydown = (e: any) => {
  if (e && e.key === 'Escape') {
    e.preventDefault();
    props.cancel && props.cancel();
  }
};
</script>
