<template>

<div class="r" v-bind="$attrs">
  <button @click="q = n > 0 ? 'a' : 'b'">go</button>
  <input @input="debouncedHandler0" />
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';
import { debounce } from '@rozie/runtime-vue';

const value = defineModel<string>('value', { default: '' });

const n = ref(0);
const q = ref('');

function noop(): void {}

const debouncedHandler0 = debounce(($event: any) => { value.value = ($event.currentTarget as HTMLInputElement).value; }, 300);
</script>
