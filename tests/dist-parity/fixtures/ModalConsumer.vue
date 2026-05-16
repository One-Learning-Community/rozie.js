<template>

<div class="modal-consumer">
  <Modal :open="open"><template #header="{ close }">
      <h2>{{ props.title }}</h2>
      <button class="close" @click="close">×</button>
    </template><template #footer="{ close }">
      <button @click="close">Cancel</button>
      <button @click="onConfirm()">OK</button>
    </template>
    Are you sure you want to proceed?
    </Modal>

  <Modal :open="open"><template #[slotName]>
      <span class="dynamic-fill">Dynamic header via slotName</span>
    </template>
    Dynamic-name demo body
  </Modal>

  <WrapperModal :title="props.title"><template #title>
      <h2>Re-projected title</h2>
    </template><template #actions>
      <button>Wrapper action</button>
    </template>
    Body via wrapper's default slot
    </WrapperModal>
</div>

</template>

<script setup lang="ts">
import Modal from './Modal.vue';
import WrapperModal from './WrapperModal.vue';

import { ref } from 'vue';

const props = withDefaults(
  defineProps<{ title?: string }>(),
  { title: 'Confirm' }
);

const open = ref(true);
const slotName = ref('header');

function onConfirm() {
  open.value = false;
}
</script>

<style scoped>
.modal-consumer { display: flex; flex-direction: column; gap: 1rem; }
.close { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
.dynamic-fill { font-weight: bold; }
</style>
