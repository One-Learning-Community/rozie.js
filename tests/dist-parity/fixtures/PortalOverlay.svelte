<script lang="ts">
import { roziePortal } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  open?: boolean;
  to?: boolean | string;
  children?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  open = false,
  to = false,
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);

function resolveTo(to: any) {
  if (!to) return null;
  if (typeof document === 'undefined') return null;
  if (to === true || to === 'body') return document.body;
  return document.querySelector(to);
}
</script>

{#if open}<div class="rozie-portal-overlay-backdrop" use:roziePortal={resolveTo(to)} data-rozie-s-56b9c1c8><div class="rozie-portal-overlay-box" data-rozie-s-56b9c1c8>{#if children}{@render children()}{:else}Portalled content{/if}</div></div>{/if}

<style>
:global {
  .rozie-portal-overlay-backdrop[data-rozie-s-56b9c1c8] {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    z-index: var(--rozie-portal-overlay-z, 3000);
  }
  .rozie-portal-overlay-box[data-rozie-s-56b9c1c8] {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    min-width: 16rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }
}

:global(:root) {
--rozie-portal-overlay-z: 3000;
}
</style>
