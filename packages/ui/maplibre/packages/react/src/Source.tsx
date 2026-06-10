import { useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { rozieContext } from '@rozie/runtime-react';

interface SourceProps {
  id: string;
  spec?: unknown;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function Source(_props: SourceProps): JSX.Element {
  const sources = useContext(rozieContext("maplibre:sources"));
  const __ctx_maplibre_source = rozieContext("maplibre:source");
  const props: Omit<SourceProps, 'spec'> & { spec: unknown } = {
    ..._props,
    spec: _props.spec ?? undefined,
  };
  const attrs: Record<string, unknown> = (() => {
    const { id, spec, ...rest } = _props as SourceProps & Record<string, unknown>;
    void id; void spec;
    return rest;
  })();
  const reg = useRef<any>(null);
  const _specRef = useRef(props.spec);
  _specRef.current = props.spec;
  const _watch0First = useRef(true);

  reg.current = sources;

  useEffect(() => {
    // register this source's spec into the parent registry; the parent's
    // applyLayers() reconcile (style-load gated) picks it up via its registry watch.
    if (reg.current) reg.current.register(props.id, {
      id: props.id,
      spec: _specRef.current
    });
    // unregister on unmount so the parent reaps this source (its layers first).
    return () => {
      if (reg.current) reg.current.unregister(props.id);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = props.spec;
    if (reg.current) reg.current.update(props.id, {
      id: props.id,
      spec: v
    });
  }, [props.spec]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <__ctx_maplibre_source.Provider value={{
  get id() {
    return props.id;
  }
}}>
    <>
    {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    </>
    </__ctx_maplibre_source.Provider>
  );
}
