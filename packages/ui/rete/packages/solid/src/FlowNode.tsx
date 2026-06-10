import type { JSX } from 'solid-js';
import { createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack, useContext } from 'solid-js';
import { render } from 'solid-js/web';
import { rozieContext } from '@rozie/runtime-solid';

interface BodySlotCtx { id: any; label: any; }

interface FlowNodeProps {
  id: string;
  x?: number;
  y?: number;
  label?: unknown;
  bodySlot?: (ctx: () => BodySlotCtx) => JSX.Element;
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
  interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portalDisposers = new Set<() => void>();
  const portals = {
    body: (container: HTMLElement, scope: { id: unknown; label: unknown }): ReactivePortalHandle => {
      const slot = _props.bodySlot ?? _props.slots?.['body'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-body', '23c15996');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig as unknown as (() => { id: unknown; label: unknown })), container);
      portalDisposers.add(dispose);
      return {
        update: (s: unknown): void => {
          setScopeSig(s);
        },
        dispose: (): void => {
          dispose();
          portalDisposers.delete(dispose);
        },
      };
    },
  };
  onCleanup(() => {
    for (const dispose of portalDisposers) dispose();
    portalDisposers.clear();
  });
  onMount(() => {
    const _cleanup = (() => {
    // The body-mount closure — captures the mount-scoped `portals` local. Disposes a
    // prior handle first so a re-fired renderBody (e.g. ports changed → fresh node
    // build) does not stack portal roots into the same engine host.
    mountBody = (host: any) => {
      if (!host) return;
      if (bodyHandle && bodyHandle.dispose) {
        try {
          bodyHandle.dispose();
        } catch (e: any) {}
      }
      bodyHandle = portals.body(host, {
        id: local.id,
        label: local.label
      });
    };
    // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
    // builds the engine node, then renderNode invokes renderBody(body) — at which point
    // the FlowNode mounts its own body portal into the engine `body` host.
    // On Lit the injected canvas may still be undefined here (REQ-30 async context);
    // the $onUpdate below performs the registration once the value arrives.
    if (cv && !registered) {
      registered = true;
      cv.register(local.id, buildSpec());
    }
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    if (bodyHandle && bodyHandle.dispose) {
      try {
        bodyHandle.dispose();
      } catch (e: any) {}
    }
    if (cv) cv.unregister(local.id);
  });
  });
  createEffect(() => {
    if (registered) return;
    const live = canvas;
    if (live == null) return;
    cv = live;
    registered = true;
    cv.register(local.id, buildSpec());
  });
  createEffect(on(() => (() => local.x)(), (v) => untrack(() => (() => {
    if (cv) cv.update(local.id, buildSpec());
  })()), { defer: true }));
  createEffect(on(() => (() => local.y)(), (v) => untrack(() => (() => {
    if (cv) cv.update(local.id, buildSpec());
  })()), { defer: true }));
  createEffect(on(() => (() => local.label)(), (v) => untrack(() => (() => {
    if (cv) cv.update(local.id, buildSpec());
  })()), { defer: true }));

  // $inject is typed `unknown` (Phase 36 D-4: no rich type synthesis yet), which the
  // STRICT BUNDLED-LEAF tsc rejects on `.register(...)` (TS2339). The .rozie-native
  // fix is the null-let → `any` typeNeutralize idiom: alias the injected API through
  // a MODULE-SCOPE `let cv = null` (typeNeutralize types it `any`). Module-scope (not
  // hook-local) so the alias is in scope from the Solid teardown — which the Solid
  // emitter hoists into a sibling onCleanup() OUTSIDE the mount closure (the MapLibre
  // Source/Layer lesson). ZERO emitter change.
  let cv: any = null;
  cv = canvas;

  // The live $portals.body handle ({ dispose }) returned by the parent-invoked
  // renderBody callback. Module-scope `any` so the teardown — which the Solid emitter
  // hoists into a sibling onCleanup() OUTSIDE the mount closure — can dispose it.
  let bodyHandle: any = null;

  // The body-mount closure, DEFINED INSIDE $onMount (below) so it captures the
  // emitter-synthesized `portals` local — which on React/Angular/Lit is scoped to the
  // mount effect body, NOT visible from a spec callback the PARENT invokes later (that
  // escaped scope is exactly why a bare `$portals.body(...)` in the renderBody callback
  // threw "portals is not defined" on those 3 targets). Stored in a module-scope `any`
  // so the spec's renderBody — invoked by the parent's renderNode from the parent's own
  // render scope — can delegate to it. ZERO emitter change (just correct scoping).
  let mountBody: any = null;

  // idempotency flag so a reactive late-context registration (Lit async first
  // paint, REQ-30) and the $onMount registration never double-register the node.
  let registered = false;

  // the canvas spec builder — shared by the $onMount register and the late-context
  // $onUpdate below. The renderBody render-callback is invoked by the PARENT's
  // renderNode from the parent's own render scope with the engine `body` host div; the
  // FlowNode then mounts its OWN `body` portal slot INTO that host via $portals.body —
  // reusing the shipped reactive-portal machinery (6/6 green on the config-array
  // `#node` path). NO framework DOM is relocated. Re-supplied on every register/update
  // so a re-render re-projects the body into the (same) host idempotently.
  function buildSpec() {
    return {
      id: local.id,
      x: local.x,
      y: local.y,
      label: local.label,
      inputs: [],
      outputs: [],
      // D-04 render-callback: the parent hands the engine body host; delegate to the
      // mountBody closure (defined inside $onMount so it can see the emitter's mount-
      // scoped `portals` local). Until $onMount has run, mountBody is null — but the
      // parent only invokes renderBody AFTER reconcileNodes (post-register, post-mount),
      // so mountBody is always set by then.
      renderBody: (host: any) => {
        // try/catch so a per-target portal-render hiccup (e.g. a Lit lit-html
        // "cannot find node" when re-rendering into an engine-owned host that the area
        // re-created) can NEVER abort the parent's reconcileNodes loop — a thrown
        // renderBody would propagate out of area.update/addNode and stop the whole graph
        // from building (cfg renders, the declarative nodes don't). The body simply
        // re-mounts on the next reconcile tick if a single attempt fails.
        if (host && mountBody) {
          try {
            mountBody(host);
          } catch (e: any) {}
        }
      }
    };
  }

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



    <div class={"rozie-flow-node-children"} style={{ display: "none" }} data-rozie-s-23c15996="">{resolved()}</div>
    </>
    </__ctx_rete_node.Provider>
  );
}
