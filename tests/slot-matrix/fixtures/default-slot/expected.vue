<template>

<div class="default-slot-fixture">
  <slot></slot>
</div>

</template>

<script setup lang="ts">
defineSlots<{
  default(props: {  }): any;
}>();
</script>
