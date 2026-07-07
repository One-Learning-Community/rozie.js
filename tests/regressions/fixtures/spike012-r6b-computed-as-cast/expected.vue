<template>

<div class="r" v-bind="$attrs">{{ label }}</div>

</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ raw?: string }>(),
  { raw: '' }
);

const label = computed(() => ((props.raw + '!') as string));
</script>
