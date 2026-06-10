import { useCallback, useContext, useEffect, useRef } from 'react';
import { rozieContext } from '@rozie/runtime-react';

interface LayerProps {
  id: string;
  type?: string;
  paint?: unknown;
  layout?: unknown;
  source?: string;
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
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);

  reg.current = layers;
  let ctx: any = null;
  ctx = srcCtx;

  // Effective source id: explicit prop wins, else the nearest <Source> ancestor id,
  // else undefined (a sourceless layer e.g. background). Reads the LIVE `ctx`/`srcCtx`
  // at CALL time so a late-resolving <Source> context (parent mounts AFTER this child
  // on React/Vue/Svelte/Angular; async on Lit) is picked up on re-register. `ctx` is
  // the `any` alias so the `.id` read type-checks on the strict bundled leaves.
  const resolveSource = useCallback(() => props.source ?? (ctx && ctx.id), [props.source]);
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
    const live = layers;
    if (!live) return;
    if (!reg.current) reg.current = live;
    const src = resolveSource();
    if (!didRegister.current) {
      didRegister.current = true;
      appliedSource.current = src;
      reg.current.register(props.id, buildSpec());
      return;
    }
    if (src != null && src !== appliedSource.current) {
      appliedSource.current = src;
      reg.current.update(props.id, buildSpec());
    }
  }, [appliedSource, buildSpec, didRegister, layers, props.id, reg, resolveSource]);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
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
    if (_watch1First.current) { _watch1First.current = false; return; }
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
    if (_watch2First.current) { _watch2First.current = false; return; }
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
