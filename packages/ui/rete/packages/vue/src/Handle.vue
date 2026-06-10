<template>
<!-- empty template -->
</template>

<script setup lang="ts">
import { inject, onMounted } from 'vue';

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

onMounted(() => {
  // register this port against the enclosing node's id+side; the parent's
  // reconcileNodes re-runs buildNode with the updated input/output spec.
  if (nd) nd.addPort(props.side, props.port, props.label, props.multiple);
});
</script>
