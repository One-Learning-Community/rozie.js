<script setup>
import TreeNode from '../../examples/TreeNode.rozie';

const tree = {
  id: 'root',
  label: 'rozie',
  children: [
    { id: 'p', label: 'packages', children: [
      { id: 'p1', label: 'core', children: [] },
      { id: 'p2', label: 'unplugin', children: [] },
      { id: 'p3', label: 'targets', children: [
        { id: 'p3a', label: 'vue', children: [] },
        { id: 'p3b', label: 'react', children: [] },
        { id: 'p3c', label: 'svelte', children: [] },
        { id: 'p3d', label: 'angular', children: [] },
        { id: 'p3e', label: 'solid', children: [] },
        { id: 'p3f', label: 'lit', children: [] },
      ] },
    ] },
    { id: 'e', label: 'examples', children: [
      { id: 'e1', label: 'Counter.rozie', children: [] },
      { id: 'e2', label: 'Modal.rozie', children: [] },
      { id: 'e3', label: 'TreeNode.rozie', children: [] },
    ] },
  ],
};
</script>

# TreeNode

A minimal recursive component. Demonstrates `<components>` block self-import and the inline `<TreeNode :node="child" />` recursion inside its own `<template>`. Each target gets the idiomatic self-reference form: Vue's `defineOptions({ name })` + setup-scope import, React's hoisted named function declaration, Svelte's `import TreeNode from './TreeNode.svelte'` (with extension), Angular's `forwardRef(() => TreeNode)`, Solid's named function declaration, and Lit's self-referencing custom-element tag.

## Live demo

Three levels deep — Vue's `defineOptions({ name: 'TreeNode' })` lets the component reference itself by name inside its own `<template>`.

<div class="rozie-demo">
  <ClientOnly>
    <TreeNode :node="tree" />
  </ClientOnly>
</div>

## Source — TreeNode.rozie

```rozie-src TreeNode
```

## Compiled output

::: code-group

```rozie-out TreeNode vue
```

```rozie-out TreeNode react
```

```rozie-out TreeNode svelte
```

```rozie-out TreeNode angular
```

```rozie-out TreeNode solid
```

```rozie-out TreeNode lit
```

:::
