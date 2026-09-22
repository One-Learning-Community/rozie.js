<template>

<input class="rdt-col-filter" part="col-filter" type="text" :aria-label="a11yLabel()" :value="draftValue()" @input="onInput($event)" @keydown="onKeydown($event)" @blur="onBlur()" />

</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });

import { ref, watch } from 'vue';

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
    /**
     * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
     */
    columnLabel?: string;
  }>(),
  { columnId: '', column: null, value: null, setFilter: null, columnLabel: '' }
);

const draft = ref('');
const touched = ref(false);

// ── C-08 + N-04: the draft is DERIVED from `$props.value`, with a `touched` latch ────────
//
// C-08 — this component mounts once per rendered filter row and is NOT remounted when the
// filter changes, and its draft was seeded setup-once. So a programmatic reset (a "Clear
// filters" button, `setFilter(id, '')` from another control, a consumer writing
// `columnFilters` directly) moved the real filter while this input went on displaying the old
// text: the UI stated a filter that was no longer applied. `FilterSelect` was never affected —
// it reads `$props.value` live through `selectValue()`, which is the pattern adopted here.
//
// N-04 — the setup-once seed was ALSO wrong on Angular from the start: the emitter places
// setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its
// DEFAULT, because Angular sets inputs after construction. Measured on the sibling EditorDate,
// which opened empty on angular for every row while vue and lit seeded correctly. A derived
// read is correct on all six by construction, with no flash and no per-target branch.
//
// `touched` is what stops the live read from overwriting the user mid-type; the watch clears
// it, so an OUTSIDE change always wins and the input follows it. `@input` never moves
// `$props.value` (nothing is applied until Enter/blur), so the two can never fight.
const draftValue = () => touched.value ? draft.value : props.value != null ? String(props.value) : '';
// Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
// ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
const onInput = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
  touched.value = true;
};
// setFilter is a Function prop (default null) — guard before calling.
const applyFilter = () => {
  props.setFilter && props.setFilter(props.columnId, draftValue());
};
const clearFilter = () => {
  draft.value = '';
  touched.value = false;
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

watch(() => props.value, () => {
  touched.value = false;
}, { flush: 'post' });
</script>
