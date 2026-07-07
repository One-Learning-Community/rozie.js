<template>

<div class="r" v-bind="$attrs">
  <input @input="q = ($event.currentTarget as HTMLInputElement).value" />
  <span>{{ (n as number).toFixed(0) }}</span>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const q = ref('');
const n = ref(0);

function noop(): void {}
</script>
