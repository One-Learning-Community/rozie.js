import type { JSX } from 'solid-js';
import { createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack, useContext } from 'solid-js';
import { render } from 'solid-js/web';
import { rozieContext } from '@rozie/runtime-solid';

interface BodySlotCtx { node: any; selected: any; emit: any; }

interface NodeTypeProps {
  /**
   * The node TYPE id (required). Every graph node whose `type` matches renders this template and uses this type's `<Port>` schema. There is no id/x/y here — this is a render-by-type TEMPLATE, not an instance; instance identity and position live in the bound `graph` model.
   * @example
   * <NodeType type="source"><Port output="num" type="number" /></NodeType>
   */
  type: string;
  /**
   * Opt this node TYPE into corner-handle resizing (default OFF). When true, selecting a node of this type shows 4 corner drag handles (the React Flow <NodeResizer/> parity); dragging one persists an explicit node.width/node.height (a fixed box, D-07) that overrides auto-sizing for that node instance. A double-click on a handle resets the node back to auto-size.
   */
  resizable?: boolean;
  /**
   * Fixed width (px) for EVERY node of this type — the design-consistency knob, so a node does not resize as its `#body` content changes. Unset (the default) auto-sizes to the body. A node instance's own `width` in the bound graph (what a `resizable` corner-drag persists) overrides this; `minWidth`/`maxWidth` clamp whichever wins. An explicit width also lowers the default 140px node floor, so a value below it renders as authored.
   * @example
   * <NodeType type="task" width={240}><Port output="out" /></NodeType>
   */
  width?: (number) | null;
  /**
   * Fixed height (px) for EVERY node of this type. Unset (the default) auto-sizes to the body. Same precedence as `width`: a node instance's own `height` overrides it, and `minHeight`/`maxHeight` clamp the result.
   * @example
   * <NodeType type="task" height={120}><Port output="out" /></NodeType>
   */
  height?: (number) | null;
  /**
   * Minimum width (px) for this type. Clamps the RENDERED box whatever its size came from — auto-sized body content, an authored `width`, or a resize gesture — and bounds how far a corner-drag may shrink it. Falls back to a small sane default (~40px) if resizable is true and this is unset, so a node can never be dragged to 0px.
   */
  minWidth?: (number) | null;
  /**
   * Minimum height (px) for this type. Clamps the RENDERED box whatever its size came from, and bounds how far a corner-drag may shrink it. Falls back to a small sane default (~40px) if resizable is true and this is unset, so a node can never be dragged to 0px.
   */
  minHeight?: (number) | null;
  /**
   * Maximum width (px) for this type. Clamps the RENDERED box whatever its size came from — auto-sized body content, an authored `width`, or a resize gesture — so body content can never stretch a node past it. Unset = unbounded.
   */
  maxWidth?: (number) | null;
  /**
   * Maximum height (px) for this type. Clamps the RENDERED box whatever its size came from, so body content can never stretch a node past it. Unset = unbounded.
   */
  maxHeight?: (number) | null;
  bodySlot?: (ctx: () => BodySlotCtx) => JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function NodeType(_props: NodeTypeProps): JSX.Element {
  const _merged = mergeProps({ resizable: false, width: null, height: null, minWidth: null, minHeight: null, maxWidth: null, maxHeight: null }, _props);
  const [local, attrs] = splitProps(_merged, ['type', 'resizable', 'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'children']);
  const resolved = () => local.children;

  const canvas = useContext(rozieContext("rete:canvas"));
  const __ctx_rete_nodeType = rozieContext("rete:nodeType");
  interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portalDisposers = new Set<() => void>();
  const portals = {
    body: (container: HTMLElement, scope: { node: unknown; selected: unknown; emit: unknown }): ReactivePortalHandle => {
      const slot = _props.bodySlot ?? _props.slots?.['body'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-body', '372f9492');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig as unknown as (() => { node: unknown; selected: unknown; emit: unknown })), container);
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
    // register this TYPE's spec INCLUDING the bodyRenderer callback. The canvas's
    // renderNode resolves typeReg[node.type].bodyRenderer for every graph node of this
    // type and projects the body into the engine host. On Lit the injected canvas may
    // still be undefined here (REQ-30 async context); the $onUpdate below performs the
    // registration once the value arrives.
    if (cv && !registered) {
      registered = true;
      cv.registerType(local.type, buildSpec());
    }
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    // sweep any body projections still live at teardown (the canvas normally disposes
    // each per node unmount, but a component-level unmount must clean any stragglers).
    if (bodyHandles) {
      for (const h of bodyHandles as any) {
        if (h && h.dispose) {
          try {
            h.dispose();
          } catch (e: any) {}
        }
      }
      bodyHandles.clear();
    }
    if (cv) cv.unregisterType(local.type);
  });
  });
  createEffect(() => {
    if (registered) return;
    const live = canvas;
    if (live == null) return;
    cv = live;
    registered = true;
    cv.registerType(local.type, buildSpec());
  });
  createEffect(on(() => (() => local.type)(), (v) => untrack(() => (() => {
    if (cv) cv.registerType(local.type, buildSpec());
  })()), { defer: true }));

  // $inject is typed `unknown` (Phase 36 D-4: no rich type synthesis yet), which the
  // STRICT BUNDLED-LEAF tsc rejects on `.registerType(...)` (TS2339). The .rozie-native
  // fix is the null-let → `any` typeNeutralize idiom: alias the injected API through
  // a MODULE-SCOPE `let cv = null` (typeNeutralize types it `any`). Module-scope (not
  // hook-local) so the alias is in scope from the Solid teardown — which the Solid
  // emitter hoists into a sibling onCleanup() OUTSIDE the mount closure (the MapLibre
  // Source/Layer lesson). ZERO emitter change.
  let cv: any = null;
  cv = canvas;

  // The live $portals.body handle ({ dispose }) returned by the parent-invoked
  // bodyRenderer callback. Module-scope `any` so the teardown — which the Solid
  // emitter hoists into a sibling onCleanup() OUTSIDE the mount closure — can dispose
  // it. (A NodeType type-template projects ONE body root per graph node; the canvas
  // disposes per-node on node unmount, this is the last-projection handle.)
  //
  // PER-NODE FIX: a Set of INDEPENDENT handles — ONE PER GRAPH NODE of this type.
  // render-by-type calls bodyRenderer once per node a->b->c; the old single-handle
  // form disposed the PRIOR node's body on each call, leaving only the LAST node of
  // the type rendered (3 nodes, 1 body — the count-only-VR-masking bug). Each call now
  // mounts an INDEPENDENT handle and disposes NONE of its siblings; the canvas already
  // owns per-node disposal (entry.bodyHandle in nodeEntries, torn down on node unmount).
  // Module-scope `any` so the Solid-hoisted teardown can sweep any leftovers. This is
  // the controlled-graph analog of FlowCanvas's per-node $portals.node handle map.
  let bodyHandles: any = null;
  bodyHandles = new Set();

  // The body-mount closure. Mounts an INDEPENDENT body root PER graph node (the
  // canvas calls this once per node of the type), so every instance keeps its OWN
  // #body — it must NOT dispose any sibling's handle (the bug: a single shared
  // handle torn down on each call left only the LAST node rendered). Each returned
  // { dispose } is wrapped to deregister ITSELF from `bodyHandles` when the canvas
  // disposes that node's projection (entry.bodyHandle on node unmount / port-resync);
  // a leftover handle is swept by the component teardown in $onMount. Historically
  // this closure was DEFINED INSIDE $onMount as a bridge for a mount-scoped `portals`
  // local on React/Angular/Lit — quick 260829-gbs removed that bridge after quick
  // 260829-cd4 hoisted the portals closure to component scope on all six targets, so
  // `$portals.body` now resolves correctly from this top-level closure directly.
  function mountBody(host: any, scope: any) {
    if (!host) return null;
    const s = scope || {};
    const h = portals.body(host, {
      node: s.node,
      selected: s.selected,
      emit: s.emit
    });
    if (!h) return null;
    bodyHandles.add(h);
    return {
      update: (next: any) => {
        if (h && h.update) {
          try {
            return h.update(next);
          } catch (e: any) {}
        }
      },
      dispose: () => {
        bodyHandles.delete(h);
        if (h && h.dispose) {
          try {
            h.dispose();
          } catch (e: any) {}
        }
      }
    };
  }

  // idempotency flag so a reactive late-context registration (Lit async first
  // paint, REQ-30) and the $onMount registration never double-register the type.
  let registered = false;

  // the canvas TYPE spec builder — shared by the $onMount register and the late-context
  // $onUpdate below. The bodyRenderer render-callback is invoked by the canvas's
  // renderNode (per graph node of this type) from the canvas's own render scope with
  // the engine `body` host div + the { node, selected, emit } scope; the NodeType then
  // mounts its OWN `body` portal slot INTO that host via $portals.body — reusing the
  // shipped reactive-portal machinery (6/6 green on the config-array `node` path). NO
  // framework DOM is relocated. Returns { dispose } so the canvas can tear the body
  // projection down on node unmount / port-resync.
  function buildSpec() {
    return {
      type: local.type,
      // RENDER-BY-TYPE callback: the canvas hands the engine body host + scope; delegate
      // to the top-level mountBody closure. Returns the { dispose } handle.
      bodyRenderer: (host: any, scope: any) => {
        // try/catch so a per-target portal-render hiccup (e.g. a Lit lit-html "cannot
        // find node" when re-rendering into an engine-owned host the area re-created)
        // can NEVER abort the canvas's renderNode loop — a thrown bodyRenderer would
        // propagate out of area.update/addNode and stop the whole graph from building.
        if (host) {
          try {
            return mountBody(host, scope);
          } catch (e: any) {}
        }
        return null;
      },
      // NodeResizer (D-14/D-17): carried into the canvas's typeReg registry so
      // renderNode/the resize gesture can read resizable/min/max for this type.
      resizable: local.resizable,
      // 260825-mip: the type-level authored box, read by renderNode's resolveNodeBox.
      width: local.width,
      height: local.height,
      minWidth: local.minWidth,
      minHeight: local.minHeight,
      maxWidth: local.maxWidth,
      maxHeight: local.maxHeight
    };
  }

  return (
    <__ctx_rete_nodeType.Provider value={{
  get type() {
    return local.type;
  },
  addPort: (side: any, key: any, portType: any, label: any, multiple: any, position: any) => {
    if (cv) cv.addTypePort(local.type, side, key, portType, label, multiple, position);
  }
}}>
    <>



    <div class={"rozie-node-type-children"} style={{ display: "none" }} data-rozie-s-372f9492="">{resolved()}</div>
    </>
    </__ctx_rete_nodeType.Provider>
  );
}
