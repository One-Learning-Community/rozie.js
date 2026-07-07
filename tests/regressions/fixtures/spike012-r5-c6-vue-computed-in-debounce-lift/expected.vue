<template>

<input v-bind="$attrs" @input="debouncedHandler0" />

</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { debounce } from '@rozie/runtime-vue';

const q = ref('');

const label = computed(() => 'x');

const debouncedHandler0 = debounce(($event: any) => { q.value = label.value; }, 300);
</script>
