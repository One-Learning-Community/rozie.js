<template>

<label class="toggle" v-bind="$attrs">
  
  <input type="checkbox" v-model="checked" />
  <span>Enabled</span>
</label>

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
const __rozieModel_checked = defineModel<boolean>('checked', { default: false });
const checked = computed<boolean>({
  get: () => __rozieModel_checked.value,
  set: (v) => { if (__rozieBound('checked')) __rozieVm.emit('update:checked', v); else __rozieModel_checked.value = v; },
});
</script>

<style scoped>
.toggle { display: inline-flex; gap: 0.25rem; align-items: center; }
</style>
