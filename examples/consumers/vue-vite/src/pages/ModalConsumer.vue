<template>
  <main class="modal-consumer-page" data-testid="rozie-mount">
    <h2>ModalConsumer Demo</h2>
    <p>Dogfood: ModalConsumer.rozie composes Modal + WrapperModal with named, scoped, default, dynamic-name, and re-projected fills.</p>
    <ModalConsumerRozie :title="title" />
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ModalConsumerRozie from '../../../../ModalConsumer.rozie';

const title = ref('Confirm action');
</script>

<style scoped>
.modal-consumer-page {
  padding: 1rem;
}
</style>
