<template>

<div v-bind="$attrs">
  
  <span :style="pinStyle(props.colId) + ';' + pad">bug element</span>

  
  <span :style="['color:red', 'font-weight:bold;']">merge-guard element</span>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ colId?: string }>(),
  { colId: 'a' }
);

const pad = ref('padding-left:8px');

const pinStyle = (id: any) => `z-index:1;`;
</script>
