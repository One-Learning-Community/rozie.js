<template>

<div class="expose-probe" v-bind="$attrs">
  <input ref="fieldRef" type="text" v-model="value" placeholder="Type something" />
  <span class="echo">{{ value }}</span>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const value = ref('');

const fieldRef = ref<HTMLInputElement>();

function reset(): void {
  value.value = '';
}
function focus(): void {
  fieldRef.value!.focus();
}

defineExpose({ reset, focus });
</script>

<style scoped>
.expose-probe { display: inline-flex; align-items: center; gap: 0.5rem; }
input { padding: 0.25rem 0.5rem; }
.echo { font-variant-numeric: tabular-nums; color: rgba(0, 0, 0, 0.6); }
</style>
