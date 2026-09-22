<template>

<input ref="inputElRef" class="rdt-cell-editor" type="date" data-editing-cell="" :aria-label="a11yLabel()" :value="draftValue()" @input="onInput($event)" @change="onChange($event)" @keydown="onKeydown($event)" @blur="onBlur()" />

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

const draft = ref('');
const touched = ref(false);

const inputElRef = ref<HTMLInputElement>();

// C-07: the native `<input type="date">` accepts ONLY `YYYY-MM-DD` and renders BLANK for
// anything else, silently. The seed used to be `String($props.value)`, which is not the ISO
// coercion this component's own docs: string promises — so a `Date`, an ISO datetime string,
// an epoch number or a localised string all produced an empty editor. `toIsoDateString`
// (helpers/dateValue.ts) is the real coercion, pure and unit-tested.
import { toIsoDateString } from './helpers/dateValue';
// ── N-04: the draft is DERIVED, not seeded setup-once ───────────────────────────────────
// A top-level `$data.draft = <read of $props.x>` is setup-once, and on ANGULAR the emitter
// places setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its
// DEFAULT — Angular sets inputs after construction. Measured directly: this editor opened
// EMPTY on angular for every row, including one whose value was already `YYYY-MM-DD`, while
// vue and lit seeded correctly. That is why the shape of the incoming value (C-07) could not
// be the whole story, and why the existing EditorDate coverage never saw either problem: it
// fills the input before asserting anything.
//
// Reading the prop through a derived function instead is correct on all six by construction,
// with no flash of an empty control on the fine-grained targets and no per-target branch. It
// is the pattern `FilterSelect` in this same package already uses (`selectValue()`), which is
// exactly why FilterSelect was the one drop-in unaffected. `touched` is what keeps the user's
// typing from being overwritten by the live prop read once they have started editing.
const draftValue = () => touched.value ? draft.value : toIsoDateString(props.value);
const onInput = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
  touched.value = true;
};
const doCommit = () => {
  // commit the ISO date string the native control already produced.
  props.commit && props.commit(draftValue());
};
const doCancel = () => {
  props.cancel && props.cancel();
};
const onChange = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
  touched.value = true;
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
