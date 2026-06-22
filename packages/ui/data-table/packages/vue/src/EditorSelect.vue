<template>

<select class="rdt-cell-editor" data-editing-cell="" :aria-label="props.columnId" :value="selectValue()" @change="onChange($event)" @keydown="onKeydown($event)">
  <option v-for="opt in props.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
</select>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ columnId?: string; column?: unknown | null; row?: unknown | null; value?: unknown | null; commit?: ((...args: any[]) => any) | null; cancel?: ((...args: any[]) => any) | null; options?: any[] }>(),
  { columnId: '', column: null, row: null, value: null, commit: null, cancel: null, options: () => [] }
);

// The <select> value binding coerced to a string. $props.value is typed `unknown`
// (opaque slot-scope), which the strict bundled-leaf tsc rejects against the
// native select `value` type (string | number | string[]) on React/Solid — the
// .rozie-native fix is a plain function returning a string (uniform ×6, NOT a
// $computed which can't be aliased; the listbox value-vs-accessor lesson).
const selectValue = () => props.value != null ? String(props.value) : '';

// Immediate-commit-on-change: read the selected value the global-filter way and
// commit it directly (no draft needed for a single-gesture select).
// Immediate-commit-on-change: read the selected value the global-filter way and
// commit it directly (no draft needed for a single-gesture select).
const onChange = (e: any) => {
  props.commit && props.commit(e && e.target ? e.target.value : '');
};
const onKeydown = (e: any) => {
  if (e && e.key === 'Escape') {
    e.preventDefault();
    props.cancel && props.cancel();
  }
};
</script>
