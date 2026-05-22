<template>

<div class="themed-button-consumer" v-bind="$attrs">
  <ThemedButton id="auto-btn" type="button" aria-label="Auto-fallthrough button" data-testid="auto-themed-button" class="extra-variant" style="--btn-bg: #ef4444" :label="'Auto'"></ThemedButton>

  <ThemedButtonManual id="manual-btn" type="button" aria-label="Manual fallthrough button" data-testid="manual-themed-button" class="extra-variant" style="--btn-bg: #10b981" :label="'Manual'"></ThemedButtonManual>
</div>

</template>

<script setup lang="ts">
import ThemedButton from './ThemedButton.vue';
import ThemedButtonManual from './ThemedButtonManual.vue';


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
