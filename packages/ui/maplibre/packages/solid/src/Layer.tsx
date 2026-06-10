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
    const source = resolveSource();
    if (reg) {
      reg.register(local.id, {
        id: local.id,
        type: local.type,
        paint: local.paint,
        layout: local.layout,
        source,
        beforeId: local.beforeId
      });
    }
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    if (reg) reg.unregister(local.id);
  });
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
  // else undefined (a sourceless layer e.g. background). `ctx` is the `any` alias so
  // the `.id` read type-checks on the strict bundled leaves.
  function resolveSource() {
    return local.source ?? (ctx && ctx.id);
  }

  return (
    null
  );
}
