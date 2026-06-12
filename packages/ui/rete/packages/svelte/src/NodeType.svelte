<script lang="ts">
import type { Snippet } from 'svelte';
import { mount, unmount } from 'svelte';
import PortalHostReactive from '@rozie/runtime-svelte/PortalHostReactive.svelte';
import { getContext, onMount, setContext, untrack } from 'svelte';

interface Props {
  type: string;
  body?: Snippet<[{ node: any; selected: any; emit: any }]>;
  children?: Snippet;
  snippets?: Record<string, any>;
}

let {
  type,
  body: __bodyProp,
  children: __childrenProp,
  snippets
}: Props = $props();

const body = $derived(__bodyProp ?? snippets?.body);
const children = $derived(__childrenProp ?? snippets?.children);

const canvas = getContext('rete:canvas');

// $inject is typed `unknown` (Phase 36 D-4: no rich type synthesis yet), which the
// STRICT BUNDLED-LEAF tsc rejects on `.registerType(...)` (TS2339). The .rozie-native
// fix is the null-let → `any` typeNeutralize idiom: alias the injected API through
// a MODULE-SCOPE `let cv = null` (typeNeutralize types it `any`). Module-scope (not
// hook-local) so the alias is in scope from the Solid teardown — which the Solid
// emitter hoists into a sibling onCleanup() OUTSIDE the mount closure (the MapLibre
// Source/Layer lesson). ZERO emitter change.
let cv: any = null;
cv = canvas;

// The live $portals.body handle ({ dispose }) returned by the parent-invoked
// bodyRenderer callback. Module-scope `any` so the teardown — which the Solid
// emitter hoists into a sibling onCleanup() OUTSIDE the mount closure — can dispose
// it. (A NodeType type-template projects ONE body root per graph node; the canvas
// disposes per-node on node unmount, this is the last-projection handle.)
//
// PER-NODE FIX: a Set of INDEPENDENT handles — ONE PER GRAPH NODE of this type.
// render-by-type calls bodyRenderer once per node a->b->c; the old single-handle
// form disposed the PRIOR node's body on each call, leaving only the LAST node of
// the type rendered (3 nodes, 1 body — the count-only-VR-masking bug). Each call now
// mounts an INDEPENDENT handle and disposes NONE of its siblings; the canvas already
// owns per-node disposal (entry.bodyHandle in nodeEntries, torn down on node unmount).
// Module-scope `any` so the Solid-hoisted teardown can sweep any leftovers. This is
// the controlled-graph analog of FlowCanvas's per-node $portals.node handle map.
// The live $portals.body handle ({ dispose }) returned by the parent-invoked
// bodyRenderer callback. Module-scope `any` so the teardown — which the Solid
// emitter hoists into a sibling onCleanup() OUTSIDE the mount closure — can dispose
// it. (A NodeType type-template projects ONE body root per graph node; the canvas
// disposes per-node on node unmount, this is the last-projection handle.)
//
// PER-NODE FIX: a Set of INDEPENDENT handles — ONE PER GRAPH NODE of this type.
// render-by-type calls bodyRenderer once per node a->b->c; the old single-handle
// form disposed the PRIOR node's body on each call, leaving only the LAST node of
// the type rendered (3 nodes, 1 body — the count-only-VR-masking bug). Each call now
// mounts an INDEPENDENT handle and disposes NONE of its siblings; the canvas already
// owns per-node disposal (entry.bodyHandle in nodeEntries, torn down on node unmount).
// Module-scope `any` so the Solid-hoisted teardown can sweep any leftovers. This is
// the controlled-graph analog of FlowCanvas's per-node $portals.node handle map.
let bodyHandles: any = null;
bodyHandles = new Set();

// The body-mount closure, DEFINED INSIDE $onMount (below) so it captures the
// emitter-synthesized `portals` local — which on React/Angular/Lit is scoped to the
// mount effect body, NOT visible from a spec callback the canvas invokes later (that
// escaped scope is exactly why a bare `$portals.body(...)` in the bodyRenderer
// threw "portals is not defined" on those 3 targets). Stored in a module-scope `any`
// so the spec's bodyRenderer — invoked by the canvas's renderNode from its own
// render scope — can delegate to it. ZERO emitter change (just correct scoping).
// The body-mount closure, DEFINED INSIDE $onMount (below) so it captures the
// emitter-synthesized `portals` local — which on React/Angular/Lit is scoped to the
// mount effect body, NOT visible from a spec callback the canvas invokes later (that
// escaped scope is exactly why a bare `$portals.body(...)` in the bodyRenderer
// threw "portals is not defined" on those 3 targets). Stored in a module-scope `any`
// so the spec's bodyRenderer — invoked by the canvas's renderNode from its own
// render scope — can delegate to it. ZERO emitter change (just correct scoping).
let mountBody: any = null;

// idempotency flag so a reactive late-context registration (Lit async first
// paint, REQ-30) and the $onMount registration never double-register the type.
// idempotency flag so a reactive late-context registration (Lit async first
// paint, REQ-30) and the $onMount registration never double-register the type.
let registered = false;

