<template>

<div class="theme-passthrough" data-theme-passthrough="" v-bind="$attrs">
  <slot></slot>
</div>

</template>

<script setup lang="ts">
defineSlots<{
  default(props: {  }): any;
}>();
</script>

<style scoped>
.theme-passthrough {
  display: block;
  padding: 0.5rem;
  border: 1px dashed rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}
</style>
