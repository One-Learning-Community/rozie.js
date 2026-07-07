<template>

<div class="r" v-bind="$attrs">
  <button @click="throttledHandler0">go</button>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';
import { throttle } from '@rozie/runtime-vue';

const n = ref(0);

function noop(): void {}

const throttledHandler0 = throttle(($event: any) => { n.value = 5; }, 200);
</script>
