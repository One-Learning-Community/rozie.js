<template>

<div class="card-body" part="body" v-bind="$attrs">
  <h3 class="card-title">{{ props.title }}</h3>
  <slot></slot>
</div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ title?: string }>(),
  { title: 'Card' }
);

defineSlots<{
  default(props: {  }): any;
}>();
</script>

<style scoped>
.card-body {
  padding: 1rem;
  border-radius: 0.5rem;
  background: #f3f4f6;
}
.card-title {
  margin: 0 0 0.5rem;
  font: inherit;
  font-weight: 600;
}
</style>
