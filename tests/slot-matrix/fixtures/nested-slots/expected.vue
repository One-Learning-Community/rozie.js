<template>

<div class="nested-slots-fixture" v-bind="$attrs">
  <slot name="wrapper">
    <div class="wrapper-fallback">
      <slot name="inner"></slot>
    </div>
  </slot>
</div>

</template>

<script setup lang="ts">
defineSlots<{
  wrapper(props: {  }): any;
  inner(props: {  }): any;
}>();
</script>
