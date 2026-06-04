<script lang="ts">
import TreeNode from './TreeNode.svelte';
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  node?: any;
  [key: string]: unknown;
}

let __defaultNode = (() => ({
  id: '',
  label: '',
  children: []
}))();

let { node = __defaultNode, ...__rozieAttrs }: Props = $props();
</script>


<div {...__rozieAttrs} class={["tree-node", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-a7176a6e>
  <span class="tree-node__label" data-rozie-s-a7176a6e>{rozieDisplay(node.label)}</span>
  {#if node.children && node.children.length > 0}<ul class="tree-node__children" data-rozie-s-a7176a6e>
    {#each node.children as child, childIndex (child.id)}<li data-index={rozieDisplay(childIndex)} data-rozie-s-a7176a6e>
      <TreeNode node={child} data-rozie-s-a7176a6e></TreeNode>
    </li>{/each}
  </ul>{/if}</div>


<style>
:global {
  .tree-node[data-rozie-s-a7176a6e] { font-family: system-ui; padding-left: 0.5rem; }
  .tree-node__label[data-rozie-s-a7176a6e] { display: inline-block; }
  .tree-node__children[data-rozie-s-a7176a6e] { list-style: none; margin: 0.25rem 0 0 0; padding-left: 1rem; border-left: 1px dashed currentColor; }
}
</style>
