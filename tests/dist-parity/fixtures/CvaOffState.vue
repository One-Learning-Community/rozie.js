<template>

<div class="cva-off-state" v-bind="$attrs">
  <input type="text" :value="value" placeholder="Type a value" @input="onInput" />
  <span class="echo">{{ value }}</span>
</div>

</template>

<script setup lang="ts">
const value = defineModel<string>('value', { default: '' });

// Producer-side write to the `value` model prop: writing `$model.value`
// lowers to each target's two-way emit (Vue `emit('update:value', …)`,
// React `onValueChange?.(…)`, Angular `valueChange.emit(…)`, etc.). This is
// the single-model shape Phase 23's CVA auto-wires the Angular accessor onto.
function onInput(e: any) {
  value.value = e.target.value;
}
</script>

<style scoped>
.cva-off-state { display: inline-flex; align-items: center; gap: 0.5rem; }
input { padding: 0.25rem 0.5rem; }
.echo { color: rgba(0, 0, 0, 0.6); }
</style>
