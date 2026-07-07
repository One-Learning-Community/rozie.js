<template>

<div class="fpg" v-bind="$attrs">
  <button class="save" @click="props.onSave">save</button>
  <button class="cancel" @click="props.onCancel && props.onCancel()">cancel</button>
  <span class="n">{{ n }}</span>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ onSave?: ((...args: any[]) => any); onCancel?: ((...args: any[]) => any) | null }>(),
  { onSave: () => {}, onCancel: null }
);

const n = ref(0);
</script>
