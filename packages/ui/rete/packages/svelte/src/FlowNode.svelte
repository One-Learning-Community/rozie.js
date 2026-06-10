<script lang="ts">
import type { Snippet } from 'svelte';
import { mount, unmount } from 'svelte';
import PortalHostReactive from '@rozie/runtime-svelte/PortalHostReactive.svelte';
import { getContext, onMount, setContext, untrack } from 'svelte';

interface Props {
  id: string;
  x?: number;
  y?: number;
  label?: unknown;
  body?: Snippet<[{ id: any; label: any }]>;
  children?: Snippet;
  snippets?: Record<string, any>;
}

let {
  id,
  x = 0,
  y = 0,
  label = undefined,
  body: __bodyProp,
  children: __childrenProp,
  snippets
}: Props = $props();

const body = $derived(__bodyProp ?? snippets?.body);
const children = $derived(__childrenProp ?? snippets?.children);

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

// The live $portals.body handle ({ dispose }) returned by the parent-invoked
// renderBody callback. Module-scope `any` so the teardown — which the Solid emitter
// hoists into a sibling onCleanup() OUTSIDE the mount closure — can dispose it.
// The live $portals.body handle ({ dispose }) returned by the parent-invoked
// renderBody callback. Module-scope `any` so the teardown — which the Solid emitter
// hoists into a sibling onCleanup() OUTSIDE the mount closure — can dispose it.
let bodyHandle: any = null;

// The body-mount closure, DEFINED INSIDE $onMount (below) so it captures the
// emitter-synthesized `portals` local — which on React/Angular/Lit is scoped to the
// mount effect body, NOT visible from a spec callback the PARENT invokes later (that
// escaped scope is exactly why a bare `$portals.body(...)` in the renderBody callback
// threw "portals is not defined" on those 3 targets). Stored in a module-scope `any`
// so the spec's renderBody — invoked by the parent's renderNode from the parent's own
// render scope — can delegate to it. ZERO emitter change (just correct scoping).
// The body-mount closure, DEFINED INSIDE $onMount (below) so it captures the
// emitter-synthesized `portals` local — which on React/Angular/Lit is scoped to the
// mount effect body, NOT visible from a spec callback the PARENT invokes later (that
// escaped scope is exactly why a bare `$portals.body(...)` in the renderBody callback
// threw "portals is not defined" on those 3 targets). Stored in a module-scope `any`
// so the spec's renderBody — invoked by the parent's renderNode from the parent's own
// render scope — can delegate to it. ZERO emitter change (just correct scoping).
let mountBody: any = null;

// idempotency flag so a reactive late-context registration (Lit async first
// paint, REQ-30) and the $onMount registration never double-register the node.
// idempotency flag so a reactive late-context registration (Lit async first
// paint, REQ-30) and the $onMount registration never double-register the node.
let registered = false;

// the canvas spec builder — shared by the $onMount register and the late-context
// $onUpdate below. The renderBody render-callback is invoked by the PARENT's
// renderNode from the parent's own render scope with the engine `body` host div; the
// FlowNode then mounts its OWN `body` portal slot INTO that host via $portals.body —
// reusing the shipped reactive-portal machinery (6/6 green on the config-array
// `#node` path). NO framework DOM is relocated. Re-supplied on every register/update
// so a re-render re-projects the body into the (same) host idempotently.
// the canvas spec builder — shared by the $onMount register and the late-context
// $onUpdate below. The renderBody render-callback is invoked by the PARENT's
// renderNode from the parent's own render scope with the engine `body` host div; the
// FlowNode then mounts its OWN `body` portal slot INTO that host via $portals.body —
// reusing the shipped reactive-portal machinery (6/6 green on the config-array
// `#node` path). NO framework DOM is relocated. Re-supplied on every register/update
// so a re-render re-projects the body into the (same) host idempotently.
const buildSpec = () => ({
  id: id,
  x: x,
  y: y,
  label: label,
  inputs: [],
  outputs: [],
  // D-04 render-callback: the parent hands the engine body host; delegate to the
  // mountBody closure (defined inside $onMount so it can see the emitter's mount-
  // scoped `portals` local). Until $onMount has run, mountBody is null — but the
  // parent only invokes renderBody AFTER reconcileNodes (post-register, post-mount),
  // so mountBody is always set by then.
  renderBody: (host: any) => {
    // try/catch so a per-target portal-render hiccup (e.g. a Lit lit-html
    // "cannot find node" when re-rendering into an engine-owned host that the area
    // re-created) can NEVER abort the parent's reconcileNodes loop — a thrown
    // renderBody would propagate out of area.update/addNode and stop the whole graph
    // from building (cfg renders, the declarative nodes don't). The body simply
    // re-mounts on the next reconcile tick if a single attempt fails.
    if (host && mountBody) {
      try {
        mountBody(host);
      } catch (e: any) {}
    }
  }
});

setContext('rete:node', {
  get id() {
    return id;
  },
  addPort: (side: any, key: any, label: any, multiple: any) => {
    if (cv) cv.addPort(id, side, key, label, multiple);
  }
});

interface ReactivePortalHandle {
  update(scope: unknown): void;
  dispose(): void;
}
const portalInstances = new Set<Record<string, unknown>>();
const portals = {
  body: (container: HTMLElement, scope: { id: unknown; label: unknown }): ReactivePortalHandle => {
    if (!body) return { update() {}, dispose() {} };
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-body', '23c15996');
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
  // The body-mount closure — captures the mount-scoped `portals` local. Disposes a
  // prior handle first so a re-fired renderBody (e.g. ports changed → fresh node
  // build) does not stack portal roots into the same engine host.
  mountBody = (host: any) => {
    if (!host) return;
    if (bodyHandle && bodyHandle.dispose) {
      try {
        bodyHandle.dispose();
      } catch (e: any) {}
    }
    bodyHandle = portals.body(host, {
      id: id,
      label: label
    });
  };
  // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
  // builds the engine node, then renderNode invokes renderBody(body) — at which point
  // the FlowNode mounts its own body portal into the engine `body` host.
  // On Lit the injected canvas may still be undefined here (REQ-30 async context);
  // the $onUpdate below performs the registration once the value arrives.
  if (cv && !registered) {
    registered = true;
    cv.register(id, buildSpec());
  }
  return () => {
    if (bodyHandle && bodyHandle.dispose) {
      try {
        bodyHandle.dispose();
      } catch (e: any) {}
    }
    if (cv) cv.unregister(id);
  };
});
$effect(() => (() => {
  if (registered) return;
  const live = canvas;
  if (live == null) return;
  cv = live;
  registered = true;
  cv.register(id, buildSpec());
})());

let __rozieWatchInitial_0 = true;
$effect(() => { (() => x)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => {
  if (cv) cv.update(id, buildSpec());
})(); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { (() => y)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } (() => {
  if (cv) cv.update(id, buildSpec());
})(); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { (() => label)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } (() => {
  if (cv) cv.update(id, buildSpec());
})(); }); });
</script>

<div class="rozie-flow-node-children" style="display:none" data-rozie-s-23c15996>{@render children?.()}</div>
