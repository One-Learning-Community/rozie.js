<template>

<div class="modal-consumer">
  <Modal v-model:open="open1"><template #header="{ close }">
      <h2>{{ props.title }}</h2>
      <button class="close" @click="close">×</button>
    </template><template #footer="{ close }">
      <button @click="close">Cancel</button>
      <button @click="onConfirm()">OK</button>
    </template>
    Are you sure you want to proceed?
    </Modal>

  <Modal v-model:open="open2"><template #[slotName]>
      <span class="dynamic-fill">Dynamic header via slotName</span>
    </template>
    Dynamic-name demo body
  </Modal>

  <WrapperModal v-model:open="open3" :title="props.title"><template #brand>
      <h2>Re-projected brand</h2>
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

const open1 = ref(true);
const open2 = ref(true);
const open3 = ref(true);
const slotName = ref('header');

function onConfirm() {
  open1.value = false;
}
</script>

<style scoped>
.modal-consumer { display: flex; flex-direction: column; gap: 1rem; }
.close { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
.dynamic-fill { font-weight: bold; }
</style>
