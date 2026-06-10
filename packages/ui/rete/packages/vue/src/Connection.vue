<template>
<!-- empty template -->
</template>

<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, onUpdated } from 'vue';

const props = withDefaults(
  defineProps<{ id?: string; source: string; sourceOutput?: string; target: string; targetInput?: string }>(),
  { id: undefined, sourceOutput: undefined, targetInput: undefined }
);

const canvas = inject('rete:canvas');

// $inject is typed `unknown` (Phase 36 D-4); alias through a MODULE-SCOPE null-let
// → `any` (typeNeutralize) so .registerConnection(...) type-checks on the strict
// bundled leaves AND the alias is in scope from the Solid hoisted teardown (the
// MapLibre Source/Layer lesson). ZERO emitter change.
let cv: any = null;
cv = canvas;

// Effective edge id: explicit prop wins, else the source:out->target:in default
// (mirrors reconcileConnections so collision dedup is consistent).
// Effective edge id: explicit prop wins, else the source:out->target:in default
// (mirrors reconcileConnections so collision dedup is consistent).
const edgeId = () => {
  if (props.id != null) return props.id;
  const srcOut = props.sourceOutput != null ? props.sourceOutput : 'out';
  const tgtIn = props.targetInput != null ? props.targetInput : 'in';
  return `${props.source}:${srcOut}->${props.target}:${tgtIn}`;
};

// The resolved edge id, captured at mount. MODULE-SCOPE (not $onMount-local) so the
// teardown — which the Solid emitter hoists into a sibling onCleanup() OUTSIDE the
// mount closure — can still reach it to unregisterConnection (the MapLibre Source/
// Layer teardown-hoist lesson). null until mount.
// The resolved edge id, captured at mount. MODULE-SCOPE (not $onMount-local) so the
// teardown — which the Solid emitter hoists into a sibling onCleanup() OUTSIDE the
// mount closure — can still reach it to unregisterConnection (the MapLibre Source/
// Layer teardown-hoist lesson). null until mount.
let connId: any = null;

// idempotency flag so the $onMount register and the late-context $onUpdate path
// (Lit async, REQ-30) never double-register the connection.
// idempotency flag so the $onMount register and the late-context $onUpdate path
// (Lit async, REQ-30) never double-register the connection.
let registered = false;
const buildConn = () => ({
  id: connId,
  source: props.source,
  sourceOutput: props.sourceOutput,
  target: props.target,
  targetInput: props.targetInput
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  connId = edgeId();
  // On Lit the injected canvas may still be undefined here (async context, REQ-30);
  // the $onUpdate below registers once it resolves.
  if (cv && !registered) {
    registered = true;
    cv.registerConnection(connId, buildConn());
  }
  _cleanup_0 = () => {
    if (cv) cv.unregisterConnection(connId);
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });
onUpdated(() => {
  if (registered) return;
  const live = canvas;
  if (live == null) return;
  cv = live;
  if (connId == null) connId = edgeId();
  registered = true;
  cv.registerConnection(connId, buildConn());
});
</script>
