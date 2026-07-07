<template>

<div class="r" v-bind="$attrs">
  <input @input="debouncedHandler0" />
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';
import { debounce } from '@rozie/runtime-vue';

const q = ref('');

function noop(): void {}

const debouncedHandler0 = debounce(($event: any) => { q.value = $event.target.value; }, 300);
</script>
