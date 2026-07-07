<template>

<div class="red" v-bind="$attrs">
  <div ref="saveRef">x</div>
  <button @click="go()">go</button>
</div>

</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const emit = defineEmits<{
  save: [...args: any[]];
}>();

const n = ref(0);

const saveRef = ref<HTMLElement>();

function go(): void {
  emit('save', n.value);
}

onMounted(() => {
  void (saveRef.value as HTMLElement);
});
</script>
