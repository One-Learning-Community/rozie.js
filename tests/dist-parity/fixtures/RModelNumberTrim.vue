<template>

<div class="rmodel-number-trim">
  <input type="text" v-model.trim.number="quantity" placeholder="Enter a quantity" />
  <p class="echo">Quantity: {{ quantity }}</p>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const quantity = ref(0);
</script>

<style scoped>
.rmodel-number-trim { display: inline-flex; flex-direction: column; gap: 0.25rem; }
.echo { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
</style>
