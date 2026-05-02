<template>
  <main class="counter-page">
    <h2>Counter Demo</h2>
    <CounterRozie v-model:value="value" :step="step" :min="-10" :max="10" />
    <p>External value: {{ value }}</p>
    <SourceMapTriggerRozie />
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CounterRozie from '../../../../Counter.rozie';
import SourceMapTriggerRozie from '../SourceMapTrigger.rozie';

const value = ref(0);
const step = ref(1);
</script>

<style scoped>
.counter-page {
  padding: 1rem;
}
</style>
