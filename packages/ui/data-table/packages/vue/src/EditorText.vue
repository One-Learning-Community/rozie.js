<template>

<input ref="inputElRef" class="rdt-cell-editor" type="text" data-editing-cell="" :aria-label="a11yLabel()" :value="draftValue()" @input="onInput($event)" @keydown="onKeydown($event)" @blur="onBlur()" />

</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label` fallback.
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
     * The current cell value the editor seeds its local draft from (setup-once).
     */
    value?: Record<string, any> | null;
    /**
     * `(value) => void` — commit the edited cell value (from the `#editor` slot scope). Null-guarded at call sites.
     */
    commit?: ((...args: any[]) => any) | null;
    /**
     * `() => void` — revert the edit and close the editor (from the `#editor` slot scope). Null-guarded at call sites.
     */
    cancel?: ((...args: any[]) => any) | null;
    /**
     * Focus this editor's primary input when true — the host sets it for the one editor that should hold focus; reactive.
     */
    autofocus?: boolean;
    /**
     * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
     */
    columnLabel?: string;
  }>(),
  { columnId: '', column: null, row: null, value: null, commit: null, cancel: null, autofocus: false, columnLabel: '' }
);

const draft = ref('');
const touched = ref(false);

const inputElRef = ref<HTMLInputElement>();

// Seed the draft once at setup from the incoming value (setup-once, NOT in the
// template). Normalize null/undefined to '' so the input value binds to a string.
// ── N-04: the draft is DERIVED, not seeded setup-once ───────────────────────────────────
// A top-level `$data.draft = <read of $props.x>` is setup-once, and on ANGULAR the emitter
// places setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its
// DEFAULT — Angular sets inputs after construction. Measured on the sibling EditorDate: it
// opened EMPTY on angular for every row while vue and lit seeded correctly. Reading the prop
// through a derived function is correct on all six by construction, with no flash of an empty
// control on the fine-grained targets and no per-target branch — the pattern `FilterSelect`
// already uses (`selectValue()`), which is why FilterSelect was the one drop-in unaffected.
// `touched` keeps the live prop read from overwriting the user once they start typing.
const draftValue = () => touched.value ? draft.value : props.value != null ? String(props.value) : '';
// Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
// ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
const onInput = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
  touched.value = true;
};
// commit/cancel are Function props (default null) — guard before calling.
const doCommit = () => {
  props.commit && props.commit(draftValue());
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

// Editor-owns-focus contract: focus OUR OWN input when the host says we should hold focus.
// $onMount covers the initial open (autofocus already true on first render); the LAZY $watch
// (NOT { immediate: true } — an immediate watch fires PRE-mount, null ref on Lit/Solid) covers
// a REACTIVE refocus while already mounted (e.g. a row-mode validation failure that flips
// autofocus back onto this already-open drop-in).
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

onMounted(() => {
  if (props.autofocus) inputElRef.value?.focus();
});

watch(() => props.autofocus, (v: any) => {
  if (v) inputElRef.value?.focus();
}, { flush: 'post' });
</script>
