import { useCallback, useContext, useEffect, useRef } from 'react';
import { rozieContext } from '@rozie/runtime-react';

interface PortProps {
  /**
   * Declares an OUTPUT port and names its key — set this (not `input`) so the port direction resolves to `output`. The attribute is `output`, not `out`: `out`/`in` are awkward bare identifiers, so `output`/`input` are used across all six targets.
   * @example
   * <Port output="num" type="number" />
   */
  output?: string;
  /**
   * Declares an INPUT port and names its key — set this (not `output`) so the port direction resolves to `input`. The attribute is `input`, not `in`: `in` is a JS reserved word that Svelte's mandatory `$props()` destructure rejects, so `input`/`output` are used instead.
   */
  input?: string;
  /**
   * The port TYPE — drives the canvas's typed-socket `:validate-types` (a type-mismatched connection is auto-rejected). It is the typed layer, NOT socket identity (a single shared Socket gates identity). Optional: an untyped port imposes no type constraint and connects to anything.
   */
  type?: string;
  /**
   * Optional socket label shown next to the port (defaults to the port key when omitted).
   */
  label?: string;
  /**
   * Allow multiple connections into/out of this socket. Left undefined by default to preserve the canvas's side asymmetry: outputs default to multi, inputs default to single. To force an explicit multi input, use the bare `multiple` attribute (`<Port ... multiple />`) — it resolves to `true` on all six targets.
   */
  multiple?: unknown;
  /**
   * Visual placement of the socket on the node: `left`, `right`, `top`, or `bottom`. Defaults by direction (input → left, output → right). `top`/`bottom` enable vertical flows (decision trees, top-down pipelines) — the canvas lays the socket out on that edge and the connection anchor shifts onto the matching axis.
   */
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
