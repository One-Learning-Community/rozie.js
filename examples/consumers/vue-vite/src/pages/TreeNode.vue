<template>
  <main class="tree-node-page">
    <h2>TreeNode Demo</h2>
    <p>Recursive component composition (D-119) — TreeNode renders itself for each child.</p>
    <TreeNodeRozie :node="root" />
  </main>
</template>

<script setup lang="ts">
import TreeNodeRozie from '../../../../TreeNode.rozie';

const root = {
  id: 'r',
  label: 'root',
  children: [
    {
      id: 'a',
      label: 'alpha',
      children: [
        { id: 'a1', label: 'alpha-1', children: [] },
        { id: 'a2', label: 'alpha-2', children: [] },
      ],
    },
    {
      id: 'b',
      label: 'beta',
      children: [{ id: 'b1', label: 'beta-1', children: [] }],
    },
  ],
};
</script>

<style scoped>
.tree-node-page {
  padding: 1rem;
}
</style>
