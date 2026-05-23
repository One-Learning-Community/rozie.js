<template>

<div class="themed-button-consumer" v-bind="$attrs">
  <ThemedButton id="auto-btn" type="button" aria-label="Auto-fallthrough button" data-testid="auto-themed-button" class="extra-variant" style="--btn-bg: #ef4444" :label="'Auto'" @click="onClick" @mouseenter="onMouseEnter"></ThemedButton>

  <ThemedButtonManual id="manual-btn" type="button" aria-label="Manual fallthrough button" data-testid="manual-themed-button" class="extra-variant" style="--btn-bg: #10b981" :label="'Manual'" @click="onClick" @mouseenter="onMouseEnter"></ThemedButtonManual>

  <ThemedButtonListenersManual id="listeners-manual-btn" type="button" aria-label="Listeners-manual fallthrough button" data-testid="listeners-manual-themed-button" class="extra-variant" style="--btn-bg: #f59e0b" :label="'Listeners Manual'" @click="onClick" @mouseenter="onMouseEnter"></ThemedButtonListenersManual>

  <ThemedButtonAllManual id="all-manual-btn" type="button" aria-label="All-manual fallthrough button" data-testid="all-manual-themed-button" class="extra-variant" style="--btn-bg: #8b5cf6" :label="'All Manual'" @click="onClick" @mouseenter="onMouseEnter"></ThemedButtonAllManual>
</div>

</template>

<script setup lang="ts">
import ThemedButton from './ThemedButton.vue';
import ThemedButtonManual from './ThemedButtonManual.vue';
import ThemedButtonListenersManual from './ThemedButtonListenersManual.vue';
import ThemedButtonAllManual from './ThemedButtonAllManual.vue';

import { ref } from 'vue';

const onClick = ref(() => {});
const onMouseEnter = ref(() => {});
</script>

<style scoped>
.themed-button-consumer {
  display: inline-flex;
  gap: 0.75rem;
  padding: 0.5rem;
}
.extra-variant {
  font-weight: 600;
}
</style>
