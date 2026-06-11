import { useCallback, useContext, useEffect, useRef } from 'react';
import { rozieContext } from '@rozie/runtime-react';

interface PortProps {
  out?: string;
  in?: string;
  type?: string;
  label?: unknown;
  multiple?: unknown;
}

export default function Port(_props: PortProps): JSX.Element {
  const injectedType = useContext(rozieContext("rete:nodeType"));
  const props: Omit<PortProps, 'out' | 'in' | 'type' | 'label' | 'multiple'> & { out: string; in: string; type: string; label: unknown; multiple: unknown } = {
    ..._props,
    out: _props.out ?? undefined,
    in: _props.in ?? undefined,
    type: _props.type ?? undefined,
    label: _props.label ?? undefined,
    multiple: _props.multiple ?? undefined,
  };
  const nt = useRef<any>(null);
  const added = useRef(false);

  nt.current = injectedType;

  // Derive side + key from which of out=/in= is set. out wins if both are (mis)set;
  // `in` is read ONLY via $props.in (reserved word — never destructured bare). null
  // key (neither set) ⇒ addPort no-ops on the canvas side (key == null guard).
  const portSide = useCallback(() => props.out != null ? 'output' : 'input', [props.out]);
  const portKey = useCallback(() => props.out != null ? props.out : props.in, [props.in, props.out]);

  useEffect(() => {
    // register this typed port against the enclosing node TYPE's schema; the canvas's
    // reconcileNodes builds buildNode with the updated input/output spec for every node
    // of that type. On Lit the injected nodeType ctx may still be undefined here (async
    // context, REQ-30) — the $onUpdate below adds the port once it resolves.
    if (nt.current && !added.current) {
      added.current = true;
      nt.current.addPort(portSide(), portKey(), props.type, props.label, props.multiple);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (added.current) return;
    const live = injectedType;
    if (live == null) return;
    nt.current = live;
    added.current = true;
    nt.current.addPort(portSide(), portKey(), props.type, props.label, props.multiple);
  }, [added, injectedType, nt, portKey, portSide, props.label, props.multiple, props.type]);

  return (
    null
  );
}
