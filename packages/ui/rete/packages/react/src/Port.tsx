import { useCallback, useContext, useEffect, useRef } from 'react';
import { rozieContext } from '@rozie/runtime-react';

interface PortProps {
  output?: string;
  input?: string;
  type?: string;
  label?: string;
  multiple?: unknown;
  position?: string;
}

export default function Port(_props: PortProps): JSX.Element {
  const injectedType = useContext(rozieContext("rete:nodeType"));
  const props: Omit<PortProps, 'output' | 'input' | 'type' | 'label' | 'multiple' | 'position'> & { output: string; input: string; type: string; label: string; multiple: unknown; position: string } = {
    ..._props,
    output: _props.output ?? undefined,
    input: _props.input ?? undefined,
    type: _props.type ?? undefined,
    label: _props.label ?? undefined,
    multiple: _props.multiple ?? undefined,
    position: _props.position ?? undefined,
  };
  const nt = useRef<any>(null);
  const added = useRef(false);

  nt.current = injectedType;

  // Derive side + key from which of output=/input= is set. output wins if both are
  // (mis)set. `output`/`input` are ordinary identifiers (NOT reserved words) so they
  // read normally — no member-access-only workaround needed. null key (neither set) ⇒
  // addPort no-ops on the canvas side (key == null guard).
  const portSide = useCallback(() => props.output != null ? 'output' : 'input', [props.output]);
  const portKey = useCallback(() => props.output != null ? props.output : props.input, [props.input, props.output]);

  useEffect(() => {
    // register this typed port against the enclosing node TYPE's schema; the canvas's
    // reconcileNodes builds buildNode with the updated input/output spec for every node
    // of that type. On Lit the injected nodeType ctx may still be undefined here (async
    // context, REQ-30) — the $onUpdate below adds the port once it resolves.
    if (nt.current && !added.current) {
      added.current = true;
      nt.current.addPort(portSide(), portKey(), props.type, props.label, props.multiple, props.position);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (added.current) return;
    const live = injectedType;
    if (live == null) return;
    nt.current = live;
    added.current = true;
    nt.current.addPort(portSide(), portKey(), props.type, props.label, props.multiple, props.position);
  }, [added, injectedType, nt, portKey, portSide, props.label, props.multiple, props.position, props.type]);

  return (
    null
  );
}
