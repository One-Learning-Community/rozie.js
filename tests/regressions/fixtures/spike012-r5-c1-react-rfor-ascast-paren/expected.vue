<template>

<div class="r" v-bind="$attrs"><ul><li v-for="it in items as number[]" :key="it">{{ it }}</li></ul></div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const items = ref([1, 2, 3]);

function noop(): void {}
</script>
