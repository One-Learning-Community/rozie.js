<template>

<div class="partial-inline-host" v-bind="$attrs">
  <span class="echo">{{ usedFirstF }}</span>
  <span class="echo">{{ usedSecondF }}</span>
</div>

</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ base?: number }>(),
  { base: 1 }
);

const usedFirstF = computed(() => clamp(tickF + props.base));
const usedSecondF = computed(() => clamp(usedFirstF.value + 1));

import { clamp } from './partial-helpers.js';
const tickF = props.base * 2;
</script>
