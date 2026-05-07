<template>
  <main class="card-page">
    <h2>Card Demo</h2>
    <p>Wrapper composition (D-119) — Card embeds CardHeader and renders default-slot content.</p>
    <CardRozie title="Hello world" :on-close="onClose">
      <p>This body lives in Card's default slot.</p>
      <p>Closes: {{ closeCount }}</p>
    </CardRozie>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CardRozie from '../../../../Card.rozie';

const closeCount = ref(0);
const onClose = () => {
  closeCount.value++;
};
</script>

<style scoped>
.card-page {
  padding: 1rem;
}
</style>
