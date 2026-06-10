<script lang="ts">
import { getContext, onMount, untrack } from 'svelte';

interface Props {
  id: string;
  type?: string;
  paint?: unknown;
  layout?: unknown;
  source?: string;
  beforeId?: string;
  [key: string]: unknown;
}

let {
  id,
  type = undefined,
  paint = undefined,
  layout = undefined,
  source = undefined,
  beforeId = undefined,
  ...__rozieAttrs
}: Props = $props();

const srcCtx = getContext('maplibre:source') ?? null;
const layers = getContext('maplibre:layers');

// $inject is typed `unknown` (Phase 36 D-4), which the STRICT BUNDLED-LEAF tsc
// rejects on `.register(...)` / `srcCtx.id` (TS2339). The .rozie-native fix is the
// null-let → `any` typeNeutralize idiom: alias each injected value through a
// MODULE-SCOPE `let … = null` (typeNeutralize types it `any`). Module-scope (not
// hook-local) so the alias is in scope from the Solid teardown — which the Solid
// emitter hoists into a sibling onCleanup() OUTSIDE the mount closure. On React the
// aliases auto-hoist to per-instance useRef storage and re-sync every render — the
// stable registry-API object / source ctx make that benign. ZERO emitter change.
let reg: any = null;
reg = layers;
let ctx: any = null;
ctx = srcCtx;

// Effective source id: explicit prop wins, else the nearest <Source> ancestor id,
// else undefined (a sourceless layer e.g. background). `ctx` is the `any` alias so
// the `.id` read type-checks on the strict bundled leaves.
// Effective source id: explicit prop wins, else the nearest <Source> ancestor id,
// else undefined (a sourceless layer e.g. background). `ctx` is the `any` alias so
// the `.id` read type-checks on the strict bundled leaves.
const resolveSource = () => source ?? (ctx && ctx.id);

onMount(() => {
  const source = resolveSource();
  if (reg) {
    reg.register(id, {
      id: id,
      type: type,
      paint: paint,
      layout: layout,
      source,
      beforeId: beforeId
    });
  }
  return () => {
    if (reg) reg.unregister(id);
  };
});

let __rozieWatchInitial_0 = true;
$effect(() => { (() => paint)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } (() => {
  if (reg) reg.update(id, {
    id: id,
    type: type,
    paint: paint,
    layout: layout,
    source: resolveSource(),
    beforeId: beforeId
  });
})(); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { (() => layout)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } (() => {
  if (reg) reg.update(id, {
    id: id,
    type: type,
    paint: paint,
    layout: layout,
    source: resolveSource(),
    beforeId: beforeId
  });
})(); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { (() => type)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } (() => {
  if (reg) reg.update(id, {
    id: id,
    type: type,
    paint: paint,
    layout: layout,
    source: resolveSource(),
    beforeId: beforeId
  });
})(); }); });
</script>

<!-- empty template -->
