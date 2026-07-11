<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  show?: boolean;
  header?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  show = false,
  header: __headerProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const header = $derived(__headerProp ?? snippets?.header);

function noop(): void {}
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-91cab247>{#if show}{@render header?.()}{/if}</div>
