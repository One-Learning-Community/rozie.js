<template>

<div class="r" v-bind="$attrs">
  <button @click="q = n > 0 ? 'a' : 'b'">go</button>
  <input @input="debouncedHandler0" />
</div>

</template>

<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'vue';
import { debounce } from '@rozie/runtime-vue';

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

const n = ref(0);
const q = ref('');

function noop(): void {}

const debouncedHandler0 = debounce(($event: any) => { value.value = ($event.currentTarget as HTMLInputElement).value; }, 300);
</script>
