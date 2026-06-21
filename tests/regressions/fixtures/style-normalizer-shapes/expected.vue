<template>

  <div v-bind="$attrs">
    <span :style="{ color: 'red' }">object literal</span>
    <span :style="props.s">string via prop</span>
    <span :style="props.obj">object via prop</span>
  </div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ s?: string; obj?: Record<string, any> }>(),
  { s: '', obj: () => ({}) }
);
</script>
