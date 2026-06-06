<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onMount } from 'svelte';

interface Props {
  children?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);

let __rozieRoot = $state<HTMLElement | undefined>(undefined);

import DummyEngine from 'dummy-engine';
let instance: any = null;

onMount(() => {
  instance = new DummyEngine(__rozieRoot!, {
    animation: 150
  });
  return () => instance?.destroy();
});
</script>

<div bind:this={__rozieRoot} {...__rozieAttrs} class={["spike-root", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-f590f443>{@render children?.()}</div>
