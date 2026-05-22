<script lang="ts">
import type { Snippet } from 'svelte';
import { onMount } from 'svelte';

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
// Body-scroll-lock state lives outside reactive data because it tracks DOM
// rather than UI; managed entirely via lifecycle and listeners.
let savedBodyOverflow = '';
const lockScroll = () => {
  if (!lockBodyScroll) return;
  savedBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
};
const unlockScroll = () => {
  if (!lockBodyScroll) return;
  document.body.style.overflow = savedBodyOverflow;
};

// Colocated lifecycle pair — runs in source order alongside other hooks.

onMount(() => {
  lockScroll();
  return () => unlockScroll();
});
onMount(() => {
  dialogEl?.focus();
});

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


{#if open}<div class="modal-backdrop" bind:this={backdropEl} onclick={($event) => { if ($event.target !== $event.currentTarget) return; closeOnBackdrop && close(); }}>
  <div bind:this={dialogEl} class="modal-dialog" role="dialog" aria-modal="true" aria-label={title || undefined} tabindex="-1">
    {#if title || header}<header>
      {#if header}{@render header({ close })}{:else}
        <h2>{title}</h2>
      {/if}
      <button class="close-btn" aria-label="Close" onclick={close}>×</button>
    </header>{/if}<div class="modal-body">
      {@render children?.({ close })}
    </div>

    {#if footer}<footer>
      {#if footer}{@render footer({ close })}{/if}
    </footer>{/if}</div>
</div>{/if}

<style>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: var(--rozie-modal-z, 2000);
}
.modal-dialog {
  background: white;
  border-radius: 8px;
  min-width: 20rem;
  max-width: min(90vw, 40rem);
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  outline: none;
}
header, footer { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; }
header { border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
header h2 { flex: 1; margin: 0; font-size: 1.1rem; }
footer { border-top: 1px solid rgba(0, 0, 0, 0.08); justify-content: flex-end; }
.modal-body { padding: 1rem; overflow: auto; }
.close-btn { background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1; }

:global(:root) {
--rozie-modal-z: 2000;
}
</style>
