<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  mode?: number;
  children?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  mode = 0,
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);

function noop(): void {}
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-da247b87>{#if mode === 0}<span data-rozie-s-da247b87>zero</span>{:else if mode === 1}{@render children?.()}{:else}<span data-rozie-s-da247b87>other</span>{/if}</div>
