<template>
  <main class="modal-page">
    <h2>Modal Demo</h2>
    <button @click="modalOpen = true">Open Modal</button>
    <!--
      Modal OQ4 verification anchor (D-47): Modal should work via prop binding
      ALONE, without an imperative `modalRef.value.open()` call. If this
      flow doesn't work, OQ4 fires and IRComponent.expose: ExposeDecl[] must
      be amended.
    -->
    <ModalRozie
      v-model:open="modalOpen"
      :close-on-escape="true"
      :close-on-backdrop="true"
      :title="'Hello from Modal.rozie'"
      @close="onClose"
    >
      <template #default>
        <p>Modal body content. Close via Escape, backdrop click, or the × button.</p>
      </template>
    </ModalRozie>
    <p v-if="closeCount > 0">Closed {{ closeCount }} time(s)</p>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ModalRozie from '../../../../Modal.rozie';

const modalOpen = ref(false);
const closeCount = ref(0);
const onClose = () => {
  closeCount.value++;
};
</script>

<style scoped>
.modal-page {
  padding: 1rem;
}
</style>
