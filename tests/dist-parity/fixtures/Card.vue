<template>

<article class="card">
  <CardHeader :title="props.title" :on-close="props.onClose"></CardHeader>
  <div class="card__body">
    <slot></slot>
  </div>
</article>

</template>

<script setup lang="ts">
import CardHeader from './CardHeader.vue';

const props = withDefaults(
  defineProps<{ title?: string; onClose?: (...args: any[]) => any }>(),
  { title: '', onClose: null }
);

defineSlots<{
  default(props: {  }): any;
}>();
</script>

<style scoped>
.card { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
.card__body { padding: 1rem; }
</style>
