import { useCallback, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { rozieContext } from '@rozie/runtime-react';

interface BodyCtx { id: any; label: any; }

interface FlowNodeProps {
  id: string;
  x?: number;
  y?: number;
  label?: unknown;
  renderBody?: (ctx: BodyCtx) => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function FlowNode(_props: FlowNodeProps): JSX.Element {
  const canvas = useContext(rozieContext("rete:canvas"));
  const __ctx_rete_node = rozieContext("rete:node");
  const portalRoots = useRef<Set<Root>>(new Set());
  const props: Omit<FlowNodeProps, 'x' | 'y' | 'label'> & { x: number; y: number; label: unknown } = {
    ..._props,
    x: _props.x ?? 0,
    y: _props.y ?? 0,
    label: _props.label ?? undefined,
  };
  const _renderBodyRef = useRef(props.renderBody);
  _renderBodyRef.current = props.renderBody;
  const mountBody = useRef<any>(null);
  const bodyHandle = useRef<any>(null);
  const cv = useRef<any>(null);
  const registered = useRef(false);
  const _labelRef = useRef(props.label);
  _labelRef.current = props.label;
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);

  cv.current = canvas;

  // The live $portals.body handle ({ dispose }) returned by the parent-invoked
  // renderBody callback. Module-scope `any` so the teardown — which the Solid emitter
  // hoists into a sibling onCleanup() OUTSIDE the mount closure — can dispose it.
  const buildSpec = useCallback(() => ({
    id: props.id,
    x: props.x,
    y: props.y,
    label: props.label,
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
      if (host && mountBody.current) {
        try {
          mountBody.current(host);
        } catch (e: any) {}
      }
    }
  }), [props.id, props.label, props.x, props.y]);

  useEffect(() => {
    interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portals = {
    body: (container: HTMLElement, scope: { id: unknown; label: unknown }): ReactivePortalHandle => {
      const slot = _renderBodyRef.current ?? props.slots?.['body'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal body { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-body', '23c15996');
      const root = createRoot(container);
      const renderScope = (s: { id: unknown; label: unknown }): void => {
        flushSync(() => root.render(slot(s)));
      };
      renderScope(scope);
      portalRoots.current.add(root);
      return {
        update: (s: { id: unknown; label: unknown }): void => renderScope(s),
        dispose: (): void => {
          root.unmount();
          portalRoots.current.delete(root);
        },
      };
    },
  };
    // The body-mount closure — captures the mount-scoped `portals` local. Disposes a
    // prior handle first so a re-fired renderBody (e.g. ports changed → fresh node
    // build) does not stack portal roots into the same engine host.
    mountBody.current = (host: any) => {
      if (!host) return;
      if (bodyHandle.current && bodyHandle.current.dispose) {
        try {
          bodyHandle.current.dispose();
        } catch (e: any) {}
      }
      bodyHandle.current = portals.body(host, {
        id: props.id,
        label: _labelRef.current
      });
    };
    // register this node's spec INCLUDING the renderBody callback. reconcileNodes()
    // builds the engine node, then renderNode invokes renderBody(body) — at which point
    // the FlowNode mounts its own body portal into the engine `body` host.
    // On Lit the injected canvas may still be undefined here (REQ-30 async context);
    // the $onUpdate below performs the registration once the value arrives.
    if (cv.current && !registered.current) {
      registered.current = true;
      cv.current.register(props.id, buildSpec());
    }
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      if (bodyHandle.current && bodyHandle.current.dispose) {
        try {
          bodyHandle.current.dispose();
        } catch (e: any) {}
      }
      if (cv.current) cv.current.unregister(props.id);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (registered.current) return;
    const live = canvas;
    if (live == null) return;
    cv.current = live;
    registered.current = true;
    cv.current.register(props.id, buildSpec());
  }, [buildSpec, canvas, cv, props.id, registered]);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    if (cv.current) cv.current.update(props.id, buildSpec());
  }, [props.x]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    if (cv.current) cv.current.update(props.id, buildSpec());
  }, [props.y]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    if (cv.current) cv.current.update(props.id, buildSpec());
  }, [props.label]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <__ctx_rete_node.Provider value={{
  get id() {
    return props.id;
  },
  addPort: (side: any, key: any, label: any, multiple: any) => {
    if (cv.current) cv.current.addPort(props.id, side, key, label, multiple);
  }
}}>
    <>



    <div className={"rozie-flow-node-children"} style={{ display: "none" }} data-rozie-s-23c15996="">{(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}</div>
    </>
    </__ctx_rete_node.Provider>
  );
}
