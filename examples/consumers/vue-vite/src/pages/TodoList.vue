<template>
  <main class="todo-list-page">
    <h2>TodoList Demo</h2>
    <TodoListRozie v-model:items="items" :title="'My Todos'" />
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TodoListRozie from '../../../../TodoList.rozie';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

const items = ref<TodoItem[]>([
  { id: '1', text: 'Write Phase 3 plan', done: true },
  { id: '2', text: 'Implement Vue emitter', done: true },
  { id: '3', text: 'Wire unplugin', done: false },
]);
</script>

<style scoped>
.todo-list-page {
  padding: 1rem;
}
</style>
