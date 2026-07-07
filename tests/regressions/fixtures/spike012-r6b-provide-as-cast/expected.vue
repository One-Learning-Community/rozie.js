<template>

<div class="r" v-bind="$attrs"><slot></slot></div>

</template>

<script setup lang="ts">
import { provide, ref } from 'vue';

defineSlots<{
  default(props: {  }): any;
}>();

const color = ref('red');

provide('theme', {
  get color(): string {
    return color.value;
  }
});
</script>
