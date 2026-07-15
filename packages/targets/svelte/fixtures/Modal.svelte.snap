<script lang="ts">
import { rozieAttr } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onMount, untrack } from 'svelte';

interface Props {
  open?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  lockBodyScroll?: boolean;
  title?: string;
  header?: Snippet<[{ close: any }]>;
  children?: Snippet<[{ close: any }]>;
  footer?: Snippet<[{ close: any }]>;
  snippets?: Record<string, any>;
  onclose?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let {
  open = $bindable(false),
  closeOnEscape = true,
  closeOnBackdrop = true,
  lockBodyScroll = true,
  title = '',
  header: __headerProp,
  children: __childrenProp,
  footer: __footerProp,
  snippets,
  onclose,
  ...__rozieAttrs
}: Props = $props();

const header = $derived(__headerProp ?? snippets?.header);
const children = $derived(__childrenProp ?? snippets?.children);
const footer = $derived(__footerProp ?? snippets?.footer);

let backdropEl = $state<HTMLElement | undefined>(undefined);
let dialogEl = $state<HTMLElement | undefined>(undefined);

const close = () => {
  open = false;
  onclose?.();
};
// Body-scroll-lock state lives outside reactive data because it tracks DOM
// rather than UI; managed entirely via lifecycle and listeners.
let savedBodyOverflow = '';
const lockScroll = () => {
  if (!lockBodyScroll || !open) return;
  savedBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
};
const unlockScroll = () => {
  if (!lockBodyScroll) return;
  document.body.style.overflow = savedBodyOverflow;
};

// $watch re-fires on every `open` toggle — the cross-target primitive for
// reacting to a prop change. The $onMount/$onUnmount pair anchors the
// unmount-time restore; $onMount runs exactly once on every target (a
// guarded no-op here) and must not be relied on to re-fire.

onMount(() => {
  lockScroll();
  return () => unlockScroll();
});
onMount(() => {
  dialogEl?.focus();
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => open)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
  if (isOpen) lockScroll();else unlockScroll();
})(__watchVal); }); });

$effect(() => {
  if (!(open && closeOnEscape)) return;
  const handler = ($event: KeyboardEvent) => {
    if ($event.key !== 'Escape') return;
    close();
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
});
</script>

{#if open}<div class="modal-backdrop" bind:this={backdropEl} onclick={($event) => { if ($event.target !== $event.currentTarget) return; closeOnBackdrop && close(); }} data-rozie-s-fc45feb2><div bind:this={dialogEl} class="modal-dialog" role="dialog" aria-modal="true" aria-label={rozieAttr(title || undefined)} tabindex="-1" data-rozie-s-fc45feb2>{#if title || header}<header data-rozie-s-fc45feb2>{#if header}{@render header({ close })}{:else}<h2 data-rozie-s-fc45feb2>{title}</h2>{/if}<button class="close-btn" aria-label="Close" onclick={close} data-rozie-s-fc45feb2>×</button></header>{/if}<div class="modal-body" data-rozie-s-fc45feb2>{@render children?.({ close })}</div>{#if footer}<footer data-rozie-s-fc45feb2>{#if footer}{@render footer({ close })}{/if}</footer>{/if}</div></div>{/if}

<style>
:global {
  .modal-backdrop[data-rozie-s-fc45feb2] {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex; align-items: center; justify-content: center;
    z-index: var(--rozie-modal-z, 2000);
  }
  .modal-dialog[data-rozie-s-fc45feb2] {
    background: white;
    border-radius: 8px;
    min-width: 20rem;
    max-width: min(90vw, 40rem);
    max-height: 90vh;
    display: flex; flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    outline: none;
  }
  header[data-rozie-s-fc45feb2], footer[data-rozie-s-fc45feb2] { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; }
  header[data-rozie-s-fc45feb2] { border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
  header[data-rozie-s-fc45feb2] h2[data-rozie-s-fc45feb2] { flex: 1; margin: 0; font-size: 1.1rem; }
  footer[data-rozie-s-fc45feb2] { border-top: 1px solid rgba(0, 0, 0, 0.08); justify-content: flex-end; }
  .modal-body[data-rozie-s-fc45feb2] { padding: 1rem; overflow: auto; }
  .close-btn[data-rozie-s-fc45feb2] { background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1; }
}

:global(:root) {
--rozie-modal-z: 2000;
}
</style>
