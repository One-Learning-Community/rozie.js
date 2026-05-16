<template>

<Producer><template #header="{ close }">
    <button @click="close">×</button>
  </template>
  Body text
</Producer>

</template>

<script setup lang="ts">
import Producer from './producer.vue';


</script>
