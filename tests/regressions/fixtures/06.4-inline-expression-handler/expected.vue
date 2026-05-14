<template>

<div class="backdrop" @click="props.closeOnBackdrop && close()">
  
  <button @click="close">Close</button>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ closeOnBackdrop?: boolean }>(),
  { closeOnBackdrop: true }
);

const open = ref(false);

const close = () => {
  open.value = false;
};
</script>

<style scoped>
.backdrop { position: fixed; inset: 0; }
</style>
