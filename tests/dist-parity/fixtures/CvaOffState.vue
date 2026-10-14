<template>

<div class="cva-off-state" v-bind="$attrs">
  <input type="text" :value="value" placeholder="Type a value" @input="onInput" />
  <span class="echo">{{ value }}</span>
</div>

</template>

<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue';

const __rozieVm = getCurrentInstance()!;
/** Whether the consumer binds a value (not `undefined`) to the two-way prop `name`. */
const __rozieBound = (name: string): boolean => {
  const raw = __rozieVm.vnode.props;
  if (!raw) return false;
  const kebab = name.replace(/\B([A-Z])/g, '-$1').toLowerCase();
  return (name in raw ? raw[name] : raw[kebab]) !== undefined;
};
const __rozieModel_value = defineModel<string>('value', { default: '' });
const value = computed<string>({
  get: () => __rozieModel_value.value,
  set: (v) => { if (__rozieBound('value')) __rozieVm.emit('update:value', v); else __rozieModel_value.value = v; },
});

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
