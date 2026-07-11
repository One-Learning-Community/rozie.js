<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  show?: boolean;
  title?: string;
  children?: Snippet<[{ title: any }]>;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  show = false,
  title = '',
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);

function noop(): void {}
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-896f7201>{#if show}{@render children?.({ title })}{/if}</div>
