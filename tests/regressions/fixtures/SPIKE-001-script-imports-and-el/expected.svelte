<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  children?: Snippet;
  snippets?: Record<string, any>;
}

let { children: __childrenProp, snippets }: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);

let __rozieRoot = $state<HTMLElement | undefined>(undefined);

import DummyEngine from 'dummy-engine';
let instance = null;

$effect(() => {
  instance = new DummyEngine(__rozieRoot, {
    animation: 150
  });
  return () => instance?.destroy();
});
</script>


<div class="spike-root" bind:this={__rozieRoot}>
  {@render children?.()}
</div>

