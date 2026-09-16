<template>

<input ref="inputElRef" class="rdt-cell-editor" type="checkbox" data-editing-cell="" :aria-label="a11yLabel()" :checked="!!props.value" @change="onChange($event)" @keydown="onKeydown($event)" />

</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

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
    /**
     * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
     */
    autofocus?: boolean;
    /**
     * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
     */
    columnLabel?: string;
  }>(),
  { columnId: '', column: null, row: null, value: null, commit: null, cancel: null, autofocus: false, columnLabel: '' }
);

const inputElRef = ref<HTMLInputElement>();

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
// C-11 — the accessible name must be the column's HUMAN header, not its internal id.
// `columnId` is a lookup key (`unit_price`, `col_3`); a screen reader announcing it is
// reading an implementation detail aloud. table-core keeps the authored header on
// `column.columnDef.header`, which is a string for every declarative `<Column header>`;
// a header rendered by a function has no static text, so fall back to the id rather
// than invent one.
const a11yLabel = () => {
  if (typeof props.columnLabel === 'string' && props.columnLabel !== '') return props.columnLabel;
  return props.columnId;
};

// C-02 / editor-owns-focus: focus OUR OWN control when the host says we should hold it.
// $onMount covers the initial open (autofocus is already true on first render); the LAZY
// $watch (NOT { immediate: true } — an immediate watch fires PRE-mount and sees a null
// ref on Lit/Solid) covers a REACTIVE refocus while already mounted, e.g. a row-mode
// validation failure flipping autofocus back onto this already-open drop-in.

onMounted(() => {
  if (props.autofocus) inputElRef.value?.focus();
});

watch(() => props.autofocus, (v: any) => {
  if (v) inputElRef.value?.focus();
}, { flush: 'post' });
</script>
