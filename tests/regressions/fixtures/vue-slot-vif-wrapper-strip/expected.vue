<template>

<section class="panel">
  <header v-if="$slots.header || props.title">
    
    <slot name="header">{{ props.title }}</slot>
  </header><div class="body">
    <slot></slot>
  </div>
</section>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ title?: string }>(),
  { title: '' }
);

defineSlots<{
  header(props: {  }): any;
  default(props: {  }): any;
}>();
</script>

<style scoped>
.panel { border: 1px solid rgba(0, 0, 0, 0.1); }
</style>
