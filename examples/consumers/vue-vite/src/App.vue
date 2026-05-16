<template>
  <header class="app-header">
    <h1>Rozie Vue Demo</h1>
    <nav>
      <button
        v-for="p in pages"
        :key="p"
        :data-testid="`nav-${p}`"
        :class="{ active: current === p }"
        @click="current = p"
      >
        {{ p }}
      </button>
    </nav>
  </header>
  <component :is="pageComponents[current]" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Counter from './pages/Counter.vue';
import SearchInput from './pages/SearchInput.vue';
import Dropdown from './pages/Dropdown.vue';
import TodoList from './pages/TodoList.vue';
import Modal from './pages/Modal.vue';
import TreeNode from './pages/TreeNode.vue';
import Card from './pages/Card.vue';
import CardHeader from './pages/CardHeader.vue';
// Phase 07.2 Plan 06 — ModalConsumer dogfood page (Wave 2 close-out).
import ModalConsumer from './pages/ModalConsumer.vue';
import { litInteropRoute } from './router';

const pages = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
  'ModalConsumer',
  'lit-interop',
] as const;
type Page = typeof pages[number];

const pageComponents: Record<Page, unknown> = {
  Counter,
  SearchInput,
  Dropdown,
  TodoList,
  Modal,
  TreeNode,
  Card,
  CardHeader,
  ModalConsumer,
  'lit-interop': litInteropRoute.component,
};

const current = ref<Page>('Counter');
</script>

<style scoped>
.app-header {
  padding: 1rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-family: system-ui, sans-serif;
}
.app-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
}
nav {
  display: flex;
  gap: 0.25rem;
}
button {
  padding: 0.25rem 0.5rem;
  font: inherit;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: white;
  cursor: pointer;
  border-radius: 4px;
}
button.active {
  background: rgba(0, 100, 200, 0.1);
  border-color: rgba(0, 100, 200, 0.5);
}
</style>
