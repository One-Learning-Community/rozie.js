<template>
  <main class="dropdown-page">
    <h2>Dropdown Demo</h2>
    <DropdownRozie
      v-model:open="isOpen"
      :close-on-outside-click="true"
      :close-on-escape="true"
    >
      <template #trigger="">
        <!--
          The wrapping <div ref="triggerEl"> in Dropdown.rozie already has
          @click="toggle"; this slot just renders the button label and lets
          the click bubble up to the toggle handler.
        -->
        <button class="dropdown-trigger">Toggle Dropdown</button>
      </template>
      <template #default>
        <ul class="dropdown-items">
          <li>Item A</li>
          <li>Item B</li>
          <li>Item C</li>
        </ul>
      </template>
    </DropdownRozie>
    <p>Open state: {{ isOpen }}</p>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import DropdownRozie from '../../../../Dropdown.rozie';

const isOpen = ref(false);
</script>

<style scoped>
.dropdown-page {
  padding: 1rem;
}
.dropdown-items {
  list-style: none;
  padding: 0.5rem;
  margin: 0;
}
</style>
