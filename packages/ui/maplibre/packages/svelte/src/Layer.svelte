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
// else undefined (a sourceless layer e.g. background). Reads the LIVE `ctx`/`srcCtx`
// at CALL time so a late-resolving <Source> context (parent mounts AFTER this child
// on React/Vue/Svelte/Angular; async on Lit) is picked up on re-register. `ctx` is
// the `any` alias so the `.id` read type-checks on the strict bundled leaves.
// Effective source id: explicit prop wins, else the nearest <Source> ancestor id,
// else undefined (a sourceless layer e.g. background). Reads the LIVE `ctx`/`srcCtx`
// at CALL time so a late-resolving <Source> context (parent mounts AFTER this child
// on React/Vue/Svelte/Angular; async on Lit) is picked up on re-register. `ctx` is
// the `any` alias so the `.id` read type-checks on the strict bundled leaves.
const resolveSource = () => source ?? (ctx && ctx.id);

// The last source id we registered with. A nested <Layer> may register on mount
// (React/Vue/Svelte/Angular) BEFORE its <Source> parent has mounted, so its
// injected source ctx is null and resolveSource() yields undefined — registering a
// non-background layer with no source, which applyLayers can't add. When the source
// ctx resolves we re-register with the now-correct source id (idempotent upsert in
// the parent registry). null = not yet registered.
// The last source id we registered with. A nested <Layer> may register on mount
// (React/Vue/Svelte/Angular) BEFORE its <Source> parent has mounted, so its
// injected source ctx is null and resolveSource() yields undefined — registering a
// non-background layer with no source, which applyLayers can't add. When the source
// ctx resolves we re-register with the now-correct source id (idempotent upsert in
// the parent registry). null = not yet registered.
let appliedSource: any = null;
let didRegister = false;
const buildSpec = () => ({
  id: id,
  type: type,
  paint: paint,
  layout: layout,
  source: resolveSource(),
  beforeId: beforeId
});

onMount(() => {
  if (reg) {
    didRegister = true;
    appliedSource = resolveSource();
    reg.register(id, buildSpec());
  }
  return () => {
    if (reg) reg.unregister(id);
  };
});
$effect(() => (() => {
  const live = layers;
  if (!live) return;
  if (!reg) reg = live;
  const src = resolveSource();
  if (!didRegister) {
    didRegister = true;
    appliedSource = src;
    reg.register(id, buildSpec());
    return;
  }
  if (src != null && src !== appliedSource) {
    appliedSource = src;
    reg.update(id, buildSpec());
  }
})());

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
