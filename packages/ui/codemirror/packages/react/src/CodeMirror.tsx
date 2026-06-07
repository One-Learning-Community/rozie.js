import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useControllableState } from '@rozie/runtime-react';
import './CodeMirror.css';
import './CodeMirror.global.css';
import { EditorState, Compartment, EditorSelection, StateField } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, showPanel, showTooltip, placeholder as placeholderExt } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
// Imported under an alias: the `basicSetup` PROP (G1) would otherwise collide
// with this binding on targets that lower props into same-scope locals (Svelte
// `let basicSetup`, Solid/React destructured `props.basicSetup`).
// Imported under an alias: the `basicSetup` PROP (G1) would otherwise collide
// with this binding on targets that lower props into same-scope locals (Svelte
// `let basicSetup`, Solid/React destructured `props.basicSetup`).
import { basicSetup as basicSetupBundle } from 'codemirror';

interface PanelCtx { view: any; }

interface TopPanelCtx { view: any; }

interface TooltipCtx { view: any; pos: any; }

interface CodeMirrorProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  language?: string;
  theme?: unknown;
  readOnly?: boolean;
  height?: number;
  placeholder?: string;
  extensions?: any[];
  basicSetup?: boolean;
  renderPanel?: (ctx: PanelCtx) => ReactNode;
  renderTopPanel?: (ctx: TopPanelCtx) => ReactNode;
  renderTooltip?: (ctx: TooltipCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface CodeMirrorHandle {
  getView: (...args: any[]) => any;
  focus: (...args: any[]) => any;
  getValue: (...args: any[]) => any;
  replaceValue: (...args: any[]) => any;
  dispatch: (...args: any[]) => any;
  insertText: (...args: any[]) => any;
  getSelection: (...args: any[]) => any;
  setSelection: (...args: any[]) => any;
}

const CodeMirror = forwardRef<CodeMirrorHandle, CodeMirrorProps>(function CodeMirror(_props: CodeMirrorProps, ref): JSX.Element {
  const portalRoots = useRef<Set<Root>>(new Set());
  const __defaultExtensions = useState(() => (() => [])())[0];
  const props: Omit<CodeMirrorProps, 'language' | 'theme' | 'readOnly' | 'height' | 'placeholder' | 'extensions' | 'basicSetup'> & { language: string; theme: unknown; readOnly: boolean; height: number; placeholder: string; extensions: any[]; basicSetup: boolean } = {
    ..._props,
    language: _props.language ?? 'javascript',
    theme: _props.theme ?? 'light',
    readOnly: _props.readOnly ?? false,
    height: _props.height ?? 240,
    placeholder: _props.placeholder ?? '',
    extensions: _props.extensions ?? __defaultExtensions,
    basicSetup: _props.basicSetup ?? false,
  };
  const _renderPanelRef = useRef(props.renderPanel);
  _renderPanelRef.current = props.renderPanel;
  const _renderTopPanelRef = useRef(props.renderTopPanel);
  _renderTopPanelRef.current = props.renderTopPanel;
  const _renderTooltipRef = useRef(props.renderTooltip);
  _renderTooltipRef.current = props.renderTooltip;
  const suppressEmit = useRef(false);
  const view = useRef<any>(null);
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? '',
    onValueChange: props.onValueChange,
  });
  const _extensionsRef = useRef(props.extensions);
  _extensionsRef.current = props.extensions;
  const _readOnlyRef = useRef(props.readOnly);
  _readOnlyRef.current = props.readOnly;
  const _valueRef = useRef(value);
  _valueRef.current = value;
  const hostEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);
  const _watch5First = useRef(true);

  const langCompartment = useMemo(() => new Compartment(), []);
  const themeCompartment = useMemo(() => new Compartment(), []);
  const readOnlyCompartment = useMemo(() => new Compartment(), []);
  const placeholderCompartment = useMemo(() => new Compartment(), []);
  const extensionsCompartment = useMemo(() => new Compartment(), []);
  const panelCompartment = useMemo(() => new Compartment(), []);
  const topPanelCompartment = useMemo(() => new Compartment(), []);
  const langExt = useCallback(() => props.language === 'javascript' ? javascript() : [], [props.language]);
  const themeExt = useCallback((): any => {
    const t = props.theme;
    if (t === 'dark') return oneDark;
    if (t === 'light' || t === '' || t == null) return [];
    // t is a CM Extension / Extension[] passthrough by this branch (the widened
    // `theme` prop accepts a string OR an Extension). The strict-tsc leaves get a
    // codegen return-type aid (`themeExt(): any`) so `Compartment.of`/`reconfigure`
    // accept it; the type-neutral targets strip types entirely.
    return t;
  }, [props.theme]);
  const phExt = useCallback(() => props.placeholder ? placeholderExt(props.placeholder) : [], [props.placeholder]);
  const baselineExt = useCallback(() => props.basicSetup ? [basicSetupBundle] : [lineNumbers(), history(), keymap.of([...defaultKeymap, ...historyKeymap])], [props.basicSetup]);
  function writeDoc(v: any) {
    if (!view.current) return;
    const current = view.current.state.doc.toString();
    const next = v ?? '';
    if (current === next) return;
    suppressEmit.current = true;
    try {
      view.current.dispatch({
        changes: {
          from: 0,
          to: current.length,
          insert: next
        }
      });
    } finally {
      suppressEmit.current = false;
    }
  }
  // Imperative handle (Phase 21 $expose). The 8 editor verbs a consumer can't
  // drive through props alone — exposed uniformly to all 6 targets. Each guards
  // the pre-mount/destroyed `view = null`. Collision-clear: none of the 8 names
  // collide with the 8 props (value/language/theme/readOnly/height/placeholder/
  // extensions/basicSetup) and there are no events (D-08).
  function getView() {
    return view.current;
  }
  function focus() {
    view.current?.focus();
  }
  function getValue() {
    return view.current ? view.current.state.doc.toString() : '';
  }
  // replaceValue routes through the SAME suppress-echo guard as $watch(value).
  // NOTE: named `replaceValue` (not `setValue`) — a `value` model prop makes
  // React auto-generate a `setValue` state setter, so a `setValue` $expose verb
  // collides on the React target (ROZ524: "already declared" + recursive rewrite).
  // Renamed to preserve the value-setter semantics collision-free across all 6
  // targets. (Deviation from the locked D-06 name `setValue`.)
  // replaceValue routes through the SAME suppress-echo guard as $watch(value).
  // NOTE: named `replaceValue` (not `setValue`) — a `value` model prop makes
  // React auto-generate a `setValue` state setter, so a `setValue` $expose verb
  // collides on the React target (ROZ524: "already declared" + recursive rewrite).
  // Renamed to preserve the value-setter semantics collision-free across all 6
  // targets. (Deviation from the locked D-06 name `setValue`.)
  function replaceValue(v: any) {
    writeDoc(v);
  }
  function dispatch(tr: any) {
    view.current?.dispatch(tr);
  }
  function insertText(text: any) {
    if (!view.current) return;
    const {
      from,
      to
    } = view.current.state.selection.main;
    view.current.dispatch({
      changes: {
        from,
        to,
        insert: text
      },
      userEvent: 'input.type'
    });
  }
  function getSelection() {
    return view.current ? view.current.state.selection.main : null;
  }
  function setSelection(range: any) {
    if (!view.current) return;
    const sel = typeof range === 'number' ? EditorSelection.single(range) : EditorSelection.single(range.anchor, range.head);
    view.current.dispatch({
      selection: sel
    });
  }

  useEffect(() => {
    interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
  const portals = {
    panel: (container: HTMLElement, scope: { view: unknown }): (() => void) => {
      const slot = _renderPanelRef.current ?? props.slots?.['panel'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal panel { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-panel', '34cfda5a');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    topPanel: (container: HTMLElement, scope: { view: unknown }): (() => void) => {
      const slot = _renderTopPanelRef.current ?? props.slots?.['topPanel'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal topPanel { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-topPanel', '34cfda5a');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
    tooltip: (container: HTMLElement, scope: { view: unknown; pos: unknown }): ReactivePortalHandle => {
      const slot = _renderTooltipRef.current ?? props.slots?.['tooltip'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal tooltip { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-tooltip', '34cfda5a');
      const root = createRoot(container);
      const renderScope = (s: { view: unknown; pos: unknown }): void => {
        flushSync(() => root.render(slot(s)));
      };
      renderScope(scope);
      portalRoots.current.add(root);
      return {
        update: (s: { view: unknown; pos: unknown }): void => renderScope(s),
        dispose: (): void => {
          root.unmount();
          portalRoots.current.delete(root);
        },
      };
    },
  };
    // One `panel` portal slot — mounted through CM6's `showPanel` facet. The
    // Panel's `dom` is the portal host node; $portals.panel(dom, scope) mounts the
    // consumer's framework-native fragment on Panel.mount() and the returned
    // dispose runs in Panel.destroy(). Empty extension ([]) when the consumer
    // doesn't fill the slot.
    // NOTE: the Panel's mount/destroy are ARROW-FUNCTION properties (not object
    // `mount() {}` methods) and the panel host element + view are captured in
    // plain `const`s. The object-method form gives each method its own `this`
    // scope, and the Lit emitter's component-field rewrite walks INTO that method
    // body and rewrites a closure-captured `view` reference to `this.view`
    // (TS2339 "Property 'view' does not exist on type 'Panel'"). Arrow-function
    // properties share the enclosing lexical scope, so the captured `panelView`
    // const resolves correctly on every target. CM6 calls `panel.mount()` /
    // `panel.destroy()` either way.
    const panelExt = () => {
      if (!(props.renderPanel ?? props.slots?.["panel"])) return [];
      return showPanel.of((panelView: any) => {
        const dom = document.createElement('div');
        dom.className = 'rozie-cm-panel';
        const scope = {
          view: panelView
        };
        let dispose: any = null;
        return {
          dom,
          top: false,
          mount: () => {
            dispose = portals.panel(dom, scope);
          },
          destroy: () => {
            dispose?.();
            dispose = null;
          }
        };
      });
    };

    // topPanel — the TOP-docked mount-once sibling of `panel` (G5 wave 1). Same
    // `showPanel` facet, same arrow-function-property mount/destroy form (NOT
    // object-method `mount() {}` — the Lit field-rewrite caveat documented on
    // panelExt above applies identically), differing ONLY in `top: true` and the
    // `.rozie-cm-panel-top` host class. Empty ([]) when the slot is unfilled.
    const topPanelExt = () => {
      if (!(props.renderTopPanel ?? props.slots?.["topPanel"])) return [];
      return showPanel.of((panelView: any) => {
        const dom = document.createElement('div');
        dom.className = 'rozie-cm-panel-top';
        const scope = {
          view: panelView
        };
        let dispose: any = null;
        return {
          dom,
          top: true,
          mount: () => {
            dispose = portals.topPanel(dom, scope);
          },
          destroy: () => {
            dispose?.();
            dispose = null;
          }
        };
      });
    };

    // tooltip — CodeMirror's FIRST REACTIVE portal slot (G5 wave 1). A
    // cursor-anchored tooltip provided through the `showTooltip` facet via a
    // StateField that yields ONE Tooltip at the main selection head whenever the
    // `tooltip` slot is filled.
    //
    // UPDATE-IN-PLACE reconciliation (verified against the installed
    // @codemirror/view@6.43 tooltip source, TooltipViewManager.update): CM reuses
    // an existing TooltipView — calling TooltipView.update(viewUpdate) instead of
    // destroy+create — when the new Tooltip's `create` is REFERENCE-EQUAL to the
    // old one's (`other.create == tip.create`); and when the whole showTooltip
    // facet INPUT is unchanged it skips matching entirely and calls update() on
    // every live view. We satisfy BOTH by holding ONE module-stable Tooltip object
    // (`stableTooltip`, stable `create`) and returning that SAME object from the
    // field's `update` while the head only moved. So the consumer fragment mounts
    // ONCE (TooltipView.mount → $portals.tooltip → reactive {update,dispose}) and
    // every caret move flows through TooltipView.update → handle.update(scope) —
    // re-rendering the fragment IN PLACE, never remounting it.
    const tooltipField = () => {
      if (!(props.renderTooltip ?? props.slots?.["tooltip"])) return [];
      // The reactive portal handle for the SINGLE live tooltip view. Hoisted to
      // the field's closure so create()/update()/destroy() share it across the
      // tooltip's lifetime.
      let handle: any = null;
      // Stable Tooltip object — its `create` reference never changes, so CM
      // reuses the TooltipView across caret moves (update-in-place, no remount).
      // NOTE: `create` is an ARROW-FUNCTION property and its param is named
      // `tipView` (NOT `view`) — both for the SAME Lit reason documented on
      // panelExt: an object-method `create(view) {}` would get its own `this`,
      // and the Lit emitter's component-field rewrite walks into the body and
      // rewrites a `view`-named token (matching the top-level `let view`) to
      // `this.view`. An arrow property shares the enclosing scope, and the
      // non-colliding param name keeps the caret-view reference correct on every
      // target. CM calls `tooltip.create(view)` either way.
      const stableTooltip = {
        pos: 0,
        above: true,
        create: (tipView: any) => {
          const dom = document.createElement('div');
          dom.className = 'rozie-cm-tooltip';
          return {
            dom,
            mount: () => {
              handle = portals.tooltip(dom, {
                view: tipView,
                pos: tipView.state.selection.main.head
              });
            },
            // Reactive in-place update — fired by CM on every ViewUpdate while the
            // tooltip view is reused. Re-renders the consumer fragment with the
            // fresh caret position; the fragment is NOT remounted (REQ — verified
            // empirically via the demo's mount/update counters).
            update: (u: any) => {
              handle?.update({
                view: u.view,
                pos: u.state.selection.main.head
              });
            },
            destroy: () => {
              handle?.dispose();
              handle = null;
            }
          };
        }
      };
      // NOTE: the StateField.update callback's first param is named `cur` (NOT the
      // idiomatic `value`): a `value` model prop makes the React emitter rewrite a
      // local `value` binding into the prop-state ref (`_valueRef.current`) — it
      // walks into this callback and corrupts the field's accumulator
      // (TS2339 "Property 'pos' does not exist on type 'string'"). Same collision
      // class as the setValue→replaceValue $expose rename (ROZ524). `cur` is
      // collision-free across all 6 targets.
      return StateField.define({
        create: (state: any) => ({
          ...stableTooltip,
          pos: state.selection.main.head
        }),
        update: (cur: any, tr: any) => {
          // Keep the SAME stable `create`; only the head moves. Reuse the existing
          // object when the head is unchanged so the facet input is identity-stable.
          const head = tr.state.selection.main.head;
          if (cur && cur.pos === head) return cur;
          return {
            ...stableTooltip,
            pos: head
          };
        },
        provide: (f: any) => showTooltip.from(f)
      });
    };
    const buildState = (doc: any) => EditorState.create({
      doc,
      extensions: [...baselineExt(), langCompartment.of(langExt()), themeCompartment.of(themeExt()), readOnlyCompartment.of(EditorState.readOnly.of(_readOnlyRef.current)), placeholderCompartment.of(phExt()), panelCompartment.of(panelExt()), topPanelCompartment.of(topPanelExt()),
      // tooltipField() returns a StateField extension (or [] when the slot is
      // unfilled); no compartment — it is a one-shot mount-time decision.
      tooltipField(), EditorView.updateListener.of((update: any) => {
        if (!update.docChanged) return;
        if (suppressEmit.current) return;
        // Push the new doc out through the model:true emit path. Consumers
        // bound via `r-model:value="$data.x"` receive the change.
        setValue(update.state.doc.toString());
      }),
      // Consumer extensions LAST so they win CM6's last-registered-wins facets.
      extensionsCompartment.of(_extensionsRef.current)]
    });
    view.current = new EditorView({
      state: buildState(_valueRef.current),
      parent: hostEl.current!
    });
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      view.current?.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = value;
    writeDoc(v);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    if (!view.current) return;
    view.current.dispatch({
      effects: langCompartment.reconfigure(langExt())
    });
  }, [props.language]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    if (!view.current) return;
    view.current.dispatch({
      effects: themeCompartment.reconfigure(themeExt())
    });
  }, [props.theme]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    const v = props.readOnly;
    if (!view.current) return;
    view.current.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(v))
    });
  }, [props.readOnly]);
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    if (!view.current) return;
    view.current.dispatch({
      effects: placeholderCompartment.reconfigure(phExt())
    });
  }, [props.placeholder]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch5First.current) { _watch5First.current = false; return; }
    const v = props.extensions;
    if (!view.current) return;
    view.current.dispatch({
      effects: extensionsCompartment.reconfigure(v)
    });
  }, [props.extensions]);

  useImperativeHandle(ref, () => ({ getView, focus, getValue, replaceValue, dispatch, insertText, getSelection, setSelection }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div className={"rozie-codemirror"} style={{ height: props.height + 'px' }} data-rozie-s-34cfda5a="">
      <div className={"cm-mount"} ref={hostEl} data-rozie-s-34cfda5a="" />
    </div>






    </>
  );
});
export default CodeMirror;
