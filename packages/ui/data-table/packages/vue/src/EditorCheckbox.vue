<template>

<input class="rdt-cell-editor" type="checkbox" data-editing-cell="" :aria-label="props.columnId" :checked="!!props.value" @change="onChange($event)" @keydown="onKeydown($event)" />

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ columnId?: string; column?: Record<string, any> | null; row?: Record<string, any> | null; value?: Record<string, any> | null; commit?: ((...args: any[]) => any) | null; cancel?: ((...args: any[]) => any) | null }>(),
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
