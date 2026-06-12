import type { JSX } from 'solid-js';
import { createEffect, mergeProps, onMount, splitProps, useContext } from 'solid-js';
import { rozieContext } from '@rozie/runtime-solid';

interface PortProps {
  output?: string;
  input?: string;
  type?: string;
  label?: string;
  multiple?: unknown;
  position?: string;
}

export default function Port(_props: PortProps): JSX.Element {
  const _merged = mergeProps({ output: undefined, input: undefined, type: undefined, label: undefined, multiple: undefined, position: undefined }, _props);
  const [local, attrs] = splitProps(_merged, ['output', 'input', 'type', 'label', 'multiple', 'position']);

  const injectedType = useContext(rozieContext("rete:nodeType"));
  onMount(() => {
    // register this typed port against the enclosing node TYPE's schema; the canvas's
    // reconcileNodes builds buildNode with the updated input/output spec for every node
    // of that type. On Lit the injected nodeType ctx may still be undefined here (async
    // context, REQ-30) — the $onUpdate below adds the port once it resolves.
    if (nt && !added) {
      added = true;
      nt.addPort(portSide(), portKey(), local.type, local.label, local.multiple, local.position);
    }
  });
  createEffect(() => {
    if (added) return;
    const live = injectedType;
    if (live == null) return;
    nt = live;
    added = true;
    nt.addPort(portSide(), portKey(), local.type, local.label, local.multiple, local.position);
  });

  // $inject is typed `unknown` (Phase 36 D-4), which the STRICT BUNDLED-LEAF tsc
  // rejects on `.addPort(...)` (TS2339). The .rozie-native fix is the null-let → `any`
  // typeNeutralize idiom: alias through a MODULE-SCOPE `let nt = null` so it is in
  // scope from the Solid hoisted onCleanup teardown (the MapLibre Source/Layer
  // lesson). ZERO emitter change.
  let nt: any = null;
  nt = injectedType;

  // Derive side + key from which of output=/input= is set. output wins if both are
  // (mis)set. `output`/`input` are ordinary identifiers (NOT reserved words) so they
  // read normally — no member-access-only workaround needed. null key (neither set) ⇒
  // addPort no-ops on the canvas side (key == null guard).
  function portSide() {
    return local.output != null ? 'output' : 'input';
  }
  function portKey() {
    return local.output != null ? local.output : local.input;
  }

  // idempotency flag so the $onMount addPort and the late-context $onUpdate path
  // (Lit async, REQ-30) never double-add the port. (addTypePort is also idempotent —
  // same `type::side::key` key, same value — so this is belt-and-suspenders.)
  let added = false;

  return (
    null
  );
}
