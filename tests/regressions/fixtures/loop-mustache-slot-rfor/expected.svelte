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

function noop(): void {}
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-caafe4dd>{#each items as x}{@render (snippets?.[x])?.()}{/each}</div>
