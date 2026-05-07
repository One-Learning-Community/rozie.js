<!--
  vue-ts TYPES-03 negative-path wrapper — proves Vue's <script setup
  generic="T"> narrows T at the template callsite by mounting Select with a
  type-mismatch and asserting vue-tsc rejects it (via @ts-expect-error).

  When the .rozie parser gains v2 generic="T" syntax + emitVue's genericParams
  flow through the full pipeline, this @ts-expect-error MUST still fire — it's
  the gate proving D-85 Vue full holds end-to-end.
-->
<script setup lang="ts">
import { ref } from 'vue';
import Select from './fixtures/Select.vue';

// number-typed selected ref — vue-tsc narrows T=number for this Select instance.
const selected = ref<number>(1);

// String-typed handler that DOES NOT match T=number narrowed at the template callsite.
const onUpdateBadType: (v: string) => void = (s) => void s;
</script>

<template>
  <!-- @vue-expect-error — onUpdate-handler typed as (v: string) doesn't match T=number narrowed via :selected="number-ref" -->
  <Select v-model:selected="selected" :items="[1, 2, 3]" @update:selected="onUpdateBadType" />
</template>
