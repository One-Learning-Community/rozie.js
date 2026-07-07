<template>

<div class="r" v-bind="$attrs">
  <div ref="boxRef">x</div>
</div>

</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const box = ref(0);
const n = ref(0);

const boxRef = ref<HTMLElement>();

onMounted(() => {
  n.value = (boxRef.value as HTMLElement).childElementCount + box.value;
});
</script>
