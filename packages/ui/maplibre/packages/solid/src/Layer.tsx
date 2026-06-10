import type { JSX } from 'solid-js';
import { createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack, useContext } from 'solid-js';
import { rozieContext } from '@rozie/runtime-solid';

interface LayerProps {
  id: string;
  type?: string;
  paint?: unknown;
  layout?: unknown;
  source?: string;
  beforeId?: string;
}

export default function Layer(_props: LayerProps): JSX.Element {
  const _merged = mergeProps({ type: undefined, paint: undefined, layout: undefined, source: undefined, beforeId: undefined }, _props);
  const [local, attrs] = splitProps(_merged, ['id', 'type', 'paint', 'layout', 'source', 'beforeId']);

  const srcCtx = useContext(rozieContext("maplibre:source")) ?? null;
  const layers = useContext(rozieContext("maplibre:layers"));
  onMount(() => {
    const _cleanup = (() => {
    if (reg) {
      didRegister = true;
      appliedSource = resolveSource();
      reg.register(local.id, buildSpec());
    }
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    if (reg) reg.unregister(local.id);
  });
  });
  createEffect(() => {
    const live = layers;
    if (!live) return;
    if (!reg) reg = live;
    const src = resolveSource();
    if (!didRegister) {
      didRegister = true;
      appliedSource = src;
      reg.register(local.id, buildSpec());
      return;
    }
    if (src != null && src !== appliedSource) {
      appliedSource = src;
      reg.update(local.id, buildSpec());
    }
  });
  createEffect(on(() => (() => local.paint)(), (v) => untrack(() => (() => {
    if (reg) reg.update(local.id, {
      id: local.id,
      type: local.type,
      paint: local.paint,
      layout: local.layout,
      source: resolveSource(),
      beforeId: local.beforeId
    });
  })()), { defer: true }));
  createEffect(on(() => (() => local.layout)(), (v) => untrack(() => (() => {
    if (reg) reg.update(local.id, {
      id: local.id,
      type: local.type,
      paint: local.paint,
      layout: local.layout,
      source: resolveSource(),
      beforeId: local.beforeId
    });
  })()), { defer: true }));
  createEffect(on(() => (() => local.type)(), (v) => untrack(() => (() => {
    if (reg) reg.update(local.id, {
      id: local.id,
      type: local.type,
      paint: local.paint,
      layout: local.layout,
      source: resolveSource(),
      beforeId: local.beforeId
    });
  })()), { defer: true }));

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
  function resolveSource() {
    return local.source ?? (ctx && ctx.id);
  }

  // The last source id we registered with. A nested <Layer> may register on mount
  // (React/Vue/Svelte/Angular) BEFORE its <Source> parent has mounted, so its
  // injected source ctx is null and resolveSource() yields undefined — registering a
  // non-background layer with no source, which applyLayers can't add. When the source
  // ctx resolves we re-register with the now-correct source id (idempotent upsert in
  // the parent registry). null = not yet registered.
  let appliedSource: any = null;
  let didRegister = false;
  function buildSpec() {
    return {
      id: local.id,
      type: local.type,
      paint: local.paint,
      layout: local.layout,
      source: resolveSource(),
      beforeId: local.beforeId
    };
  }

  return (
    null
  );
}
