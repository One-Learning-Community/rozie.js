<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onMount } from 'svelte';

interface Props {
  header?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  header: __headerProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const header$$slot = $derived(__headerProp ?? snippets?.header);

let chrome = $state('unset');

// REG-73.1-001 — mirrors the real rete FlowCanvas `renderNode(element,
// reteNode)` workaround: a helper NESTED inside $onMount, `chromeLabel(element,
// header)`, whose second param shadows the `#header` slot. `$slots.header`
// inside the helper's own body must resolve to the true slot-presence merge,
// NOT the shadowed local param — else the presence check always reads truthy
// (the param is always truthy here) and silently drops the default-chrome
// fallback. Svelte-only bug (the other 5 targets keep script-scope and slot
// invocation in distinct namespaces).
function chromeLabel(element: any, header: any) {
  return header$$slot ? 'CUSTOM' : 'DEFAULT';
}

onMount(() => {
  chrome = chromeLabel(null, true);
});
</script>

<div {...__rozieAttrs} use:applyListeners={__rozieAttrs} data-rozie-s-17e8129a><span class="chrome" data-rozie-s-17e8129a>{chrome}</span>{#if header$$slot}{@render header$$slot()}{:else}fallback-header{/if}</div>
