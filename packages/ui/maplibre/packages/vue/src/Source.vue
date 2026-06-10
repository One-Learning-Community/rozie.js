<template>

<slot></slot>

</template>

<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, provide, watch } from 'vue';

const props = withDefaults(
  defineProps<{ id: string; spec?: unknown }>(),
  { spec: undefined }
);

defineSlots<{
  default(props: {  }): any;
}>();

const sources = inject('maplibre:sources');

// $inject is typed `unknown` (Phase 36 D-4: no rich type synthesis yet), which the
// STRICT BUNDLED-LEAF tsc rejects on `.register(...)` (TS2339). The .rozie-native
// fix is the null-let → `any` typeNeutralize idiom: alias the injected API through
// a MODULE-SCOPE `let reg = null` (typeNeutralize types it `any`) kept fresh from
// the live inject every setup pass. Module-scope (not hook-local) so the alias is
// in scope from the Solid teardown — which the Solid emitter hoists into a sibling
// onCleanup() OUTSIDE the mount closure (the same reason MapLibre keeps its entry
// maps at component scope). On React the alias is auto-hoisted to per-instance
// useRef storage and re-synced every render — the stable registry-API object makes
// that benign. ZERO emitter change (the Phase 35 NO-emitter-touch lesson).
let reg: any = null;
reg = sources;

// idempotency flag so the $onMount register and the late-context $onUpdate path
// (Lit async, REQ-30) never double-register the source.
// idempotency flag so the $onMount register and the late-context $onUpdate path
// (Lit async, REQ-30) never double-register the source.
let didRegister = false;

provide('maplibre:source', {
  get id() {
    return props.id;
  }
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  // register this source's spec into the parent registry; the parent's
  // applyLayers() reconcile (style-load gated) picks it up via its registry watch.
  // On Lit the injected sources registry may still be undefined here (async
  // context, REQ-30) — the $onUpdate below registers once it resolves.
  if (reg && !didRegister) {
    didRegister = true;
    reg.register(props.id, {
      id: props.id,
      spec: props.spec
    });
  }
  // unregister on unmount so the parent reaps this source (its layers first).
  _cleanup_0 = () => {
    if (reg) reg.unregister(props.id);
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => sources, (live: any) => {
  if (didRegister || live == null) return;
  reg = live;
  didRegister = true;
  reg.register(props.id, {
    id: props.id,
    spec: props.spec
  });
});
watch(() => props.spec, (v: any) => {
  if (reg) reg.update(props.id, {
    id: props.id,
    spec: v
  });
});
</script>
