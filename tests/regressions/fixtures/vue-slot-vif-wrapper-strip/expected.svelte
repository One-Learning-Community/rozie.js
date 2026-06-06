<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  title?: string;
  header?: Snippet;
  children?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  title = '',
  header: __headerProp,
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const header = $derived(__headerProp ?? snippets?.header);
const children = $derived(__childrenProp ?? snippets?.children);
</script>

<section {...__rozieAttrs} class={["panel", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-224e77e7>{#if header || title}<header data-rozie-s-224e77e7>{#if header}{@render header()}{:else}{title}{/if}</header>{/if}<div class="body" data-rozie-s-224e77e7>{@render children?.()}</div></section>

<style>
:global {
  .panel[data-rozie-s-224e77e7] { border: 1px solid rgba(0, 0, 0, 0.1); }
}
</style>
