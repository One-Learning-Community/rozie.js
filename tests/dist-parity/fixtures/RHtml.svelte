<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['div'], 'content' | 'children'> {
  content?: string;
}

let { content = '<strong>safe</strong>', ...__rozieAttrs }: Props = $props();
</script>

<div {...__rozieAttrs} class={["rhtml", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-09a5f2a6>{@html content}</div>

<style>
:global {
  .rhtml[data-rozie-s-09a5f2a6] { font: 1rem/1.4 system-ui; }
}
</style>
