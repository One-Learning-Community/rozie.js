<template>

<select class="rdt-col-filter" part="col-filter" :aria-label="props.columnId" :value="selectValue()" @change="onChange($event)">
  <option value="">All</option>
  <option v-for="opt in props.uniqueValues" :key="opt" :value="opt">{{ opt }}</option>
</select>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /**
     * The column id (mirrors the `#filter` slot scope) — used as the filter key and the select `aria-label`.
     */
    columnId?: string;
    /**
     * The table-core column object (opaque passthrough from the `#filter` slot scope).
     */
    column?: Record<string, any> | null;
    /**
     * The current column filter value the select seeds from (String-coerced).
     */
    value?: Record<string, any> | null;
    /**
     * `(columnId, value) => void` — apply the column filter on change; the leading empty "All" option clears it. Null-guarded at call sites.
     */
    setFilter?: ((...args: any[]) => any) | null;
    /**
     * The faceted distinct keys for this column (cross-filtered, keys only — no occurrence counts) used to build the `<option>` list.
     */
    uniqueValues?: any[];
  }>(),
  { columnId: '', column: null, value: null, setFilter: null, uniqueValues: () => [] }
);

// The <select> value binding coerced to a string. $props.value is typed `unknown`
// (opaque slot-scope), which the strict bundled-leaf tsc rejects against the native
// select `value` type on React/Solid — the fix is a plain function returning a
// string (uniform ×6, NOT a $computed; the EditorSelect/listbox value lesson).
const selectValue = () => props.value != null ? String(props.value) : '';
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
