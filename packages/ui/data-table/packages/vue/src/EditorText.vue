<template>

<input class="rdt-cell-editor" type="text" data-editing-cell="" :aria-label="props.columnId" :value="draft" @input="onInput($event)" @keydown="onKeydown($event)" @blur="onBlur()" />

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ columnId?: string; column?: Record<string, any> | null; row?: Record<string, any> | null; value?: Record<string, any> | null; commit?: ((...args: any[]) => any) | null; cancel?: ((...args: any[]) => any) | null }>(),
  { columnId: '', column: null, row: null, value: null, commit: null, cancel: null }
);

const draft = ref('');

// Seed the draft once at setup from the incoming value (setup-once, NOT in the
// template). Normalize null/undefined to '' so the input value binds to a string.
draft.value = props.value != null ? String(props.value) : '';

// Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
// ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
// Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
// ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
const onInput = (e: any) => {
  draft.value = e && e.target ? e.target.value : '';
};

// commit/cancel are Function props (default null) — guard before calling.
// commit/cancel are Function props (default null) — guard before calling.
const doCommit = () => {
  props.commit && props.commit(draft.value);
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
</script>
