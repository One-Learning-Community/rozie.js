<template>

  <div v-bind="$attrs">
    <span :style="[{ color: 'red' }, { color: 'blue' }]">object+object override (later wins → blue)</span>
    <span :style="[props.s, { fontSize: '12px' }]">string+object</span>
    <span :style="[props.base, props.s]">dynamic+dynamic</span>
  </div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ base?: Record<string, any>; s?: string }>(),
  { base: () => ({}), s: '' }
);
</script>
