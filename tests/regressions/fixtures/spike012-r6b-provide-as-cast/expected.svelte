<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { setContext } from 'svelte';

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

let color = $state('red');

setContext('theme', {
  get color(): string {
    return color;
  }
});
</script>

<div {...__rozieAttrs} class={["r", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-bf70abc5>{@render children?.()}</div>
