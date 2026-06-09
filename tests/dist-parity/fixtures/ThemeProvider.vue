<template>

<div class="theme-provider" data-theme-provider="" v-bind="$attrs">
  <slot></slot>
</div>

</template>

<script setup lang="ts">
import { provide, ref } from 'vue';

defineSlots<{
  default(props: {  }): any;
}>();

const color = ref('red');

// The cycle order. A plain module constant — never reassigned.
const NEXT = {
  red: 'green',
  green: 'blue',
  blue: 'red'
};
const cycle = () => {
  color.value = NEXT[color.value];
};

// Publish the live theme. The GETTER is load-bearing (D-3 / REQ-29): reading
// `theme.color` at depth always reflects the current reactive `$data.color`,
// so clicking through `cycle()` cycles the displayed color at depth (the
// reactive round-trip). Snapshotting the primitive here (`{ color: $data.color }`)
// would freeze it at provide-time and kill the round-trip.

provide('theme', {
  get color() {
    return color.value;
  },
  cycle
});
</script>

<style scoped>
.theme-provider {
  display: block;
}
</style>
