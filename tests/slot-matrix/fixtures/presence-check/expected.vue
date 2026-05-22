<template>

<div class="presence-check-fixture" v-bind="$attrs">
  <aside v-if="$slots.aside">
    <slot name="aside"></slot>
  </aside></div>

</template>

<script setup lang="ts">
defineSlots<{
  aside(props: {  }): any;
}>();
</script>
