<template>

<div class="default-content-fallback-fixture" v-bind="$attrs">
  <slot name="status">
    <span class="fallback">No status provided.</span>
  </slot>
</div>

</template>

<script setup lang="ts">
defineSlots<{
  status(props: {  }): any;
}>();
</script>
