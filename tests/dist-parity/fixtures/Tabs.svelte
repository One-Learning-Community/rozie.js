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

let active = $state(0);

// NOTE: this helper is intentionally NOT named `setActive` — React
// auto-generates a `setActive` setter for the `$data.active` state field, and a
// same-named user function collides with it (ROZ524: "already declared" +
// infinite recursion when `$data.active = v` rewrites to `setActive(v)`). The
// PROVIDED key is still `setActive` (the consumer-facing API); only the local
// implementation name differs.
const selectActive = (index: any) => {
  active = index;
};

// Publish the active-index API. `get active()` keeps the read live (D-3 /
// REQ-29) so every injected Tab updates when the active selection changes —
// no prop is passed between Tabs and any Tab. The Tab children supply their
// own stable index explicitly (see Tab.rozie's `index` prop).

setContext('tabs', {
  get active() {
    return active;
  },
  setActive: selectActive
});
</script>

<div data-tabs="" role="tablist" {...__rozieAttrs} class={["tabs", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-97e2d32a>{@render children?.()}</div>

<style>
:global {
  .tabs[data-rozie-s-97e2d32a] {
    display: flex;
    gap: 0.25rem;
    font-family: system-ui, -apple-system, sans-serif;
  }
}
</style>
