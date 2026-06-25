import { useCallback, useContext, useEffect, useRef } from 'react';
import { rozieContext } from '@rozie/runtime-react';

interface LayerProps {
  /**
   * The MapLibre layer id (required). Identifies the layer in the parent `<MapLibre>` registry and the underlying style.
   * @example
   * <Layer id="circles" type="circle" :paint="{ 'circle-radius': 5 }" />
   */
  id: string;
  /**
   * The `LayerSpecification.type` — `'circle'` / `'fill'` / `'line'` / `'symbol'` / `'raster'` / `'background'` / … A `'background'` layer needs no source; every other type requires a `source` (explicit or injected from a parent `<Source>`).
   */
  type?: string;
  /**
   * The layer's `paint` properties (the `LayerSpecification.paint` object, e.g. `{ 'line-color': '#e11', 'line-width': 3 }`). Changes are reconciled via `setPaintProperty` with no remount.
   */
  paint?: unknown;
  /**
   * The layer's `layout` properties (the `LayerSpecification.layout` object, e.g. `{ 'line-cap': 'round' }`). Changes are reconciled via `setLayoutProperty` with no remount.
   */
  layout?: unknown;
  /**
   * Explicit source id for the flat shape (a background layer needs none, or a cross-source reference). When omitted inside a `<Source>`, the injected source context supplies the id automatically.
   */
  source?: string;
  /**
   * Insert this layer immediately **before** the layer with this id, controlling draw order (the `addLayer` `beforeId` argument). Omit to append on top.
   */
  beforeId?: string;
}

export default function Layer(_props: LayerProps): JSX.Element {
  const srcCtx = useContext(rozieContext("maplibre:source")) ?? null;
  const layers = useContext(rozieContext("maplibre:layers"));
  const props: Omit<LayerProps, 'type' | 'paint' | 'layout' | 'source' | 'beforeId'> & { type: string; paint: unknown; layout: unknown; source: string; beforeId: string } = {
    ..._props,
    type: _props.type ?? undefined,
    paint: _props.paint ?? undefined,
    layout: _props.layout ?? undefined,
    source: _props.source ?? undefined,
    beforeId: _props.beforeId ?? undefined,
  };
  const attrs: Record<string, unknown> = (() => {
    const { id, type, paint, layout, source, beforeId, ...rest } = _props as LayerProps & Record<string, unknown>;
    void id; void type; void paint; void layout; void source; void beforeId;
    return rest;
  })();
  const reg = useRef<any>(null);
  const didRegister = useRef(false);
  const appliedSource = useRef<any>(null);
  const ctx = useRef<any>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);

  reg.current = layers;
  ctx.current = srcCtx;

  // Effective source id: explicit prop wins, else the nearest <Source> ancestor id,
  // else undefined (a sourceless layer e.g. background). Reads the LIVE `ctx`/`srcCtx`
  // at CALL time so a late-resolving <Source> context (parent mounts AFTER this child
  // on React/Vue/Svelte/Angular; async on Lit) is picked up on re-register. `ctx` is
  // the `any` alias so the `.id` read type-checks on the strict bundled leaves.
  const resolveSource = useCallback(() => props.source ?? (ctx.current && ctx.current.id), [props.source]);
  const buildSpec = useCallback(() => ({
    id: props.id,
    type: props.type,
    paint: props.paint,
    layout: props.layout,
    source: resolveSource(),
    beforeId: props.beforeId
  }), [props.beforeId, props.id, props.layout, props.paint, props.type, resolveSource]);

  useEffect(() => {
    if (reg.current) {
      didRegister.current = true;
      appliedSource.current = resolveSource();
      reg.current.register(props.id, buildSpec());
    }
    return () => {
      if (reg.current) reg.current.unregister(props.id);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const src = resolveSource();
    if (!reg.current || src == null || src === appliedSource.current) return;
    appliedSource.current = src;
    reg.current.update(props.id, buildSpec());
  }, [resolveSource]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    if (reg.current) reg.current.update(props.id, {
      id: props.id,
      type: props.type,
      paint: props.paint,
      layout: props.layout,
      source: resolveSource(),
      beforeId: props.beforeId
    });
  }, [props.paint]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    if (reg.current) reg.current.update(props.id, {
      id: props.id,
      type: props.type,
      paint: props.paint,
      layout: props.layout,
      source: resolveSource(),
      beforeId: props.beforeId
    });
  }, [props.layout]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    if (reg.current) reg.current.update(props.id, {
      id: props.id,
      type: props.type,
      paint: props.paint,
      layout: props.layout,
      source: resolveSource(),
      beforeId: props.beforeId
    });
  }, [props.type]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    null
  );
}
