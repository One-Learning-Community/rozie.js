<template>

<ul class="list" v-bind="$attrs">
  
  <li v-for="item in items" :key="item.id">
    <slot name="item" :item="item" :remaining="remaining">
      {{ item.label }}
    </slot>
  </li>
</ul>

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
const __rozieModel_items = defineModel<any[]>('items', { default: () => [] });
const items = computed<any[]>({
  get: () => __rozieModel_items.value,
  set: (v) => { if (__rozieBound('items')) __rozieVm.emit('update:items', v); else __rozieModel_items.value = v; },
});

defineSlots<{
  item(props: { item: any; remaining: any }): any;
}>();

const remaining = computed(() => items.value.filter((i: any) => !i.done).length);
</script>

<style scoped>
.list { list-style: none; padding: 0; }
</style>
