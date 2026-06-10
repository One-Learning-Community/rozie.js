import type { JSX } from 'solid-js';
import { createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack, useContext } from 'solid-js';
import { rozieContext } from '@rozie/runtime-solid';

interface FlowNodeProps {
  id: string;
  x?: number;
  y?: number;
  label?: unknown;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function FlowNode(_props: FlowNodeProps): JSX.Element {
  const _merged = mergeProps({ x: 0, y: 0, label: undefined }, _props);
  const [local, attrs] = splitProps(_merged, ['id', 'x', 'y', 'label', 'children']);
  const resolved = () => local.children;

  const canvas = useContext(rozieContext("rete:canvas"));
  const __ctx_rete_node = rozieContext("rete:node");
  onMount(() => {
    const _cleanup = (() => {
    hostEl = __rozieRootRef!;
    // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
    // builds the engine node, then renderNode invokes renderBody(body) — projecting
    // this FlowNode's body into the engine element from the PARENT's render scope.
    if (cv) {
      cv.register(local.id, {
        id: local.id,
        x: local.x,
        y: local.y,
        label: local.label,
        inputs: [],
        outputs: [],
        // D-04 render-callback: the parent calls this with the engine body host div.
        renderBody: (host: any) => {
          if (host && hostEl) host.appendChild(hostEl);
        }
      });
    }
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    if (cv) cv.unregister(local.id);
  });
  });
  createEffect(on(() => (() => local.x)(), (v) => untrack(() => (() => {
    if (cv) cv.update(local.id, {
      id: local.id,
      x: local.x,
      y: local.y,
      label: local.label,
      renderBody: (host: any) => {
        if (host && hostEl) host.appendChild(hostEl);
      }
    });
  })()), { defer: true }));
  createEffect(on(() => (() => local.y)(), (v) => untrack(() => (() => {
    if (cv) cv.update(local.id, {
      id: local.id,
      x: local.x,
      y: local.y,
      label: local.label,
      renderBody: (host: any) => {
        if (host && hostEl) host.appendChild(hostEl);
      }
    });
  })()), { defer: true }));
  createEffect(on(() => (() => local.label)(), (v) => untrack(() => (() => {
    if (cv) cv.update(local.id, {
      id: local.id,
      x: local.x,
      y: local.y,
      label: local.label,
      renderBody: (host: any) => {
        if (host && hostEl) host.appendChild(hostEl);
      }
    });
  })()), { defer: true }));
  let __rozieRootRef: HTMLElement | null = null;

  // $inject is typed `unknown` (Phase 36 D-4: no rich type synthesis yet), which the
  // STRICT BUNDLED-LEAF tsc rejects on `.register(...)` (TS2339). The .rozie-native
  // fix is the null-let → `any` typeNeutralize idiom: alias the injected API through
  // a MODULE-SCOPE `let cv = null` (typeNeutralize types it `any`). Module-scope (not
  // hook-local) so the alias is in scope from the Solid teardown — which the Solid
  // emitter hoists into a sibling onCleanup() OUTSIDE the mount closure (the MapLibre
  // Source/Layer lesson). ZERO emitter change.
  let cv: any = null;
  cv = canvas;

  // The FlowNode's own host element, captured at mount ($el only safe in $onMount,
  // ROZ123). The parent-invoked renderBody closure appends THIS into the engine
  // `body` host — moving the host preserves Lit shadow projection of the slot body.
  // Module-scope `any` so it survives into the parent's later render-scope call.
  let hostEl: any = null;

  return (
    <__ctx_rete_node.Provider value={{
  get id() {
    return local.id;
  },
  addPort: (side: any, key: any, label: any, multiple: any) => {
    if (cv) cv.addPort(local.id, side, key, label, multiple);
  }
}}>
    <>

    <div ref={(el) => { __rozieRootRef = el as HTMLElement; }} {...attrs} class={"rozie-flow-node-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-23c15996="">{resolved()}</div>
    </>
    </__ctx_rete_node.Provider>
  );
}
