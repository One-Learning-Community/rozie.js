<template>

<Producer v-model:open="outerOpen"><template #footer="{ close }">
    <Inner v-model:open="outerOpen"></Inner>
    <button @click="close">×</button>
  </template></Producer>

</template>

<script setup lang="ts">
import Producer from './producer.vue';
import Inner from './producer.vue';

import { ref } from 'vue';

const outerOpen = ref(true);
const innerVal = ref('hello');
</script>
