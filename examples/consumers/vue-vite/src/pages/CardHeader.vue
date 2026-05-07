<template>
  <main class="card-header-page">
    <h2>CardHeader Demo</h2>
    <p>Standalone leaf component — wrapper-pair partner of Card.</p>
    <CardHeaderRozie title="Standalone header" :on-close="onClose" />
    <p>Closes: {{ closeCount }}</p>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CardHeaderRozie from '../../../../CardHeader.rozie';

const closeCount = ref(0);
const onClose = () => {
  closeCount.value++;
};
</script>

<style scoped>
.card-header-page {
  padding: 1rem;
}
</style>
