<script lang="ts">
import { applyListeners, rozieAttr } from '@rozie/runtime-svelte';

import { getContext } from 'svelte';

interface Props {
  label?: string;
  [key: string]: unknown;
}

let { label = '', ...__rozieAttrs }: Props = $props();

const tabs = getContext('tabs');

// Claim a stable index at setup time. Guarded for the Lit async edge — if the
// context has not resolved yet, fall back to 0 (it re-resolves on connect).
const myIndex = tabs ? tabs.register() : 0;
</script>

<button data-tab="" type="button" role="tab" data-active={rozieAttr(tabs && tabs.active === myIndex)} {...__rozieAttrs} class={["tab", { 'is-active': tabs && tabs.active === myIndex }, (__rozieAttrs)?.class]} onclick={($event) => { tabs && tabs.setActive(myIndex); }} use:applyListeners={__rozieAttrs} data-rozie-s-18645a16>{label}</button>

<style>
:global {
  .tab[data-rozie-s-18645a16] {
    font-family: system-ui, -apple-system, sans-serif;
    padding: 0.375rem 0.75rem;
    border: 1px solid rgba(0, 0, 0, 0.3);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .tab.is-active[data-rozie-s-18645a16] {
    background: #2563eb;
    color: #fff;
    border-color: #2563eb;
  }
}
</style>
