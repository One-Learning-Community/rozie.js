<script lang="ts">
import BareAttrChild from './BareAttrChild.svelte';
import { applyListeners } from '@rozie/runtime-svelte';

interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['div'], 'children'> {}

let { ...__rozieAttrs }: Props = $props();
</script>

<div {...__rozieAttrs} class={["bare-attr-component", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-81da069c><BareAttrChild combobox={true} data-rozie-s-81da069c></BareAttrChild><div hidden data-rozie-s-81da069c></div></div>
