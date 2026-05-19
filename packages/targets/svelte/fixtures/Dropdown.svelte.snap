<script lang="ts">
const throttledLReposition = (() => {
  let lastCall = 0;
  return (...args: any[]) => {
    const now = Date.now();
    if (now - lastCall < 100) return;
    lastCall = now;
    (reposition as (...a: any[]) => any)(...args);
  };
})();

import type { Snippet } from 'svelte';

interface Props {
  open?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  trigger?: Snippet<[{ open: any; toggle: any }]>;
  children?: Snippet<[{ close: any }]>;
  snippets?: Record<string, any>;
}

let {
  open = $bindable(false),
  closeOnOutsideClick = true,
  closeOnEscape = true,
  trigger: __triggerProp,
  children: __childrenProp,
  snippets,
}: Props = $props();

const trigger = $derived(__triggerProp ?? snippets?.trigger);
const children = $derived(__childrenProp ?? snippets?.children);

let triggerEl = $state<HTMLElement | undefined>(undefined);
let panelEl = $state<HTMLElement | undefined>(undefined);

const toggle = () => {
  open = !open;
};
const close = () => {
  open = false;
};
const reposition = () => {
  if (!panelEl || !triggerEl) return;
  const rect = triggerEl.getBoundingClientRect();
  Object.assign(panelEl.style, {
    top: `${rect.bottom}px`,
    left: `${rect.left}px`
  });
};

// Re-fire reposition() whenever the open transition flips on. The panel
// element is r-if-gated, so $refs.panelEl is undefined at mount time — $watch
// is the primitive that re-runs the effect after panel mount.

$effect(() => {
  // Initial reposition only if the panel is open at mount time.
  if (open) reposition();
});
$effect(() => {
  // Example of integrating a vanilla JS library — $refs gives direct DOM access.
  // new Popper($refs.triggerEl, $refs.panelEl, { placement: 'bottom-start' })
});

let __rozieWatchInitial_0 = true;
$effect(() => { (() => open)(); if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => {
  if (open) reposition();
})(); });

$effect(() => {
  if (!(open && closeOnOutsideClick)) return;
  const handler = ($event: MouseEvent) => {
    const target = $event.target as Node;
    if (triggerEl?.contains(target) || panelEl?.contains(target)) return;
    close();
  };
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
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

$effect(() => {
  if (!(open)) return;
  window.addEventListener('resize', throttledLReposition, { passive: true });
  return () => window.removeEventListener('resize', throttledLReposition);
});
</script>


<div class="dropdown">
  <div bind:this={triggerEl} onclick={toggle}>
    {@render trigger?.({ open, toggle })}
  </div>

  {#if open}<div bind:this={panelEl} class="dropdown-panel" role="menu">
    {@render children?.({ close })}
  </div>{/if}</div>


<style>
.dropdown { position: relative; display: inline-block; }
.dropdown-panel {
  position: fixed;
  z-index: var(--rozie-dropdown-z, 1000);
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

:global(:root) {
--rozie-dropdown-z: 1000;
}
</style>
