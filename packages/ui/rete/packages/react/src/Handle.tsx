import { useContext, useEffect, useRef } from 'react';
import { rozieContext } from '@rozie/runtime-react';

interface HandleProps {
  side?: string;
  port: string;
  label?: unknown;
  multiple?: unknown;
}

export default function Handle(_props: HandleProps): JSX.Element {
  const node = useContext(rozieContext("rete:node"));
  const props: Omit<HandleProps, 'side' | 'label' | 'multiple'> & { side: string; label: unknown; multiple: unknown } = {
    ..._props,
    side: _props.side ?? 'output',
    label: _props.label ?? undefined,
    multiple: _props.multiple ?? undefined,
  };
  const attrs: Record<string, unknown> = (() => {
    const { side, port, label, multiple, ...rest } = _props as HandleProps & Record<string, unknown>;
    void side; void port; void label; void multiple;
    return rest;
  })();
  const nd = useRef<any>(null);
  const added = useRef(false);

  nd.current = node;

  // idempotency flag so the $onMount addPort and the late-context $onUpdate path
  // (Lit async, REQ-30) never double-add the port. (FlowCanvas.addPort is also
  // de-duped, so this is belt-and-suspenders.)

  useEffect(() => {
    // register this port against the enclosing node's id+side; the parent's
    // reconcileNodes re-runs buildNode with the updated input/output spec. On Lit
    // the injected node ctx may still be undefined here (async context, REQ-30) —
    // the $onUpdate below adds the port once it resolves.
    if (nd.current && !added.current) {
      added.current = true;
      nd.current.addPort(props.side, props.port, props.label, props.multiple);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (added.current) return;
    const live = node;
    if (live == null) return;
    nd.current = live;
    added.current = true;
    nd.current.addPort(props.side, props.port, props.label, props.multiple);
  }, [added, nd, node, props.label, props.multiple, props.port, props.side]);

  return (
    null
  );
}
