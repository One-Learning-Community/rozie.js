import type { JSX } from 'solid-js';
import { createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { render } from 'solid-js/web';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';
import { EditorState, Compartment, EditorSelection } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, showPanel, placeholder as placeholderExt } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

__rozieInjectStyle('CodeMirror-34cfda5a', `.rozie-codemirror[data-rozie-s-34cfda5a] {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
}
.cm-mount[data-rozie-s-34cfda5a] {
  height: 100%;
  width: 100%;
}
.rozie-codemirror .cm-editor {
    height: 100%;
    font-size: 13px;
  }
.rozie-codemirror .cm-scroller {
    height: 100%;
  }
.rozie-codemirror .rozie-cm-panel {
    padding: 2px 8px;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    font-size: 12px;
  }`);

interface PanelSlotCtx { view: any; }

interface CodeMirrorProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  language?: string;
  theme?: string;
  readOnly?: boolean;
  height?: number;
  placeholder?: string;
  extensions?: any[];
  panelSlot?: (ctx: PanelSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: CodeMirrorHandle) => void;
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

export default function CodeMirror(_props: CodeMirrorProps): JSX.Element {
  const _merged = mergeProps({ language: 'javascript', theme: 'light', readOnly: false, height: 240, placeholder: '', extensions: (() => [])() }, _props);
  const [local, attrs] = splitProps(_merged, ['value', 'language', 'theme', 'readOnly', 'height', 'placeholder', 'extensions', 'ref']);
  onMount(() => { local.ref?.({ getView, focus, getValue, replaceValue, dispatch, insertText, getSelection, setSelection }); });

  const [value, setValue] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'value', '');
  const portalDisposers = new Set<() => void>();
  const portals = {
    panel: (container: HTMLElement, scope: { view: unknown }): (() => void) => {
      const slot = _props.panelSlot ?? _props.slots?.['panel'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-panel', '34cfda5a');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
  };
  onCleanup(() => {
    for (const dispose of portalDisposers) dispose();
    portalDisposers.clear();
  });
  onMount(() => {
    const _cleanup = (() => {
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
      if (!(_props.panelSlot ?? _props.slots?.["panel"])) return [];
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
    const buildState = (doc: any) => EditorState.create({
      doc,
      extensions: [lineNumbers(), history(), keymap.of([...defaultKeymap, ...historyKeymap]), langCompartment.of(langExt()), themeCompartment.of(themeExt()), readOnlyCompartment.of(EditorState.readOnly.of(local.readOnly)), placeholderCompartment.of(phExt()), panelCompartment.of(panelExt()), EditorView.updateListener.of((update: any) => {
        if (!update.docChanged) return;
        if (suppressEmit) return;
        // Push the new doc out through the model:true emit path. Consumers
        // bound via `r-model:value="$data.x"` receive the change.
        setValue(update.state.doc.toString());
      }),
      // Consumer extensions LAST so they win CM6's last-registered-wins facets.
      extensionsCompartment.of(local.extensions)]
    });
    view = new EditorView({
      state: buildState(value()),
      parent: hostElRef
    });
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => view?.destroy());
  });
  createEffect(on(() => (() => value())(), (v) => untrack(() => ((v: any) => writeDoc(v))(v)), { defer: true }));
  createEffect(on(() => (() => local.language)(), (v) => untrack(() => (() => {
    if (!view) return;
    view.dispatch({
      effects: langCompartment.reconfigure(langExt())
    });
  })()), { defer: true }));
  createEffect(on(() => (() => local.theme)(), (v) => untrack(() => (() => {
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(themeExt())
    });
  })()), { defer: true }));
  createEffect(on(() => (() => local.readOnly)(), (v) => untrack(() => ((v: any) => {
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(v))
    });
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.placeholder)(), (v) => untrack(() => (() => {
    if (!view) return;
    view.dispatch({
      effects: placeholderCompartment.reconfigure(phExt())
    });
  })()), { defer: true }));
  createEffect(on(() => (() => local.extensions)(), (v) => untrack(() => ((v: any) => {
    if (!view) return;
    view.dispatch({
      effects: extensionsCompartment.reconfigure(v)
    });
  })(v)), { defer: true }));
  let hostElRef: HTMLElement | null = null;

  let view: any = null;

  // CodeMirror's updateListener fires on EVERY transaction, including our own
  // $watch-driven dispatch when the consumer changes `value`. Without a guard
  // the wrapper would emit its own dispatch back through the model path on
  // the next tick — a slow ping-pong loop that doesn't crash but eats RAFs.
  let suppressEmit = false;

  // Compartments let us swap individual extensions at runtime via
  // `view.dispatch({ effects: compartment.reconfigure(newExt) })` without
  // rebuilding the entire EditorState. Each runtime-updatable prop gets one so
  // prop changes don't lose cursor/history/scroll position.
  const langCompartment = new Compartment();
  const themeCompartment = new Compartment();
  const readOnlyCompartment = new Compartment();
  const placeholderCompartment = new Compartment();
  const extensionsCompartment = new Compartment();
  const panelCompartment = new Compartment();

  // language is a convenience prop mapping to the ONE bundled language
  // (@codemirror/lang-javascript). Any other value → [] (plain text, no syntax
  // highlighting); consumers add other languages via :extensions (D-03). This
  // FIXES the prior declared-but-ignored bug where buildState hard-coded
  // javascript() regardless of $props.language.
  function langExt() {
    return local.language === 'javascript' ? javascript() : [];
  }
  function themeExt() {
    return local.theme === 'dark' ? oneDark : [];
  }

  // placeholder ext only when a non-empty placeholder string is supplied.
  function phExt() {
    return local.placeholder ? placeholderExt(local.placeholder) : [];
  }

  // buildState + the panel-slot wiring live INSIDE $onMount so the $portals.panel
  // reference is bound in the mount scope. The per-target emitters scope the
  // concrete portal helper inside the mount lifecycle (React useEffect / Lit
  // firstUpdated / etc.); a top-level `panelExt` that references $portals would
  // land out-of-scope of that helper and fail the bundled-leaf strict typecheck
  // (TS2304 'portals' / TS2742). Keeping the $portals.panel use inside $onMount
  // mirrors FullCalendar's portal pattern (its eventContent callbacks reference
  // $portals only inside $onMount). buildState is only ever called here, so this
  // is a behavior-preserving relocation. Compartments + langExt/themeExt/phExt
  // stay top-level — the $watch reconfigures still reference them.

  // Shared suppress-echo write helper. Both the $watch(value) consumer-driven
  // reflect AND the $expose setValue verb route through this so a programmatic
  // or prop-driven set doesn't ping-pong back through the model path. When the
  // editor itself was the source of the change, the doc already matches `v`, so
  // dispatching another transaction would mint a duplicate undo-history entry
  // for no UI change.
  function writeDoc(v: any) {
    if (!view) return;
    const current = view.state.doc.toString();
    const next = v ?? '';
    if (current === next) return;
    suppressEmit = true;
    try {
      view.dispatch({
        changes: {
          from: 0,
          to: current.length,
          insert: next
        }
      });
    } finally {
      suppressEmit = false;
    }
  }

  // Consumer-driven value writes: reflect into the live editor (echo-guarded).

  // Imperative handle (Phase 21 $expose). The 8 editor verbs a consumer can't
  // drive through props alone — exposed uniformly to all 6 targets. Each guards
  // the pre-mount/destroyed `view = null`. Collision-clear: none of the 8 names
  // collide with the 7 props (value/language/theme/readOnly/height/placeholder/
  // extensions) and there are no events (D-08).
  function getView() {
    return view;
  }
  function focus() {
    view?.focus();
  }
  function getValue() {
    return view ? view.state.doc.toString() : '';
  }
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
    view?.dispatch(tr);
  }
  function insertText(text: any) {
    if (!view) return;
    const {
      from,
      to
    } = view.state.selection.main;
    view.dispatch({
      changes: {
        from,
        to,
        insert: text
      },
      userEvent: 'input.type'
    });
  }
  function getSelection() {
    return view ? view.state.selection.main : null;
  }
  function setSelection(range: any) {
    if (!view) return;
    const sel = typeof range === 'number' ? EditorSelection.single(range) : EditorSelection.single(range.anchor, range.head);
    view.dispatch({
      selection: sel
    });
  }

  return (
    <>
    <div class={"rozie-codemirror"} style={{ height: local.height + 'px' }} data-rozie-s-34cfda5a="">
      <div class={"cm-mount"} ref={(el) => { hostElRef = el as HTMLElement; }} data-rozie-s-34cfda5a="" />
    </div>


    </>
  );
}
