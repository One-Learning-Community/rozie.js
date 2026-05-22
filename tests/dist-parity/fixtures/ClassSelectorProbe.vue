<template>

<div class="panel" :data-handle="'.panel'" :data-grip="gripSelector" v-bind="$attrs">
  <span class="grip" aria-hidden="true">⋮⋮</span>
  <span v-if="ready">ready</span></div>

</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const ready = ref(false);

// script-position class-selector helper call — exercises the rewriteScript.ts
// hook. Lowers per-target: ".grip" literal (Vue/Svelte/Solid/Angular/Lit) or
// "." + styles.grip (React).
const gripSelector = ".grip";

onMounted(() => {
  ready.value = true;
});
</script>

<style scoped>
.panel {
  display: block;
  padding: 0.5rem;
  font-family: system-ui, -apple-system, sans-serif;
}
.grip {
  cursor: grab;
  user-select: none;
  color: rgba(0, 0, 0, 0.35);
}
</style>
