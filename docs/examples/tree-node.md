# TreeNode

A minimal recursive component. Demonstrates `<components>` block self-import and the inline `<TreeNode :node="child" />` recursion inside its own `<template>`. Each target gets the idiomatic self-reference form: Vue's `defineOptions({ name })` + setup-scope import, React's hoisted named function declaration, Svelte's `import TreeNode from './TreeNode.svelte'` (with extension), Angular's `forwardRef(() => TreeNode)`, Solid's named function declaration.

## Source — TreeNode.rozie

```rozie
<rozie name="TreeNode">

<components>
{
  TreeNode: './TreeNode.rozie',
}
</components>

<props>
{
  node: { type: Object, default: () => ({ id: '', label: '', children: [] }) },
}
</props>

<template>
<div class="tree-node">
  <span class="tree-node__label">{{ $props.node.label }}</span>
  <ul r-if="$props.node.children && $props.node.children.length > 0" class="tree-node__children">
    <li r-for="child in $props.node.children" :key="child.id">
      <TreeNode :node="child" />
    </li>
  </ul>
</div>
</template>

<style>
.tree-node { font-family: system-ui; padding-left: 0.5rem; }
.tree-node__label { display: inline-block; }
.tree-node__children { list-style: none; margin: 0.25rem 0 0 0; padding-left: 1rem; border-left: 1px dashed currentColor; }
</style>

</rozie>
```

## Vue output

```vue
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
```

## React output

```tsx
import styles from './TreeNode.module.css';

interface TreeNodeProps {
  node?: Record<string, unknown>;
}

export default function TreeNode(_props: TreeNodeProps): JSX.Element {
  const props: TreeNodeProps = {
    ..._props,
    node: _props.node ?? (() => ({
    id: '',
    label: '',
    children: []
  }))(),
  };

  return (
    <>
    <div className={styles["tree-node"]}>
      <span className={styles["tree-node__label"]}>{props.node.label}</span>
      {(props.node.children && props.node.children.length > 0) && <ul className={styles["tree-node__children"]}>
        {props.node.children.map((child) => <li key={child.id}>
          <TreeNode node={child} />
        </li>)}
      </ul>}</div>
    </>
  );
}
```

## Svelte output

```svelte
<script lang="ts">
import TreeNode from './TreeNode.svelte';

interface Props {
  node?: unknown;
}

let { node = () => ({
  id: '',
  label: '',
  children: []
}) }: Props = $props();
</script>


<div class="tree-node">
  <span class="tree-node__label">{node.label}</span>
  {#if node.children && node.children.length > 0}<ul class="tree-node__children">
    {#each node.children as child (child.id)}<li>
      <TreeNode node={child}></TreeNode>
    </li>{/each}
  </ul>{/if}</div>


<style>
.tree-node { font-family: system-ui; padding-left: 0.5rem; }
.tree-node__label { display: inline-block; }
.tree-node__children { list-style: none; margin: 0.25rem 0 0 0; padding-left: 1rem; border-left: 1px dashed currentColor; }
</style>
```

## Angular output

```ts
import { Component, ViewEncapsulation, forwardRef, input } from '@angular/core';

@Component({
  selector: 'rozie-tree-node',
  standalone: true,
  imports: [forwardRef(() => TreeNode)],
  template: `

    <div class="tree-node">
      <span class="tree-node__label">{{ node().label }}</span>
      @if (node().children && node().children.length > 0) {
    <ul class="tree-node__children">
        @for (child of node().children; track child.id) {
    <li>
          <rozie-tree-node [node]="child"></rozie-tree-node>
        </li>
    }
      </ul>
    }</div>

  `,
  styles: [`
    .tree-node { font-family: system-ui; padding-left: 0.5rem; }
    .tree-node__label { display: inline-block; }
    .tree-node__children { list-style: none; margin: 0.25rem 0 0 0; padding-left: 1rem; border-left: 1px dashed currentColor; }
  `],
})
export class TreeNode {
  node = input<Record<string, unknown>>((() => ({
    id: '',
    label: '',
    children: []
  }))());
}

export default TreeNode;
```

## Solid output

```tsx
import type { JSX } from 'solid-js';
import { For, Show, splitProps } from 'solid-js';

interface TreeNodeProps {
  node?: Record<string, any>;
}

export default function TreeNode(_props: TreeNodeProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['node']);

  return (
    <>
    <style>{`.tree-node { font-family: system-ui; padding-left: 0.5rem; }
    .tree-node__label { display: inline-block; }
    .tree-node__children { list-style: none; margin: 0.25rem 0 0 0; padding-left: 1rem; border-left: 1px dashed currentColor; }`}</style>
    <>
    <div class={"tree-node"}>
      <span class={"tree-node__label"}>{local.node.label}</span>
      {<Show when={local.node.children && local.node.children.length > 0}><ul class={"tree-node__children"}>
        <For each={local.node.children}>{(child) => <li>
          <TreeNode node={child} />
        </li>}</For>
      </ul></Show>}</div>
    </>
    </>
  );
}
```
