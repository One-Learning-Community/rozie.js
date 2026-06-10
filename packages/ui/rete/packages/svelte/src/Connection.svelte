<script lang="ts">
import { getContext, onMount } from 'svelte';

interface Props {
  id?: string;
  source: string;
  sourceOutput?: string;
  target: string;
  targetInput?: string;
  [key: string]: unknown;
}

let {
  id = undefined,
  source,
  sourceOutput = undefined,
  target,
  targetInput = undefined,
  ...__rozieAttrs
}: Props = $props();

const canvas = getContext('rete:canvas');

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
  if (id != null) return id;
  const srcOut = sourceOutput != null ? sourceOutput : 'out';
  const tgtIn = targetInput != null ? targetInput : 'in';
  return `${source}:${srcOut}->${target}:${tgtIn}`;
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

onMount(() => {
  connId = edgeId();
  if (cv) {
    cv.registerConnection(connId, {
      id: connId,
      source: source,
      sourceOutput: sourceOutput,
      target: target,
      targetInput: targetInput
    });
  }
  return () => {
    if (cv) cv.unregisterConnection(connId);
  };
});
</script>

<!-- empty template -->