// the canvas TYPE spec builder — shared by the $onMount register and the late-context
// $onUpdate below. The bodyRenderer render-callback is invoked by the canvas's
// renderNode (per graph node of this type) from the canvas's own render scope with
// the engine `body` host div + the { node, selected, emit } scope; the NodeType then
// mounts its OWN `body` portal slot INTO that host via $portals.body — reusing the
// shipped reactive-portal machinery (6/6 green on the config-array `node` path). NO
// framework DOM is relocated. Returns { dispose } so the canvas can tear the body
// projection down on node unmount / port-resync.
// the canvas TYPE spec builder — shared by the $onMount register and the late-context
// $onUpdate below. The bodyRenderer render-callback is invoked by the canvas's
// renderNode (per graph node of this type) from the canvas's own render scope with
// the engine `body` host div + the { node, selected, emit } scope; the NodeType then
// mounts its OWN `body` portal slot INTO that host via $portals.body — reusing the
// shipped reactive-portal machinery (6/6 green on the config-array `node` path). NO
// framework DOM is relocated. Returns { dispose } so the canvas can tear the body
// projection down on node unmount / port-resync.
const buildSpec = () => ({
  type: type,
  // RENDER-BY-TYPE callback: the canvas hands the engine body host + scope; delegate
  // to the mountBody closure (defined inside $onMount so it can see the emitter's
  // mount-scoped `portals` local). Until $onMount has run, mountBody is null — but
  // the canvas only invokes bodyRenderer AFTER reconcileNodes (post-register,
  // post-mount), so mountBody is always set by then. Returns the { dispose } handle.
  bodyRenderer: (host: any, scope: any) => {
    // try/catch so a per-target portal-render hiccup (e.g. a Lit lit-html "cannot
    // find node" when re-rendering into an engine-owned host the area re-created)
    // can NEVER abort the canvas's renderNode loop — a thrown bodyRenderer would
    // propagate out of area.update/addNode and stop the whole graph from building.
    if (host && mountBody) {
      try {
        return mountBody(host, scope);
      } catch (e: any) {}
    }
    return null;
  }
});

setContext('rete:nodeType', {
  get type() {
    return type;
  },
  addPort: (side: any, key: any, portType: any, label: any, multiple: any, position: any) => {
    if (cv) cv.addTypePort(type, side, key, portType, label, multiple, position);
  }
});

interface ReactivePortalHandle {
  update(scope: unknown): void;
  dispose(): void;
}
const portalInstances = new Set<Record<string, unknown>>();
const portals = {
  body: (container: HTMLElement, scope: { node: unknown; selected: unknown; emit: unknown }): ReactivePortalHandle => {
    if (!body) return { update() {}, dispose() {} };
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-body', '372f9492');
    const inst = mount(PortalHostReactive, {
      target: container,
      props: { snippet: body, initialScope: scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return {
      update: (s: unknown): void => {
        (inst as unknown as { update(s: unknown): void }).update(s);
      },
      dispose: (): void => {
        unmount(inst as Parameters<typeof unmount>[0]);
        portalInstances.delete(inst as Record<string, unknown>);
      },
    };
  },
};
$effect(() => () => {
  for (const inst of portalInstances) unmount(inst as Parameters<typeof unmount>[0]);
  portalInstances.clear();
});

onMount(() => {
  // The body-mount closure — captures the mount-scoped `portals` local. Mounts an
  // INDEPENDENT body root PER graph node (the canvas calls this once per node of the
  // type), so every instance keeps its OWN #body — it must NOT dispose any sibling's
  // handle (the bug: a single shared handle torn down on each call left only the LAST
  // node rendered). The returned { dispose } is wrapped to deregister ITSELF from the
  // live set when the canvas disposes that node's projection (entry.bodyHandle on node
  // unmount / port-resync); a leftover handle is swept by the component teardown below.
  mountBody = (host: any, scope: any) => {
    if (!host) return null;
    const s = scope || {};
    const h = portals.body(host, {
      node: s.node,
      selected: s.selected,
      emit: s.emit
    });
    if (!h) return null;
    bodyHandles.add(h);
    return {
      update: (next: any) => {
        if (h && h.update) {
          try {
            return h.update(next);
          } catch (e: any) {}
        }
      },
      dispose: () => {
        bodyHandles.delete(h);
        if (h && h.dispose) {
          try {
            h.dispose();
          } catch (e: any) {}
        }
      }
    };
  };
  // register this TYPE's spec INCLUDING the bodyRenderer callback. The canvas's
  // renderNode resolves typeReg[node.type].bodyRenderer for every graph node of this
  // type and projects the body into the engine host. On Lit the injected canvas may
  // still be undefined here (REQ-30 async context); the $onUpdate below performs the
  // registration once the value arrives.
  if (cv && !registered) {
    registered = true;
    cv.registerType(type, buildSpec());
  }
  return () => {
    // sweep any body projections still live at teardown (the canvas normally disposes
    // each per node unmount, but a component-level unmount must clean any stragglers).
    if (bodyHandles) {
      for (const h of bodyHandles as any) {
        if (h && h.dispose) {
          try {
            h.dispose();
          } catch (e: any) {}
        }
      }
      bodyHandles.clear();
    }
    if (cv) cv.unregisterType(type);
  };
});
$effect(() => (() => {
  if (registered) return;
  const live = canvas;
  if (live == null) return;
  cv = live;
  registered = true;
  cv.registerType(type, buildSpec());
})());

let __rozieWatchInitial_0 = true;
$effect(() => { (() => type)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => {
  if (cv) cv.registerType(type, buildSpec());
})(); }); });
</script>

<div class="rozie-node-type-children" style="display:none" data-rozie-s-372f9492>{@render children?.()}</div>
