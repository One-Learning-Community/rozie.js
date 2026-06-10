<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { getContext, onMount, setContext, untrack } from 'svelte';

interface Props {
  id: string;
  x?: number;
  y?: number;
  label?: unknown;
  children?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  id,
  x = 0,
  y = 0,
  label = undefined,
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);

let __rozieRoot = $state<HTMLElement | undefined>(undefined);

const canvas = getContext('rete:canvas');

// $inject is typed `unknown` (Phase 36 D-4: no rich type synthesis yet), which the
// STRICT BUNDLED-LEAF tsc rejects on `.register(...)` (TS2339). The .rozie-native
// fix is the null-let → `any` typeNeutralize idiom: alias the injected API through
// a MODULE-SCOPE `let cv = null` (typeNeutralize types it `any`). Module-scope (not
// hook-local) so the alias is in scope from the Solid teardown — which the Solid
// emitter hoists into a sibling onCleanup() OUTSIDE the mount closure (the MapLibre
// Source/Layer lesson). ZERO emitter change.
let cv: any = null;
cv = canvas;

// The FlowNode's own host element, captured at mount ($el only safe in $onMount,
// ROZ123). The parent-invoked renderBody closure appends THIS into the engine
// `body` host — moving the host preserves Lit shadow projection of the slot body.
// Module-scope `any` so it survives into the parent's later render-scope call.
// The FlowNode's own host element, captured at mount ($el only safe in $onMount,
// ROZ123). The parent-invoked renderBody closure appends THIS into the engine
// `body` host — moving the host preserves Lit shadow projection of the slot body.
// Module-scope `any` so it survives into the parent's later render-scope call.
let hostEl: any = null;

setContext('rete:node', {
  get id() {
    return id;
  },
  addPort: (side: any, key: any, label: any, multiple: any) => {
    if (cv) cv.addPort(id, side, key, label, multiple);
  }
});

onMount(() => {
  hostEl = __rozieRoot;
  // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
  // builds the engine node, then renderNode invokes renderBody(body) — projecting
  // this FlowNode's body into the engine element from the PARENT's render scope.
  if (cv) {
    cv.register(id, {
      id: id,
      x: x,
      y: y,
      label: label,
      inputs: [],
      outputs: [],
      // D-04 render-callback: the parent calls this with the engine body host div.
      renderBody: (host: any) => {
        if (host && hostEl) host.appendChild(hostEl);
      }
    });
  }
  return () => {
    if (cv) cv.unregister(id);
  };
});

let __rozieWatchInitial_0 = true;
$effect(() => { (() => x)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => {
  if (cv) cv.update(id, {
    id: id,
    x: x,
    y: y,
    label: label,
    renderBody: (host: any) => {
      if (host && hostEl) host.appendChild(hostEl);
    }
  });
})(); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { (() => y)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } (() => {
  if (cv) cv.update(id, {
    id: id,
    x: x,
    y: y,
    label: label,
    renderBody: (host: any) => {
      if (host && hostEl) host.appendChild(hostEl);
    }
  });
})(); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { (() => label)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } (() => {
  if (cv) cv.update(id, {
    id: id,
    x: x,
    y: y,
    label: label,
    renderBody: (host: any) => {
      if (host && hostEl) host.appendChild(hostEl);
    }
  });
})(); }); });
</script>

<div bind:this={__rozieRoot} {...__rozieAttrs} class={["rozie-flow-node-host", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-23c15996>{@render children?.()}</div>
