<template>

<div class="tree-node">
  <span class="tree-node__label">{{ props.node.label }}</span>
  <ul v-if="props.node.children && props.node.children.length > 0" class="tree-node__children">
    <li v-for="child in props.node.children" :key="child.id">
      <TreeNode :node="child"></TreeNode>
    </li>
  </ul></div>

</template>

<script setup lang="ts">
import TreeNode from './TreeNode.vue';
defineOptions({ name: 'TreeNode' });

const props = withDefaults(
  defineProps<{ node?: unknown }>(),
  { node: () => ({
  id: '',
  label: '',
  children: []
}) }
);
</script>

<style scoped>
.tree-node { font-family: system-ui; padding-left: 0.5rem; }
.tree-node__label { display: inline-block; }
.tree-node__children { list-style: none; margin: 0.25rem 0 0 0; padding-left: 1rem; border-left: 1px dashed currentColor; }
</style>
