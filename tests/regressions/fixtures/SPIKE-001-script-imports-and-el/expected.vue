<template>

<div class="spike-root" ref="__rozieRootRef">
  <slot></slot>
</div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

defineSlots<{
  default(props: {  }): any;
}>();

const __rozieRootRef = ref<HTMLElement>();

import DummyEngine from 'dummy-engine';
let instance = null;

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  instance = new DummyEngine(__rozieRootRef.value, {
    animation: 150
  });
  _cleanup_0 = () => instance?.destroy();
});
onBeforeUnmount(() => { _cleanup_0?.(); });
</script>
