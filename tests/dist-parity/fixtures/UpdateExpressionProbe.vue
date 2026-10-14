<template>

<div class="probe" v-bind="$attrs">
  <button aria-label="Decrement count" @click="decCount">−</button>
  <span class="count">{{ count }}</span>
  <button aria-label="Increment count" @click="incCount">+</button>
  <button aria-label="Decrement value" @click="decValue">−</button>
  <span class="value">{{ value }}</span>
  <button aria-label="Increment value" @click="incValue">+</button>
</div>

</template>

<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'vue';

const __rozieVm = getCurrentInstance()!;
/** Whether the consumer binds a value (not `undefined`) to the two-way prop `name`. */
const __rozieBound = (name: string): boolean => {
  const raw = __rozieVm.vnode.props;
  if (!raw) return false;
  const kebab = name.replace(/\B([A-Z])/g, '-$1').toLowerCase();
  return (name in raw ? raw[name] : raw[kebab]) !== undefined;
};
const __rozieModel_value = defineModel<number>('value', { default: 0 });
const value = computed<number>({
  get: () => __rozieModel_value.value,
  set: (v) => { if (__rozieBound('value')) __rozieVm.emit('update:value', v); else __rozieModel_value.value = v; },
});

const count = ref(0);

const incCount = () => {
  count.value++;
};
const decCount = () => {
  count.value--;
};
const incValue = () => {
  value.value++;
};
const decValue = () => {
  value.value--;
};
</script>

<style scoped>
.probe { display: inline-flex; gap: 0.5rem; align-items: center; }
.count, .value { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
button { padding: 0.25rem 0.5rem; }
</style>
