<template>

  <div v-bind="$attrs">
    <span :class="['static-a static-b', 'lit-a lit-b']">string literal</span>
    <span :class="props.variant">string-typed prop</span>
    <span :class="['arr-a', props.variant]">array literal</span>
    <span :class="{ active: cond }">object literal</span>
    <span :class="props.arr">array via prop</span>
    <span :class="props.flags">object via prop</span>
    <span :class="['base', props.arr]">static + dynamic merge</span>
  </div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ variant?: string; arr?: any[]; flags?: Record<string, any> }>(),
  { variant: 'primary', arr: () => [], flags: () => ({}) }
);

const cond = ref(true);
</script>
