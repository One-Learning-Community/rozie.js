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

const props = withDefaults(
  defineProps<{ title?: string }>(),
  { title: 'Wrapped' }
);

const open = defineModel<boolean>('open', { default: false });

defineSlots<{
  brand(props: {  }): any;
  default(props: {  }): any;
  actions(props: {  }): any;
}>();
</script>
