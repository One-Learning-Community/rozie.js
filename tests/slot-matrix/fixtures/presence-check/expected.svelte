<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  aside?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  aside: __asideProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const aside = $derived(__asideProp ?? snippets?.aside);
</script>

<div {...__rozieAttrs} class={["presence-check-fixture", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-313bf282>{#if aside}<aside data-rozie-s-313bf282>{#if aside}{@render aside()}{/if}</aside>{/if}</div>
