<template>

<span style="display:contents">
  <input class="rdt-col-filter" part="col-filter" type="number" :aria-label="props.columnId + ' min'" :placeholder="minPlaceholder()" :value="minDraft" @input="onMinInput($event)" @change="applyRange()" />
  <input class="rdt-col-filter" part="col-filter" type="number" :aria-label="props.columnId + ' max'" :placeholder="maxPlaceholder()" :value="maxDraft" @input="onMaxInput($event)" @change="applyRange()" />
</span>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label` base.
     */
    columnId?: string;
    /**
     * The table-core column object (opaque passthrough from the `#filter` slot scope).
     */
    column?: Record<string, any> | null;
    /**
     * The current column filter value (`[min, max]` tuple or null) the two inputs seed from (setup-once).
     */
    value?: Record<string, any> | null;
    /**
     * `(columnId, value) => void` — apply the column filter as a `[min, max]` tuple (each side coerced to a Number or `undefined`, so a one-sided range works); both empty clears the filter. Null-guarded at call sites.
     */
    setFilter?: ((...args: any[]) => any) | null;
    /**
     * The faceted `[min, max]` bounds for this column (`[number, number]` or null) — drives the input placeholders only.
     */
    minMax?: Record<string, any> | null;
  }>(),
  { columnId: '', column: null, value: null, setFilter: null, minMax: null }
);

const minDraft = ref('');
const maxDraft = ref('');

// Seed both drafts once at setup from the incoming [min,max] tuple (setup-once).
minDraft.value = Array.isArray(props.value) && props.value[0] != null ? String(props.value[0]) : '';
maxDraft.value = Array.isArray(props.value) && props.value[1] != null ? String(props.value[1]) : '';

// Untyped handler params neutralize to `any` (the global-filter idiom).
// Untyped handler params neutralize to `any` (the global-filter idiom).
const onMinInput = (e: any) => {
  minDraft.value = e && e.target ? e.target.value : '';
};
const onMaxInput = (e: any) => {
  maxDraft.value = e && e.target ? e.target.value : '';
};

// Plain string-coercion functions for the placeholders (NOT $computed — the
// EditorSelect/listbox lesson; opaque slot-scope props rejected by strict leaf tsc).
// Plain string-coercion functions for the placeholders (NOT $computed — the
// EditorSelect/listbox lesson; opaque slot-scope props rejected by strict leaf tsc).
const minPlaceholder = () => Array.isArray(props.minMax) && props.minMax[0] != null ? String(props.minMax[0]) : '';
const maxPlaceholder = () => Array.isArray(props.minMax) && props.minMax[1] != null ? String(props.minMax[1]) : '';

// Convert a draft to a Number or undefined (empty string → undefined so a
// one-sided range works). Both undefined → clear the filter.
// Convert a draft to a Number or undefined (empty string → undefined so a
// one-sided range works). Both undefined → clear the filter.
const applyRange = () => {
  const minNum = minDraft.value === '' ? undefined : Number(minDraft.value);
  const maxNum = maxDraft.value === '' ? undefined : Number(maxDraft.value);
  if (minNum === undefined && maxNum === undefined) {
    props.setFilter && props.setFilter(props.columnId, '');
  } else {
    props.setFilter && props.setFilter(props.columnId, [minNum, maxNum]);
  }
};
</script>
