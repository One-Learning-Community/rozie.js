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

  nd.current = node;

  useEffect(() => {
    // register this port against the enclosing node's id+side; the parent's
    // reconcileNodes re-runs buildNode with the updated input/output spec.
    if (nd.current) nd.current.addPort(props.side, props.port, props.label, props.multiple);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    null
  );
}
