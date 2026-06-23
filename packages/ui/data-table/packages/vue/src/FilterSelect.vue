<template>

<select class="rdt-col-filter" :aria-label="props.columnId" :value="selectValue()" @change="onChange($event)">
  <option value="">All</option>
  <option v-for="opt in props.uniqueValues" :key="opt" :value="opt">{{ opt }}</option>
</select>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ columnId?: string; column?: Record<string, any> | null; value?: Record<string, any> | null; setFilter?: ((...args: any[]) => any) | null; uniqueValues?: any[] }>(),
  { columnId: '', column: null, value: null, setFilter: null, uniqueValues: () => [] }
);

// The <select> value binding coerced to a string. $props.value is typed `unknown`
// (opaque slot-scope), which the strict bundled-leaf tsc rejects against the native
// select `value` type on React/Solid — the fix is a plain function returning a
// string (uniform ×6, NOT a $computed; the EditorSelect/listbox value lesson).
const selectValue = () => props.value != null ? String(props.value) : '';

// Immediate-apply-on-change: read the selected value the global-filter way. An
// empty value (the leading "All" option) clears the column filter.
// Immediate-apply-on-change: read the selected value the global-filter way. An
// empty value (the leading "All" option) clears the column filter.
const onChange = (e: any) => {
  const v = e && e.target ? e.target.value : '';
  if (v === '') {
    props.setFilter && props.setFilter(props.columnId, '');
  } else {
    props.setFilter && props.setFilter(props.columnId, v);
  }
};
</script>
