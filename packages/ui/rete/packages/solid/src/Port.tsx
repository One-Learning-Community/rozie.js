import type { JSX } from 'solid-js';
import { createEffect, mergeProps, onMount, splitProps, useContext } from 'solid-js';
import { rozieContext } from '@rozie/runtime-solid';

interface PortProps {
  out?: string;
  in?: string;
  type?: string;
  label?: unknown;
  multiple?: unknown;
}

export default function Port(_props: PortProps): JSX.Element {
  const _merged = mergeProps({ out: undefined, in: undefined, type: undefined, label: undefined, multiple: undefined }, _props);
  const [local, attrs] = splitProps(_merged, ['out', 'in', 'type', 'label', 'multiple']);

  const injectedType = useContext(rozieContext("rete:nodeType"));
  onMount(() => {
    // register this typed port against the enclosing node TYPE's schema; the canvas's
    // reconcileNodes builds buildNode with the updated input/output spec for every node
    // of that type. On Lit the injected nodeType ctx may still be undefined here (async
    // context, REQ-30) — the $onUpdate below adds the port once it resolves.
    if (nt && !added) {
      added = true;
      nt.addPort(portSide(), portKey(), local.type, local.label, local.multiple);
    }
  });
  createEffect(() => {
    if (added) return;
    const live = injectedType;
    if (live == null) return;
    nt = live;
    added = true;
    nt.addPort(portSide(), portKey(), local.type, local.label, local.multiple);
  });

  // $inject is typed `unknown` (Phase 36 D-4), which the STRICT BUNDLED-LEAF tsc
  // rejects on `.addPort(...)` (TS2339). The .rozie-native fix is the null-let → `any`
  // typeNeutralize idiom: alias through a MODULE-SCOPE `let nt = null` so it is in
  // scope from the Solid hoisted onCleanup teardown (the MapLibre Source/Layer
  // lesson). ZERO emitter change.
  let nt: any = null;
  nt = injectedType;

  // Derive side + key from which of out=/in= is set. out wins if both are (mis)set;
  // `in` is read ONLY via $props.in (reserved word — never destructured bare). null
  // key (neither set) ⇒ addPort no-ops on the canvas side (key == null guard).
  function portSide() {
    return local.out != null ? 'output' : 'input';
  }
  function portKey() {
    return local.out != null ? local.out : local.in;
  }

  // idempotency flag so the $onMount addPort and the late-context $onUpdate path
  // (Lit async, REQ-30) never double-add the port. (addTypePort is also idempotent —
  // same `type::side::key` key, same value — so this is belt-and-suspenders.)
  let added = false;

  return (
    null
  );
}
