<template>

<div class="partial-inline-host" v-bind="$attrs">
  <span class="echo">{{ usedName }}</span>
</div>

</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ base?: number }>(),
  { base: 1 }
);

const usedName = computed(() => clamp(double(props.base)));

import { clamp } from './partial-helpers.js';

/* between-statement: a transitive non-exported helper pulled in as the closure of usedName */
/* between-statement: a transitive non-exported helper pulled in as the closure of usedName */
const double = (n: number): number => n * 2; // trailing: doubles its input

// leading: the used $computed export (comment immediately above)
</script>
