<template>
<!-- empty template -->
</template>

<script setup lang="ts" generic="T">
import { computed, getCurrentInstance } from 'vue';

interface SelectProps<T> { items?: any[] }
const props = defineProps<SelectProps<T>>();

const __rozieVm = getCurrentInstance()!;
/** Whether the consumer binds a value (not `undefined`) to the two-way prop `name`. */
const __rozieBound = (name: string): boolean => {
  const raw = __rozieVm.vnode.props;
  if (!raw) return false;
  const kebab = name.replace(/\B([A-Z])/g, '-$1').toLowerCase();
  return (name in raw ? raw[name] : raw[kebab]) !== undefined;
};
const __rozieModel_selected = defineModel<T>('selected');
const selected = computed<T | undefined>({
  get: () => __rozieModel_selected.value,
  set: (v) => { if (__rozieBound('selected')) __rozieVm.emit('update:selected', v); else __rozieModel_selected.value = v; },
});
</script>
