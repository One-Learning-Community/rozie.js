<template>
<!-- empty template -->
</template>

<script setup lang="ts">
import { inject, onMounted, onUpdated } from 'vue';

const props = withDefaults(
  defineProps<{ side?: string; port: string; label?: unknown; multiple?: unknown }>(),
  { side: 'output', label: undefined, multiple: undefined }
);

const node = inject('rete:node');

// $inject is typed `unknown` (Phase 36 D-4), which the STRICT BUNDLED-LEAF tsc
// rejects on `.addPort(...)` (TS2339). The .rozie-native fix is the null-let → `any`
// typeNeutralize idiom: alias through a MODULE-SCOPE `let nd = null` so it is in
// scope from the Solid hoisted onCleanup teardown (the MapLibre Source/Layer
// lesson). ZERO emitter change.
let nd: any = null;
nd = node;

// idempotency flag so the $onMount addPort and the late-context $onUpdate path
// (Lit async, REQ-30) never double-add the port. (FlowCanvas.addPort is also
// de-duped, so this is belt-and-suspenders.)
// idempotency flag so the $onMount addPort and the late-context $onUpdate path
// (Lit async, REQ-30) never double-add the port. (FlowCanvas.addPort is also
// de-duped, so this is belt-and-suspenders.)
let added = false;

onMounted(() => {
  // register this port against the enclosing node's id+side; the parent's
  // reconcileNodes re-runs buildNode with the updated input/output spec. On Lit
  // the injected node ctx may still be undefined here (async context, REQ-30) —
  // the $onUpdate below adds the port once it resolves.
  if (nd && !added) {
    added = true;
    nd.addPort(props.side, props.port, props.label, props.multiple);
  }
});
onUpdated(() => {
  if (added) return;
  const live = node;
  if (live == null) return;
  nd = live;
  added = true;
  nd.addPort(props.side, props.port, props.label, props.multiple);
});
</script>
