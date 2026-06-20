<template>

<div class="partial-inline-host" v-bind="$attrs">
  <span class="echo">{{ outer }}</span>
</div>

</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ base?: number }>(),
  { base: 1 }
);

const inner = computed(() => props.base + 10);
const outer = computed(() => clampD(inner.value + props.base));

import { clampD } from './wr01-helpers.js';
</script>
