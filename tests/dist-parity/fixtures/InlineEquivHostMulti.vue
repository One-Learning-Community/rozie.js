<template>

<div class="partial-inline-host" v-bind="$attrs">
  <span class="echo">{{ editTransitionM }}</span>
  <span class="echo">{{ hostTailM(1) }}</span>
  <span class="echo">{{ columnChromeM(1) }}</span>
  <span class="echo">{{ outerM }}</span>
</div>

</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';

const props = withDefaults(
  defineProps<{ base?: number }>(),
  { base: 1 }
);

const inner = computed(() => props.base + 10);
const outerM = computed(() => clampD(inner.value + props.base));

import { clampB } from './partial-helpers.js';
import { clampD } from './wr01-helpers.js';
const headM = (n: number): number => n + 1;
let editTransitionM = 1;
// after-side: comment trails the host let editTransitionM and leads the spliced editorBindingsM below
const editorBindingsM = (k: number): number => k * 2;
// trailing-seam: the inline host successor trails the spliced editorBindingsM
const hostTailM = (n: number): number => editorBindingsM(1) + headM(n);
const tickM = (): number => props.base * 2;
// gap-0 leading: stays with the extracted columnChromeM, must NOT float to the hoisted import
const columnChromeM = (k: number): number => clampB(tickM() + k);

onMounted(() => {
  editTransitionM = 2;
});
</script>
