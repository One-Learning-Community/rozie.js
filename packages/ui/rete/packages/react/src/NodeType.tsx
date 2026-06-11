import { useCallback, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { rozieContext } from '@rozie/runtime-react';

interface BodyCtx { node: any; selected: any; emit: any; }

interface NodeTypeProps {
  type: string;
  renderBody?: (ctx: BodyCtx) => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function NodeType(props: NodeTypeProps): JSX.Element {
  const canvas = useContext(rozieContext("rete:canvas"));
  const __ctx_rete_nodeType = rozieContext("rete:nodeType");
  const portalRoots = useRef<Set<Root>>(new Set());
  const _renderBodyRef = useRef(props.renderBody);
  _renderBodyRef.current = props.renderBody;
  const mountBody = useRef<any>(null);
  const bodyHandle = useRef<any>(null);
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
    }
  }), [props.type]);

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
    // The body-mount closure — captures the mount-scoped `portals` local. Disposes a
    // prior handle first so a re-fired bodyRenderer (e.g. ports changed → fresh node
    // build) does not stack portal roots into the same engine host. Mounts the type's
    // `#body` slot, scoped with the graph node ({ node, selected, emit }).
    mountBody.current = (host: any, scope: any) => {
      if (!host) return null;
      if (bodyHandle.current && bodyHandle.current.dispose) {
        try {
          bodyHandle.current.dispose();
        } catch (e: any) {}
      }
      const s = scope || {};
      bodyHandle.current = portals.body(host, {
        node: s.node,
        selected: s.selected,
        emit: s.emit
      });
      return bodyHandle.current;
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
      if (bodyHandle.current && bodyHandle.current.dispose) {
        try {
          bodyHandle.current.dispose();
        } catch (e: any) {}
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
  addPort: (side: any, key: any, portType: any, label: any, multiple: any) => {
    if (cv.current) cv.current.addTypePort(props.type, side, key, portType, label, multiple);
  }
}}>
    <>



    <div className={"rozie-node-type-children"} style={{ display: "none" }} data-rozie-s-372f9492="">{(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}</div>
    </>
    </__ctx_rete_nodeType.Provider>
  );
}
