<template>

<Modal v-model:open="open" :title="props.title"><template #header>
    <slot name="brand">
      <h2>{{ props.title }}</h2>
    </slot>
  </template><template #footer>
    <slot name="actions"></slot>
  </template><slot></slot></Modal>

</template>

<script setup lang="ts">
import Modal from './Modal.vue';

import { computed, getCurrentInstance } from 'vue';

const props = withDefaults(
  defineProps<{ title?: string }>(),
  { title: 'Wrapped' }
);

const __rozieVm = getCurrentInstance()!;
/** Whether the consumer binds a value (not `undefined`) to the two-way prop `name`. */
const __rozieBound = (name: string): boolean => {
  const raw = __rozieVm.vnode.props;
  if (!raw) return false;
  const kebab = name.replace(/\B([A-Z])/g, '-$1').toLowerCase();
  return (name in raw ? raw[name] : raw[kebab]) !== undefined;
};
const __rozieModel_open = defineModel<boolean>('open', { default: false });
const open = computed<boolean>({
  get: () => __rozieModel_open.value,
  set: (v) => { if (__rozieBound('open')) __rozieVm.emit('update:open', v); else __rozieModel_open.value = v; },
});

defineSlots<{
  brand(props: {  }): any;
  default(props: {  }): any;
  actions(props: {  }): any;
}>();
</script>
