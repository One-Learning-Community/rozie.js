<!--
  vue-ts TYPES-03 wrapper — exercises Select<T>'s template-side generic
  narrowing under vue-tsc.

  Vue 3.4+ infers `T` from a `defineModel<T>('selected')`-bound v-model when
  the parent template instantiates `<Select v-model:selected="value" />`. By
  pinning `value` to a concrete `string` ref, vue-tsc narrows T=string
  through the SFC and rejects mismatched onUpdate handlers.

  This file completes TYPES-03 / D-85 Vue full enforcement at the template
  callsite — the contract that downstream component-library consumers
  actually use.
-->
<script setup lang="ts">
import { ref } from 'vue';
import Select from './fixtures/Select.vue';

const selected = ref<string>('a');

// vue-tsc narrows T=string here; the model triplet exposes `string | undefined`
// (defineModel allows the inflight unset state). Passing a number-typed
// handler would error.
function onUpdate(next: string | undefined): void {
  if (next !== undefined) selected.value = next;
}
</script>

<template>
  <Select v-model:selected="selected" :items="['a', 'b', 'c']" @update:selected="onUpdate" />
</template>
