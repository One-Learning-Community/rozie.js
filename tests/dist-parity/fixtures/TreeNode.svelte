<script lang="ts">
import TreeNode from './TreeNode.svelte';
import { applyListeners } from '@rozie/runtime-svelte';

interface Props {
  node?: any;
  [key: string]: unknown;
}

let { node = (() => ({
  id: '',
  label: '',
  children: []
}))(), ...__rozieAttrs }: Props = $props();
</script>


<div {...__rozieAttrs} class={["tree-node", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs}>
  <span class="tree-node__label">{node.label}</span>
  {#if node.children && node.children.length > 0}<ul class="tree-node__children">
    {#each node.children as child, childIndex (child.id)}<li data-index={childIndex}>
      <TreeNode node={child}></TreeNode>
    </li>{/each}
  </ul>{/if}</div>


<style>
.tree-node { font-family: system-ui; padding-left: 0.5rem; }
.tree-node__label { display: inline-block; }
.tree-node__children { list-style: none; margin: 0.25rem 0 0 0; padding-left: 1rem; border-left: 1px dashed currentColor; }
</style>
