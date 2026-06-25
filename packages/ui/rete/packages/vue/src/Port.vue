<template>
<!-- empty template -->
</template>

<script setup lang="ts">
import { inject, onMounted, onUpdated } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * Declares an OUTPUT port and names its key — set this (not `input`) so the port direction resolves to `output`. The attribute is `output`, not `out`: `out`/`in` are awkward bare identifiers, so `output`/`input` are used across all six targets.
     * @example
     * <Port output="num" type="number" />
     */
    output?: string;
    /**
     * Declares an INPUT port and names its key — set this (not `output`) so the port direction resolves to `input`. The attribute is `input`, not `in`: `in` is a JS reserved word that Svelte's mandatory `$props()` destructure rejects, so `input`/`output` are used instead.
     */
    input?: string;
    /**
     * The port TYPE — drives the canvas's typed-socket `:validate-types` (a type-mismatched connection is auto-rejected). It is the typed layer, NOT socket identity (a single shared Socket gates identity). Optional: an untyped port imposes no type constraint and connects to anything.
     */
    type?: string;
    /**
     * Optional socket label shown next to the port (defaults to the port key when omitted).
     */
    label?: string;
    /**
     * Allow multiple connections into/out of this socket. Left undefined by default to preserve the canvas's side asymmetry: outputs default to multi, inputs default to single. To force an explicit multi input, BIND it (`:multiple="true"`) rather than using the bare boolean attribute (a bare `multiple` lands as undefined on Lit).
     */
    multiple?: unknown;
    /**
     * Visual placement of the socket on the node: `left`, `right`, `top`, or `bottom`. Defaults by direction (input → left, output → right). `top`/`bottom` enable vertical flows (decision trees, top-down pipelines) — the canvas lays the socket out on that edge and the connection anchor shifts onto the matching axis.
     */
    position?: string;
  }>(),
  { output: undefined, input: undefined, type: undefined, label: undefined, multiple: undefined, position: undefined }
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
    nt.addPort(portSide(), portKey(), props.type, props.label, props.multiple, props.position);
  }
});
onUpdated(() => {
  if (added) return;
  const live = injectedType;
  if (live == null) return;
  nt = live;
  added = true;
  nt.addPort(portSide(), portKey(), props.type, props.label, props.multiple, props.position);
});
</script>
