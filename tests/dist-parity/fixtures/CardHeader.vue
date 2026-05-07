<template>

<header class="card-header">
  <h3 class="card-header__title">{{ props.title }}</h3>
  <button v-if="props.onClose" class="card-header__close" @click="props.onClose">×</button></header>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ title?: string; onClose?: (...args: any[]) => any }>(),
  { title: '', onClose: null }
);
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
.card-header__title { margin: 0; font-size: 1rem; font-weight: 600; }
.card-header__close { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }
</style>
