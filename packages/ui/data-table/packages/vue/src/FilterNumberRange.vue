<template>

<span style="display:contents">
  <input class="rdt-col-filter" type="number" :aria-label="props.columnId + ' min'" :placeholder="minPlaceholder()" :value="minDraft" @input="onMinInput($event)" @change="applyRange()" />
  <input class="rdt-col-filter" type="number" :aria-label="props.columnId + ' max'" :placeholder="maxPlaceholder()" :value="maxDraft" @input="onMaxInput($event)" @change="applyRange()" />
</span>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ columnId?: string; column?: unknown | null; value?: unknown | null; setFilter?: ((...args: any[]) => any) | null; minMax?: unknown | null }>(),
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
