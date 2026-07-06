<template>

<div class="r" v-bind="$attrs"><input @input="debouncedHandler0" /></div>

</template>

<script setup lang="ts">
import { ref } from 'vue';
import { debounce } from '@rozie/runtime-vue';

const props = withDefaults(
  defineProps<{ onPick?: ((...args: any[]) => any) | null }>(),
  { onPick: () => {} }
);

const n = ref(0);

function bump(): void {
  n.value += 1;
}

const debouncedHandler0 = debounce(props.onPick, 300);
</script>
