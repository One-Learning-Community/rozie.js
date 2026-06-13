<template>

<div class="probe" v-bind="$attrs">
  <span class="count">count: {{ state.count }}</span>
  <span v-if="cloned" class="cloned">cloned</span></div>

</template>

<script setup lang="ts">
import { onMounted, ref, toRaw } from 'vue';

const state = ref({
  count: 0,
  created: new Date(0)
});
const cloned = ref<any>(null);

onMounted(() => {
  cloned.value = structuredClone(toRaw(state.value));
});
</script>

<style scoped>
.probe {
  display: block;
  padding: 0.5rem;
}
</style>
