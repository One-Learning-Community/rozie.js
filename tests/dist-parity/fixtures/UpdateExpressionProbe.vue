<template>

<div class="probe" v-bind="$attrs">
  <button aria-label="Decrement count" @click="decCount">−</button>
  <span class="count">{{ count }}</span>
  <button aria-label="Increment count" @click="incCount">+</button>
  <button aria-label="Decrement value" @click="decValue">−</button>
  <span class="value">{{ value }}</span>
  <button aria-label="Increment value" @click="incValue">+</button>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const value = defineModel<number>('value', { default: 0 });

const count = ref(0);

const incCount = () => {
  count.value++;
};
const decCount = () => {
  count.value--;
};
const incValue = () => {
  value.value++;
};
const decValue = () => {
  value.value--;
};
</script>

<style scoped>
.probe { display: inline-flex; gap: 0.5rem; align-items: center; }
.count, .value { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
button { padding: 0.25rem 0.5rem; }
</style>
