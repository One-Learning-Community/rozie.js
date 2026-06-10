import { useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieContext } from '@rozie/runtime-react';

interface FlowNodeProps {
  id: string;
  x?: number;
  y?: number;
  label?: unknown;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function FlowNode(_props: FlowNodeProps): JSX.Element {
  const canvas = useContext(rozieContext("rete:canvas"));
  const __ctx_rete_node = rozieContext("rete:node");
  const props: Omit<FlowNodeProps, 'x' | 'y' | 'label'> & { x: number; y: number; label: unknown } = {
    ..._props,
    x: _props.x ?? 0,
    y: _props.y ?? 0,
    label: _props.label ?? undefined,
  };
  const attrs: Record<string, unknown> = (() => {
    const { id, x, y, label, ...rest } = _props as FlowNodeProps & Record<string, unknown>;
    void id; void x; void y; void label;
    return rest;
  })();
  const hostEl = useRef<any>(null);
  const cv = useRef<any>(null);
  const _labelRef = useRef(props.label);
  _labelRef.current = props.label;
  const _xRef = useRef(props.x);
  _xRef.current = props.x;
  const _yRef = useRef(props.y);
  _yRef.current = props.y;
  const __rozieRoot = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);

  cv.current = canvas;

  // The FlowNode's own host element, captured at mount ($el only safe in $onMount,
  // ROZ123). The parent-invoked renderBody closure appends THIS into the engine
  // `body` host — moving the host preserves Lit shadow projection of the slot body.
  // Module-scope `any` so it survives into the parent's later render-scope call.

  useEffect(() => {
    hostEl.current = __rozieRoot.current;
    // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
    // builds the engine node, then renderNode invokes renderBody(body) — projecting
    // this FlowNode's body into the engine element from the PARENT's render scope.
    if (cv.current) {
      cv.current.register(props.id, {
        id: props.id,
        x: _xRef.current,
        y: _yRef.current,
        label: _labelRef.current,
        inputs: [],
        outputs: [],
        // D-04 render-callback: the parent calls this with the engine body host div.
        renderBody: (host: any) => {
          if (host && hostEl.current) host.appendChild(hostEl.current);
        }
      });
    }
    return () => {
      if (cv.current) cv.current.unregister(props.id);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    if (cv.current) cv.current.update(props.id, {
      id: props.id,
      x: props.x,
      y: props.y,
      label: props.label,
      renderBody: (host: any) => {
        if (host && hostEl.current) host.appendChild(hostEl.current);
      }
    });
  }, [props.x]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    if (cv.current) cv.current.update(props.id, {
      id: props.id,
      x: props.x,
      y: props.y,
      label: props.label,
      renderBody: (host: any) => {
        if (host && hostEl.current) host.appendChild(hostEl.current);
      }
    });
  }, [props.y]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    if (cv.current) cv.current.update(props.id, {
      id: props.id,
      x: props.x,
      y: props.y,
      label: props.label,
      renderBody: (host: any) => {
        if (host && hostEl.current) host.appendChild(hostEl.current);
      }
    });
  }, [props.label]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <__ctx_rete_node.Provider value={{
  get id() {
    return props.id;
  },
  addPort: (side: any, key: any, label: any, multiple: any) => {
    if (cv.current) cv.current.addPort(props.id, side, key, label, multiple);
  }
}}>
    <>

    <div ref={__rozieRoot} {...attrs} className={clsx("rozie-flow-node-host", (attrs.className as string | undefined))} data-rozie-s-23c15996="">{(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}</div>
    </>
    </__ctx_rete_node.Provider>
  );
}
