<template>

<Inner><template #header>
    <slot name="title">default title</slot>
  </template><slot>default body</slot></Inner>

</template>

<script setup lang="ts">
import Inner from './inner.vue';

defineSlots<{
  title(props: {  }): any;
  default(props: {  }): any;
}>();
</script>
