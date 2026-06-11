<template>
<!-- empty template -->
</template>

<script setup lang="ts">
import { inject, onMounted, onUpdated } from 'vue';

const props = withDefaults(
  defineProps<{ output?: string; input?: string; type?: string; label?: unknown; multiple?: unknown }>(),
  { output: undefined, input: undefined, type: undefined, label: undefined, multiple: undefined }
);

const injectedType = inject('rete:nodeType');

// $inject is typed `unknown` (Phase 36 D-4), which the STRICT BUNDLED-LEAF tsc
// rejects on `.addPort(...)` (TS2339). The .rozie-native fix is the null-let → `any`
// typeNeutralize idiom: alias through a MODULE-SCOPE `let nt = null` so it is in
// scope from the Solid hoisted onCleanup teardown (the MapLibre Source/Layer
// lesson). ZERO emitter change.
let nt: any = null;
nt = injectedType;

// Derive side + key from which of output=/input= is set. output wins if both are
// (mis)set. `output`/`input` are ordinary identifiers (NOT reserved words) so they
// read normally — no member-access-only workaround needed. null key (neither set) ⇒
// addPort no-ops on the canvas side (key == null guard).
// Derive side + key from which of output=/input= is set. output wins if both are
// (mis)set. `output`/`input` are ordinary identifiers (NOT reserved words) so they
// read normally — no member-access-only workaround needed. null key (neither set) ⇒
// addPort no-ops on the canvas side (key == null guard).
const portSide = () => props.output != null ? 'output' : 'input';
const portKey = () => props.output != null ? props.output : props.input;

// idempotency flag so the $onMount addPort and the late-context $onUpdate path
// (Lit async, REQ-30) never double-add the port. (addTypePort is also idempotent —
// same `type::side::key` key, same value — so this is belt-and-suspenders.)
// idempotency flag so the $onMount addPort and the late-context $onUpdate path
// (Lit async, REQ-30) never double-add the port. (addTypePort is also idempotent —
// same `type::side::key` key, same value — so this is belt-and-suspenders.)
let added = false;

onMounted(() => {
  // register this typed port against the enclosing node TYPE's schema; the canvas's
  // reconcileNodes builds buildNode with the updated input/output spec for every node
  // of that type. On Lit the injected nodeType ctx may still be undefined here (async
  // context, REQ-30) — the $onUpdate below adds the port once it resolves.
  if (nt && !added) {
    added = true;
    nt.addPort(portSide(), portKey(), props.type, props.label, props.multiple);
  }
});
onUpdated(() => {
  if (added) return;
  const live = injectedType;
  if (live == null) return;
  nt = live;
  added = true;
  nt.addPort(portSide(), portKey(), props.type, props.label, props.multiple);
});
</script>
