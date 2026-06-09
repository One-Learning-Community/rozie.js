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

// The cycle order. A plain module constant — never reassigned.
const NEXT = {
  red: 'green',
  green: 'blue',
  blue: 'red'
};
const cycle = () => {
  color = NEXT[color];
};

// Publish the live theme. The GETTER is load-bearing (D-3 / REQ-29): reading
// `theme.color` at depth always reflects the current reactive `$data.color`,
// so clicking through `cycle()` cycles the displayed color at depth (the
// reactive round-trip). Snapshotting the primitive here (`{ color: $data.color }`)
// would freeze it at provide-time and kill the round-trip.

setContext('theme', {
  get color() {
    return color;
  },
  cycle
});
</script>

<div data-theme-provider="" {...__rozieAttrs} class={["theme-provider", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-00821bac>{@render children?.()}</div>

<style>
:global {
  .theme-provider[data-rozie-s-00821bac] {
    display: block;
  }
}
</style>
