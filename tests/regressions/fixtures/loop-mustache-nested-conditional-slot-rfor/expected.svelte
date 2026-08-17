<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  items?: any[];
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let __defaultItems = (() => [])();

let {
  items = __defaultItems,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const __rozieDynSlot0 = $derived(snippets?.[x]);

function noop(): void {}
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-bc149f2f>{#each items as x}{#if x}{@render __rozieDynSlot0?.()}{/if}{/each}</div>
