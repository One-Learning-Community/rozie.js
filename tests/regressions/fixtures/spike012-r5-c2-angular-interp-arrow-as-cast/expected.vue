<template>

<div v-bind="$attrs">{{ items.filter(x => x as number > 1).length }}</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const items = ref([1, 2, 3]);

function noop(): void {}
</script>
