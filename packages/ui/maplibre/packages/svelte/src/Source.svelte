<script lang="ts">
import type { Snippet } from 'svelte';
import { getContext, onMount, setContext, untrack } from 'svelte';

interface Props {
  id: string;
  spec?: unknown;
  children?: Snippet;
  snippets?: Record<string, any>;
  [key: string]: unknown;
}

let {
  id,
  spec = undefined,
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const children = $derived(__childrenProp ?? snippets?.children);

const sources = getContext('maplibre:sources');

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

setContext('maplibre:source', {
  get id() {
    return id;
  }
});

onMount(() => {
  // register this source's spec into the parent registry; the parent's
  // applyLayers() reconcile (style-load gated) picks it up via its registry watch.
  if (reg) reg.register(id, {
    id: id,
    spec: spec
  });
  // unregister on unmount so the parent reaps this source (its layers first).
  return () => {
    if (reg) reg.unregister(id);
  };
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => spec)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((v: any) => {
  if (reg) reg.update(id, {
    id: id,
    spec: v
  });
})(__watchVal); }); });
</script>

{@render children?.()}
