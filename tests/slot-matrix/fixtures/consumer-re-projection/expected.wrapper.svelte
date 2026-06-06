<script lang="ts">
import Inner from './inner.svelte';

import type { Snippet } from 'svelte';

interface Props {
  title?: Snippet;
  children?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  title: __titleProp,
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const title = $derived(__titleProp ?? snippets?.title);
const children = $derived(__childrenProp ?? snippets?.children);
</script>

<Inner data-rozie-s-ac96baae>{#snippet header()}{#if title}{@render title()}{:else}default title{/if}{/snippet}{#if children}{@render children()}{:else}default body{/if}</Inner>
