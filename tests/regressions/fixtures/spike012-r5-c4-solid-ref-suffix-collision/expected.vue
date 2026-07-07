<template>

<div class="r" v-bind="$attrs"><div ref="box2Ref">x</div></div>

</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const n = ref(0);

const box2Ref = ref<HTMLElement>();

const boxRef = 7;

onMounted(() => {
  n.value = (box2Ref.value as HTMLElement).childElementCount + boxRef;
});
</script>
