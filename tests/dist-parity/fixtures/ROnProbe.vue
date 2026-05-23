<template>

<div class="r-on-probe">
  <span @click.stop="fn" @input="debouncedOnInput">literal modifier-bearing</span>
  <span v-on="normalizeListeners(someObj)">dynamic</span>
  <span @click="($event) => { f1($event); f2($event); }">R6 source-order merge</span>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';
import { debounce, normalizeListeners } from '@rozie/runtime-vue';

const fn = ref(() => {});
const onInput = ref(() => {});
const f1 = ref(() => {});
const f2 = ref(() => {});
const someObj = ref({
  click: () => {},
  mouseenter: () => {}
});

const debouncedOnInput = debounce(onInput, 300);
</script>

<style scoped>
.r-on-probe {
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.25rem;
}
.r-on-probe span {
  display: inline-block;
  padding: 0.125rem 0.25rem;
}
</style>
