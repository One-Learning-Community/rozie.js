<template>


<div class="rozie-flow-node-host" ref="__rozieRootRef" v-bind="$attrs"><slot></slot></div>

</template>

<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{ id: string; x?: number; y?: number; label?: unknown }>(),
  { x: 0, y: 0, label: undefined }
);

defineSlots<{
  default(props: {  }): any;
}>();

const __rozieRootRef = ref<HTMLElement>();

const canvas = inject('rete:canvas');

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

provide('rete:node', {
  get id() {
    return props.id;
  },
  addPort: (side: any, key: any, label: any, multiple: any) => {
    if (cv) cv.addPort(props.id, side, key, label, multiple);
  }
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  hostEl = __rozieRootRef.value;
  // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
  // builds the engine node, then renderNode invokes renderBody(body) — projecting
  // this FlowNode's body into the engine element from the PARENT's render scope.
  if (cv) {
    cv.register(props.id, {
      id: props.id,
      x: props.x,
      y: props.y,
      label: props.label,
      inputs: [],
      outputs: [],
      // D-04 render-callback: the parent calls this with the engine body host div.
      renderBody: (host: any) => {
        if (host && hostEl) host.appendChild(hostEl);
      }
    });
  }
  _cleanup_0 = () => {
    if (cv) cv.unregister(props.id);
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => props.x, () => {
  if (cv) cv.update(props.id, {
    id: props.id,
    x: props.x,
    y: props.y,
    label: props.label,
    renderBody: (host: any) => {
      if (host && hostEl) host.appendChild(hostEl);
    }
  });
});
watch(() => props.y, () => {
  if (cv) cv.update(props.id, {
    id: props.id,
    x: props.x,
    y: props.y,
    label: props.label,
    renderBody: (host: any) => {
      if (host && hostEl) host.appendChild(hostEl);
    }
  });
});
watch(() => props.label, () => {
  if (cv) cv.update(props.id, {
    id: props.id,
    x: props.x,
    y: props.y,
    label: props.label,
    renderBody: (host: any) => {
      if (host && hostEl) host.appendChild(hostEl);
    }
  });
});
</script>
