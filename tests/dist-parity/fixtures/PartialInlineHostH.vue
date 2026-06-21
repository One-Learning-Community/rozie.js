<template>

<div class="partial-inline-host" v-bind="$attrs">
  <span class="echo">{{ editTransitionH }}</span>
  <span class="echo">{{ editorBindingsH(1) }}</span>
</div>

</template>

<script setup lang="ts">
import { onMounted } from 'vue';

const props = withDefaults(
  defineProps<{ base?: number }>(),
  { base: 1 }
);

import { clampH } from './partial-helpers.js';
let editTransitionH = 1;
// leading: stays with the extracted decl, must NOT float to the hoisted import
// leading: stays with the extracted decl, must NOT float to the hoisted import
const editorBindingsH = (k: number): number => clampH(k * 2);

onMounted(() => {
  editTransitionH = 2;
});
</script>
