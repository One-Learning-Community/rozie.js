<template>

<input class="rdt-cell-editor" type="date" data-editing-cell="" :aria-label="props.columnId" :value="draft" @input="onInput($event)" @change="onChange($event)" @keydown="onKeydown($event)" @blur="onBlur()" />

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ columnId?: string; column?: Record<string, any> | null; row?: Record<string, any> | null; value?: Record<string, any> | null; commit?: ((...args: any[]) => any) | null; cancel?: ((...args: any[]) => any) | null }>(),
  { columnId: '', column: null, row: null, value: null, commit: null, cancel: null }
);

const draft = ref('');

// Seed the draft once from the incoming value (setup-once). A native date input
// only accepts `YYYY-MM-DD`; normalize null/undefined to ''.
draft.value = props.value != null ? String(props.value) : '';
const onInput = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
};
const doCommit = () => {
  // commit the ISO date string the native control already produced.
  props.commit && props.commit(draft.value);
};
const doCancel = () => {
  props.cancel && props.cancel();
};
const onChange = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
  doCommit();
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
</script>
