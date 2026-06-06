<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { mount, unmount } from 'svelte';
import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';
import { onMount } from 'svelte';

interface Props {
  items?: any[];
  item?: Snippet<[{ item: any }]>;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let __defaultItems = (() => [])();

let {
  items = __defaultItems,
  item: __itemProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const item = $derived(__itemProp ?? snippets?.item);

let __rozieRoot = $state<HTMLElement | undefined>(undefined);

// Tiny inline "engine" — same shape as examples/PortalList.rozie but
// with the inline-style ceremony removed. The engine now just creates
// structural DOM; cosmetic styling is the wrapper's <style> block's job.
//
// Destruction order still matters: dispose all cells BEFORE removing
// the structural container (same constraint as FullCalendar / AG-Grid).
class MiniListEngine {
  constructor(rootEl: any, opts: any) {
    this.rootEl = rootEl;
    this.items = opts.items;
    this.cellRenderer = opts.cellRenderer;
    this.disposers = [];
    this._mount();
  }
  _mount() {
    const ul = document.createElement('ul');
    for (const item of this.items as any) {
      const li = document.createElement('li');
      const cell = this.cellRenderer(item);
      li.appendChild(cell.node);
      this.disposers.push(cell.dispose);
      ul.appendChild(li);
    }
    this.rootEl.appendChild(ul);
  }
  destroy() {
    for (const dispose of this.disposers as any) dispose();
    this.disposers = [];
    while (this.rootEl.firstChild) this.rootEl.removeChild(this.rootEl.firstChild);
  }
}
let instance: any = null;

const portalInstances = new Set<Record<string, unknown>>();
const portals = {
  item: (container: HTMLElement, scope: { item: unknown }): (() => void) => {
    if (!item) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-item', '18e5aac6');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: item, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
};
$effect(() => () => {
  for (const inst of portalInstances) unmount(inst as Parameters<typeof unmount>[0]);
  portalInstances.clear();
});

onMount(() => {
  instance = new MiniListEngine(__rozieRoot!, {
    items: items,
    cellRenderer: (item: any) => {
      const node = document.createElement('div');
      const dispose = portals.item(node, {
        item
      });
      return {
        node,
        dispose
      };
    }
  });
  return () => instance?.destroy();
});
</script>

<div bind:this={__rozieRoot} {...__rozieAttrs} class={["rozie-portal-list", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-18e5aac6></div>

<style>
:global {
  .rozie-portal-list[data-rozie-s-18e5aac6] {
    display: block;
    font-family: system-ui, -apple-system, sans-serif;
  }
}

:global {
  [data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] ul {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 6px;
    overflow: hidden;
  }
  [data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] li {
    padding: 0.5rem 0.75rem;
  }
  [data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] li + li {
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }
  [data-rozie-portal-item="18e5aac6"][data-rozie-portal-item="18e5aac6"] div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
}
</style>
