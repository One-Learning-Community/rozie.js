<template>

<button class="theme-button" data-theme-button="" type="button" v-bind="$attrs" @click="theme && theme.cycle()">
  {{ theme && theme.color }}
</button>

</template>

<script setup lang="ts">
import { inject } from 'vue';

const theme = inject('theme');
</script>

<style scoped>
.theme-button {
  font-family: system-ui, -apple-system, sans-serif;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
</style>
