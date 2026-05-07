<template>
<!-- empty template -->
</template>

<script setup lang="ts" generic="T">
interface SelectProps<T> { items?: unknown[] }
const props = defineProps<SelectProps<T>>();

const selected = defineModel<T>('selected');
</script>
