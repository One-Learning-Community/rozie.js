import type { JSX } from 'solid-js';
import { createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack, useContext } from 'solid-js';
import { rozieContext } from '@rozie/runtime-solid';

interface SourceProps {
  /**
   * The MapLibre source id (required). A `LayerSpecification.source` references this string, and nested `<Layer>` children auto-bind to it. Exposed to children as a live getter so it stays reactive.
   * @example
   * <Source id="pts" :spec="geojson"><Layer id="circles" type="circle" /></Source>
   */
  id: string;
  /**
   * The `SourceSpecification` (geojson / vector / raster / …). Registered into the parent `<MapLibre>` on mount and reconciled via `setData` (geojson) or re-add on change, once the style has loaded.
   */
  spec?: unknown;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function Source(_props: SourceProps): JSX.Element {
  const _merged = mergeProps({ spec: undefined }, _props);
  const [local, attrs] = splitProps(_merged, ['id', 'spec', 'children']);
  const resolved = () => local.children;

  const sources = useContext(rozieContext("maplibre:sources"));
  const __ctx_maplibre_source = rozieContext("maplibre:source");
  onMount(() => {
    const _cleanup = (() => {
    // register this source's spec into the parent registry; the parent's
    // applyLayers() reconcile (style-load gated) picks it up via its registry watch.
    // On Lit the injected sources registry may still be undefined here (async
    // context, REQ-30) — the $onUpdate below registers once it resolves.
    if (reg && !didRegister) {
      didRegister = true;
      reg.register(local.id, {
        id: local.id,
        spec: local.spec
      });
    }
    // unregister on unmount so the parent reaps this source (its layers first).
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    if (reg) reg.unregister(local.id);
  });
  });
  createEffect(on(() => (() => sources)(), (v) => untrack(() => ((live: any) => {
    if (didRegister || live == null) return;
    reg = live;
    didRegister = true;
    reg.register(local.id, {
      id: local.id,
      spec: local.spec
    });
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.spec)(), (v) => untrack(() => ((v: any) => {
    if (reg) reg.update(local.id, {
      id: local.id,
      spec: v
    });
  })(v)), { defer: true }));

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
  let didRegister = false;

  return (
    <__ctx_maplibre_source.Provider value={{
  get id() {
    return local.id;
  }
}}>
    <>
    {resolved()}
    </>
    </__ctx_maplibre_source.Provider>
  );
}
