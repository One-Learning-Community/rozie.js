import { useCallback, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { rozieContext } from '@rozie/runtime-react';

interface BodyCtx { node: any; selected: any; emit: any; }

interface NodeTypeProps {
  /**
   * The node TYPE id (required). Every graph node whose `type` matches renders this template and uses this type's `<Port>` schema. There is no id/x/y here — this is a render-by-type TEMPLATE, not an instance; instance identity and position live in the bound `graph` model.
   * @example
   * <NodeType type="source"><template #body="{ node }">{{ node.data.label }}</template></NodeType>
   */
  type: string;
  /**
   * Opt this node TYPE into corner-handle resizing (default OFF). When true, selecting a node of this type shows 4 corner drag handles (the React Flow <NodeResizer/> parity); dragging one persists an explicit node.width/node.height (a fixed box, D-07) that overrides auto-sizing for that node instance. A double-click on a handle resets the node back to auto-size.
   */
  resizable?: boolean;
  /**
   * Minimum width (px) a resize gesture may shrink this type to. Falls back to a small sane default (~40px) if resizable is true and this is unset, so a node can never be dragged to 0px.
   */
  minWidth?: (number) | null;
  /**
   * Minimum height (px) a resize gesture may shrink this type to. Falls back to a small sane default (~40px) if resizable is true and this is unset, so a node can never be dragged to 0px.
   */
  minHeight?: (number) | null;
  /**
   * Maximum width (px) a resize gesture may grow this type to. Unset = unbounded growth.
   */
  maxWidth?: (number) | null;
  /**
   * Maximum height (px) a resize gesture may grow this type to. Unset = unbounded growth.
   */
  maxHeight?: (number) | null;
  renderBody?: (ctx: BodyCtx) => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function NodeType(_props: NodeTypeProps): JSX.Element {
  const canvas = useContext(rozieContext("rete:canvas"));
  const __ctx_rete_nodeType = rozieContext("rete:nodeType");
  const portalRoots = useRef<Set<Root>>(new Set());
  const props: Omit<NodeTypeProps, 'resizable' | 'minWidth' | 'minHeight' | 'maxWidth' | 'maxHeight'> & { resizable: boolean; minWidth: (number) | null; minHeight: (number) | null; maxWidth: (number) | null; maxHeight: (number) | null } = {
    ..._props,
    resizable: _props.resizable ?? false,
    minWidth: _props.minWidth ?? null,
    minHeight: _props.minHeight ?? null,
    maxWidth: _props.maxWidth ?? null,
    maxHeight: _props.maxHeight ?? null,
  };
  const _renderBodyRef = useRef(props.renderBody);
  _renderBodyRef.current = props.renderBody;
  const mountBody = useRef<any>(null);
  const bodyHandles = useRef<any>(null);
  const cv = useRef<any>(null);
  const registered = useRef(false);
  const _typeRef = useRef(props.type);
  _typeRef.current = props.type;
  const _watch0First = useRef(true);

  cv.current = canvas;

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
  bodyHandles.current = new Set();

  // The body-mount closure, DEFINED INSIDE $onMount (below) so it captures the
  // emitter-synthesized `portals` local — which on React/Angular/Lit is scoped to the
  // mount effect body, NOT visible from a spec callback the canvas invokes later (that
  // escaped scope is exactly why a bare `$portals.body(...)` in the bodyRenderer
  // threw "portals is not defined" on those 3 targets). Stored in a module-scope `any`
  // so the spec's bodyRenderer — invoked by the canvas's renderNode from its own
  // render scope — can delegate to it. ZERO emitter change (just correct scoping).
  const buildSpec = useCallback(() => ({
    type: props.type,
    // RENDER-BY-TYPE callback: the canvas hands the engine body host + scope; delegate
    // to the mountBody closure (defined inside $onMount so it can see the emitter's
    // mount-scoped `portals` local). Until $onMount has run, mountBody is null — but
    // the canvas only invokes bodyRenderer AFTER reconcileNodes (post-register,
    // post-mount), so mountBody is always set by then. Returns the { dispose } handle.
    bodyRenderer: (host: any, scope: any) => {
      // try/catch so a per-target portal-render hiccup (e.g. a Lit lit-html "cannot
      // find node" when re-rendering into an engine-owned host the area re-created)
      // can NEVER abort the canvas's renderNode loop — a thrown bodyRenderer would
      // propagate out of area.update/addNode and stop the whole graph from building.
      if (host && mountBody.current) {
        try {
          return mountBody.current(host, scope);
        } catch (e: any) {}
      }
      return null;
    },
    // NodeResizer (D-14/D-17): carried into the canvas's typeReg registry so
    // renderNode/the resize gesture can read resizable/min/max for this type.
    resizable: props.resizable,
    minWidth: props.minWidth,
    minHeight: props.minHeight,
    maxWidth: props.maxWidth,
    maxHeight: props.maxHeight
  }), [props.maxHeight, props.maxWidth, props.minHeight, props.minWidth, props.resizable, props.type]);

  useEffect(() => {
    interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portals = {
    body: (container: HTMLElement, scope: { node: unknown; selected: unknown; emit: unknown }): ReactivePortalHandle => {
      const slot = _renderBodyRef.current ?? props.slots?.['body'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal body { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-body', '372f9492');
      const root = createRoot(container);
      const renderScope = (s: { node: unknown; selected: unknown; emit: unknown }): void => {
        flushSync(() => root.render(slot(s)));
      };
      renderScope(scope);
      portalRoots.current.add(root);
      return {
        update: (s: { node: unknown; selected: unknown; emit: unknown }): void => renderScope(s),
        dispose: (): void => {
          root.unmount();
          portalRoots.current.delete(root);
        },
      };
    },
  };
    // The body-mount closure — captures the mount-scoped `portals` local. Mounts an
    // INDEPENDENT body root PER graph node (the canvas calls this once per node of the
    // type), so every instance keeps its OWN #body — it must NOT dispose any sibling's
    // handle (the bug: a single shared handle torn down on each call left only the LAST
    // node rendered). The returned { dispose } is wrapped to deregister ITSELF from the
    // live set when the canvas disposes that node's projection (entry.bodyHandle on node
    // unmount / port-resync); a leftover handle is swept by the component teardown below.
    mountBody.current = (host: any, scope: any) => {
      if (!host) return null;
      const s = scope || {};
      const h = portals.body(host, {
        node: s.node,
        selected: s.selected,
        emit: s.emit
      });
      if (!h) return null;
      bodyHandles.current.add(h);
      return {
        update: (next: any) => {
          if (h && h.update) {
            try {
              return h.update(next);
            } catch (e: any) {}
          }
        },
        dispose: () => {
          bodyHandles.current.delete(h);
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
      };
    };
    // register this TYPE's spec INCLUDING the bodyRenderer callback. The canvas's
    // renderNode resolves typeReg[node.type].bodyRenderer for every graph node of this
    // type and projects the body into the engine host. On Lit the injected canvas may
    // still be undefined here (REQ-30 async context); the $onUpdate below performs the
    // registration once the value arrives.
    if (cv.current && !registered.current) {
      registered.current = true;
      cv.current.registerType(_typeRef.current, buildSpec());
    }
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      // sweep any body projections still live at teardown (the canvas normally disposes
      // each per node unmount, but a component-level unmount must clean any stragglers).
      if (bodyHandles.current) {
        for (const h of bodyHandles.current as any) {
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
        bodyHandles.current.clear();
      }
      if (cv.current) cv.current.unregisterType(_typeRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (registered.current) return;
    const live = canvas;
    if (live == null) return;
    cv.current = live;
    registered.current = true;
    cv.current.registerType(_typeRef.current, buildSpec());
  }, [buildSpec, canvas, cv, registered]);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    if (cv.current) cv.current.registerType(props.type, buildSpec());
  }, [props.type]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <__ctx_rete_nodeType.Provider value={{
  get type() {
    return props.type;
  },
  addPort: (side: any, key: any, portType: any, label: any, multiple: any, position: any) => {
    if (cv.current) cv.current.addTypePort(props.type, side, key, portType, label, multiple, position);
  }
}}>
    <>



    <div className={"rozie-node-type-children"} style={{ display: "none" }} data-rozie-s-372f9492="">{(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}</div>
    </>
    </__ctx_rete_nodeType.Provider>
  );
}
