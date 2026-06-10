import type { JSX } from 'solid-js';
import { mergeProps, onMount, splitProps, useContext } from 'solid-js';
import { rozieContext } from '@rozie/runtime-solid';

interface HandleProps {
  side?: string;
  port: string;
  label?: unknown;
  multiple?: unknown;
}

export default function Handle(_props: HandleProps): JSX.Element {
  const _merged = mergeProps({ side: 'output', label: undefined, multiple: undefined }, _props);
  const [local, attrs] = splitProps(_merged, ['side', 'port', 'label', 'multiple']);

  const node = useContext(rozieContext("rete:node"));
  onMount(() => {
    // register this port against the enclosing node's id+side; the parent's
    // reconcileNodes re-runs buildNode with the updated input/output spec.
    if (nd) nd.addPort(local.side, local.port, local.label, local.multiple);
  });

  // $inject is typed `unknown` (Phase 36 D-4), which the STRICT BUNDLED-LEAF tsc
  // rejects on `.addPort(...)` (TS2339). The .rozie-native fix is the null-let → `any`
  // typeNeutralize idiom: alias through a MODULE-SCOPE `let nd = null` so it is in
  // scope from the Solid hoisted onCleanup teardown (the MapLibre Source/Layer
  // lesson). ZERO emitter change.
  let nd: any = null;
  nd = node;

  return (
    null
  );
}
