<template>




<div class="rozie-node-type-children" style="display:none"><slot></slot></div>

</template>

<script setup lang="ts">
import { Fragment, h, inject, onBeforeUnmount, onMounted, onUpdated, provide, render, useSlots, watch } from 'vue';

const props = defineProps<{ type: string }>();

defineSlots<{
  body(props: { node: any; selected: any; emit: any }): any;
  default(props: {  }): any;
}>();

const slots = useSlots();

const canvas = inject('rete:canvas');

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
// The live $portals.body handle ({ dispose }) returned by the parent-invoked
// bodyRenderer callback. Module-scope `any` so the teardown — which the Solid
// emitter hoists into a sibling onCleanup() OUTSIDE the mount closure — can dispose
// it. (A NodeType type-template projects ONE body root per graph node; the canvas
// disposes per-node on node unmount, this is the last-projection handle.)
let bodyHandle: any = null;

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
  type: props.type,
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

provide('rete:nodeType', {
  get type() {
    return props.type;
  },
  addPort: (side: any, key: any, portType: any, label: any, multiple: any) => {
    if (cv) cv.addTypePort(props.type, side, key, portType, label, multiple);
  }
});

interface ReactivePortalHandle {
  update(scope: unknown): void;
  dispose(): void;
}
const portalContainers = new Set<HTMLElement>();
const portals = {
  body: (container: HTMLElement, scope: { node: unknown; selected: unknown; emit: unknown }): ReactivePortalHandle => {
    const slotFn = slots.body;
    if (!slotFn) return { update() {}, dispose() {} };
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // body { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-body', '372f9492');
    const renderScope = (s: unknown): void => {
      render(h(Fragment, null, slotFn(s)), container);
    };
    renderScope(scope);
    portalContainers.add(container);
    return {
      update: (s: unknown): void => renderScope(s),
      dispose: (): void => {
        render(null, container);
        portalContainers.delete(container);
      },
    };
  },
};
onBeforeUnmount(() => {
  for (const container of portalContainers) render(null, container);
  portalContainers.clear();
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  // The body-mount closure — captures the mount-scoped `portals` local. Disposes a
  // prior handle first so a re-fired bodyRenderer (e.g. ports changed → fresh node
  // build) does not stack portal roots into the same engine host. Mounts the type's
  // `#body` slot, scoped with the graph node ({ node, selected, emit }).
  mountBody = (host: any, scope: any) => {
    if (!host) return null;
    if (bodyHandle && bodyHandle.dispose) {
      try {
        bodyHandle.dispose();
      } catch (e: any) {}
    }
    const s = scope || {};
    bodyHandle = portals.body(host, {
      node: s.node,
      selected: s.selected,
      emit: s.emit
    });
    return bodyHandle;
  };
  // register this TYPE's spec INCLUDING the bodyRenderer callback. The canvas's
  // renderNode resolves typeReg[node.type].bodyRenderer for every graph node of this
  // type and projects the body into the engine host. On Lit the injected canvas may
  // still be undefined here (REQ-30 async context); the $onUpdate below performs the
  // registration once the value arrives.
  if (cv && !registered) {
    registered = true;
    cv.registerType(props.type, buildSpec());
  }
  _cleanup_0 = () => {
    if (bodyHandle && bodyHandle.dispose) {
      try {
        bodyHandle.dispose();
      } catch (e: any) {}
    }
    if (cv) cv.unregisterType(props.type);
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });
onUpdated(() => {
  if (registered) return;
  const live = canvas;
  if (live == null) return;
  cv = live;
  registered = true;
  cv.registerType(props.type, buildSpec());
});

watch(() => props.type, () => {
  if (cv) cv.registerType(props.type, buildSpec());
});
</script>
