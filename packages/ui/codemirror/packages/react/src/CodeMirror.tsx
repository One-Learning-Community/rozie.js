import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useControllableState } from '@rozie/runtime-react';
import './CodeMirror.css';
import './CodeMirror.global.css';
import { EditorState, Compartment, EditorSelection, StateField, RangeSet } from '@codemirror/state';
// `gutter` is imported under an alias: the `gutter` SLOT (G5 wave 2) lowers into
// a same-scope local on targets that bind slots as locals (Svelte snippet prop
// `gutter`, etc.), so the bare CM6 `gutter` import would collide ("Identifier
// 'gutter' has already been declared"). Same discipline as `basicSetup as
// basicSetupBundle` below (a prop-vs-import collision). The `decoration` slot has
// no matching import name, so `Decoration` (capitalized, distinct) needs no alias.
import { EditorView, keymap, lineNumbers, showPanel, showTooltip, placeholder as placeholderExt, gutter as gutterExt, GutterMarker, Decoration, WidgetType } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
// Namespace import for the command functions exposed as verbs (undo/redo/
// selectAll). A NAMED `import { undo as undoCmd }` would put the export name
// `undo` in an ImportSpecifier's `imported` slot, and the Lit emitter's
// identifier-rewrite (exposed verb → `this.undo`) mis-rewrites that slot into a
// MemberExpression — a latent emitter limitation. The namespace form keeps the
// command names as MEMBER accesses (`cmCommands.undo`), which the rewrite leaves
// untouched, so the public verbs can be named `undo`/`redo`/`selectAll`.
import * as cmCommands from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
// Imported under an alias: the `basicSetup` PROP (G1) would otherwise collide
// with this binding on targets that lower props into same-scope locals (Svelte
// `let basicSetup`, Solid/React destructured `props.basicSetup`).
import { basicSetup as basicSetupBundle } from 'codemirror';

interface PanelCtx { view: any; }

interface TopPanelCtx { view: any; }

interface TooltipCtx { view: any; pos: any; }

interface GutterCtx { line: any; view: any; }

interface DecorationCtx { from: any; to: any; view: any; }

interface CodeMirrorProps {
  /**
   * The two-way document text (`r-model:value`) — the editor's contents as a string. Typing in the editor writes the new text back through the model path (CodeMirror's `updateListener` extension); a consumer write reflects into the live document, echo-guarded so a programmatic set does not ping-pong. As the sole `model: true` prop this **is** the only change channel — there are no events.
   * @example
   * <CodeMirror value={source} onValueChange={setSource} language="javascript" theme="dark" />
   */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * Convenience language. `javascript` loads the bundled `@codemirror/lang-javascript`; any other value falls back to plain text (no syntax highlighting, no throw). Add other languages through `:extensions`. Runtime-updatable via a `langCompartment` reconfigure — switching the prop re-highlights without a remount.
   */
  language?: string;
  /**
   * Editor theme. The built-in strings `light` (the editor default — no theme) or `dark` (the bundled `@codemirror/theme-one-dark`), **or** a CodeMirror `Extension` / `Extension[]` passed straight through (G3) — drop in a theme package or an `EditorView.theme({…})`. A non-string theme is composed via the live `themeCompartment` so it reconfigures with no remount, same as the string forms.
   */
  theme?: unknown;
  /**
   * Make the document read-only. Runtime-updatable via a `readOnlyCompartment` reconfigure (no remount).
   */
  readOnly?: boolean;
  /**
   * Editor height in pixels, applied to the wrapper's host box.
   */
  height?: number;
  /**
   * Placeholder text shown when the document is empty (the bundled `@codemirror/view` `placeholder` extension). An empty string means no placeholder. Runtime-updatable via a `placeholderCompartment` reconfigure.
   */
  placeholder?: string;
  /**
   * Consumer-extensible passthrough — an arbitrary `Extension[]` composed **last** so it wins CodeMirror's last-registered-wins facets. The CodeMirror 6 analog of an options bag: line-wrapping, autocomplete, linting, custom key-bindings, additional languages/themes — anything the curated props do not special-case. Runtime-reconfigurable via an `extensionsCompartment` (no remount when the array changes).
   */
  extensions?: any[];
  /**
   * When `true`, swap the thin manual baseline (line numbers + history + default/history keymaps) for CodeMirror 6's batteries-included `basicSetup` bundle — autocomplete, search, bracket matching, code folding, lint gutter, and richer keymaps. The curated props and consumer `:extensions` still compose **after** it, so they continue to win. Runtime-updatable via a `baselineCompartment` reconfigure — toggling it swaps the bundle live, no remount required.
   */
  basicSetup?: boolean;
  /**
   * The 1-based line numbers that each get a custom gutter marker rendered by the `gutter` reactive multi-instance portal slot (one portal handle per visible marker). Out-of-range lines are ignored. Runtime-updatable via a `gutterCompartment` reconfigure — changing the array re-marks the lines with no remount. Only meaningful when the `gutter` slot is filled.
   */
  gutterLines?: any[];
  /**
   * An array of `{ from, to? }` **0-based document offsets** that each get an inline widget rendered by the `decoration` reactive multi-instance portal slot (one portal handle per visible widget). A point widget is placed at `from`; `to` is passed through in scope for the consumer's awareness. Compute an offset from a line via `view.state.doc.line(n).from`. Runtime-updatable via a `decorationCompartment` reconfigure. Only meaningful when the `decoration` slot is filled.
   */
  decorations?: any[];
  renderPanel?: (ctx: PanelCtx) => ReactNode;
  renderTopPanel?: (ctx: TopPanelCtx) => ReactNode;
  renderTooltip?: (ctx: TooltipCtx) => ReactNode;
  renderGutter?: (ctx: GutterCtx) => ReactNode;
  renderDecoration?: (ctx: DecorationCtx) => ReactNode;
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
  undo: (...args: any[]) => any;
  redo: (...args: any[]) => any;
  selectAll: (...args: any[]) => any;
  scrollToPos: (...args: any[]) => any;
}

const CodeMirror = forwardRef<CodeMirrorHandle, CodeMirrorProps>(function CodeMirror(_props: CodeMirrorProps, ref): JSX.Element {
  const portalRoots = useRef<Set<Root>>(new Set());
  const __defaultExtensions = useState(() => (() => [])())[0];
  const __defaultGutterLines = useState(() => (() => [])())[0];
  const __defaultDecorations = useState(() => (() => [])())[0];
  const props: Omit<CodeMirrorProps, 'language' | 'theme' | 'readOnly' | 'height' | 'placeholder' | 'extensions' | 'basicSetup' | 'gutterLines' | 'decorations'> & { language: string; theme: unknown; readOnly: boolean; height: number; placeholder: string; extensions: any[]; basicSetup: boolean; gutterLines: any[]; decorations: any[] } = {
    ..._props,
    language: _props.language ?? 'javascript',
    theme: _props.theme ?? 'light',
    readOnly: _props.readOnly ?? false,
    height: _props.height ?? 240,
    placeholder: _props.placeholder ?? '',
    extensions: _props.extensions ?? __defaultExtensions,
    basicSetup: _props.basicSetup ?? false,
    gutterLines: _props.gutterLines ?? __defaultGutterLines,
    decorations: _props.decorations ?? __defaultDecorations,
  };
  const _renderPanelRef = useRef(props.renderPanel);
  _renderPanelRef.current = props.renderPanel;
  const _renderTopPanelRef = useRef(props.renderTopPanel);
  _renderTopPanelRef.current = props.renderTopPanel;
  const _renderTooltipRef = useRef(props.renderTooltip);
  _renderTooltipRef.current = props.renderTooltip;
  const _renderGutterRef = useRef(props.renderGutter);
  _renderGutterRef.current = props.renderGutter;
  const _renderDecorationRef = useRef(props.renderDecoration);
  _renderDecorationRef.current = props.renderDecoration;
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
    gutter: (container: HTMLElement, scope: { line: unknown; view: unknown }): ReactivePortalHandle => {
      const slot = _renderGutterRef.current ?? props.slots?.['gutter'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal gutter { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-gutter', '34cfda5a');
      const root = createRoot(container);
      const renderScope = (s: { line: unknown; view: unknown }): void => {
        flushSync(() => root.render(slot(s)));
      };
      renderScope(scope);
      portalRoots.current.add(root);
      return {
        update: (s: { line: unknown; view: unknown }): void => renderScope(s),
        dispose: (): void => {
          root.unmount();
          portalRoots.current.delete(root);
        },
      };
    },
    decoration: (container: HTMLElement, scope: { from: unknown; to: unknown; view: unknown }): ReactivePortalHandle => {
      const slot = _renderDecorationRef.current ?? props.slots?.['decoration'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal decoration { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-decoration', '34cfda5a');
      const root = createRoot(container);
      const renderScope = (s: { from: unknown; to: unknown; view: unknown }): void => {
        flushSync(() => root.render(slot(s)));
      };
      renderScope(scope);
      portalRoots.current.add(root);
      return {
        update: (s: { from: unknown; to: unknown; view: unknown }): void => renderScope(s),
        dispose: (): void => {
          root.unmount();
          portalRoots.current.delete(root);
        },
      };
    },
  };
  const view = useRef<any>(null);
  const suppressEmit = useRef(false);
  const pendingReconfigures = useRef<any>(null);
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? '',
    onValueChange: props.onValueChange,
  });
  const _valueRef = useRef(value);
  _valueRef.current = value;
  const hostEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);
  const _watch5First = useRef(true);
  const _watch6First = useRef(true);
  const _watch7First = useRef(true);
  const _watch8First = useRef(true);

  // CodeMirror's updateListener fires on EVERY transaction, including our own
  // $watch-driven dispatch when the consumer changes `value`. Without a guard
  // the wrapper would emit its own dispatch back through the model path on
  // the next tick — a slow ping-pong loop that doesn't crash but eats RAFs.
  // Compartments let us swap individual extensions at runtime via
  // `view.dispatch({ effects: compartment.reconfigure(newExt) })` without
  // rebuilding the entire EditorState. Each runtime-updatable prop gets one so
  // prop changes don't lose cursor/history/scroll position.
  const baselineCompartment = useMemo(() => new Compartment(), []);
  const langCompartment = useMemo(() => new Compartment(), []);
  const themeCompartment = useMemo(() => new Compartment(), []);
  const readOnlyCompartment = useMemo(() => new Compartment(), []);
  const placeholderCompartment = useMemo(() => new Compartment(), []);
  const extensionsCompartment = useMemo(() => new Compartment(), []);
  const panelCompartment = useMemo(() => new Compartment(), []);
  // topPanel is the top-docked sibling of `panel` — a SECOND mount-once portal
  // slot (G5 wave 1) wired through the same `showPanel` facet with `top: true`.
  const topPanelCompartment = useMemo(() => new Compartment(), []);
  // gutter / decoration are the REACTIVE MULTI-INSTANCE portal slots (G5 wave 2) —
  // one portal handle per visible marker/widget (the TipTap nodeView template).
  // Each owns a compartment so its driving prop (`gutterLines` / `decorations`)
  // reconfigures the marked lines / decorated ranges LIVE with no remount, like
  // every other runtime-updatable prop. The GutterMarker/WidgetType classes that
  // capture $portals.gutter / $portals.decoration are declared inline inside the
  // top-level makeGutterExt/makeDecorationExt factories below — no mount-scope
  // bridge needed; these compartments are filled directly from those factories.
  const gutterCompartment = useMemo(() => new Compartment(), []);
  const decorationCompartment = useMemo(() => new Compartment(), []);
  // tooltip is CodeMirror's FIRST REACTIVE portal slot (G5 wave 1) — a
  // cursor-anchored tooltip via the `showTooltip` facet. Driven by a StateField
  // (`tooltipField`, a top-level factory) so it tracks the caret; the reactive
  // portal handle re-renders the consumer fragment IN PLACE on caret move rather
  // than remounting it each keystroke. NO compartment — a StateField is the
  // idiomatic showTooltip source and there is no runtime prop to reconfigure it
  // against (slot presence is decided once at mount).
  // language is a convenience prop mapping to the ONE bundled language
  // (@codemirror/lang-javascript). Any other value → [] (plain text, no syntax
  // highlighting); consumers add other languages via :extensions (D-03). This
  // FIXES the prior declared-but-ignored bug where buildState hard-coded
  // javascript() regardless of $props.language.
  function langExt() {
    return props.language === 'javascript' ? javascript() : [];
  }
  function themeExt(): any {
    const t = props.theme;
    if (t === 'dark') return oneDark;
    if (t === 'light' || t === '' || t == null) return [];
    // t is a CM Extension / Extension[] passthrough by this branch (the widened
    // `theme` prop accepts a string OR an Extension). The strict-tsc leaves get a
    // codegen return-type aid (`themeExt(): any`) so `Compartment.of`/`reconfigure`
    // accept it; the type-neutral targets strip types entirely.
    return t;
  }
  function phExt() {
    return props.placeholder ? placeholderExt(props.placeholder) : [];
  }
  function baselineExt() {
    return props.basicSetup ? [basicSetupBundle] : [lineNumbers(), history(), keymap.of([...defaultKeymap, ...historyKeymap])];
  }
  function panelExt() {
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
  }
  function topPanelExt() {
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
  }
  function tooltipField() {
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
  }
  function makeGutterExt(gv: any) {
    if (!(props.renderGutter ?? props.slots?.["gutter"])) return [];
    const makeGutterMarker = (line: any) => {
      let handle: any = null;
      return new class extends GutterMarker {
        toDOM(mView: any) {
          const dom = document.createElement('div');
          dom.className = 'rozie-cm-gutter-marker';
          handle = gv(dom, {
            line,
            view: mView
          });
          return dom;
        }
        destroy() {
          handle?.dispose();
          handle = null;
        }
      }();
    };
    // Recompute the marker RangeSet from `gutterLines` against the live doc —
    // one marker at the START of each in-range line. RangeSet.of REQUIRES the
    // ranges sorted by `from`, so sort the resolved positions.
    const buildMarkers = (mView: any): any => {
      const doc = mView.state.doc;
      const ranges = [];
      for (const n of props.gutterLines as any) {
        if (typeof n !== 'number' || n < 1 || n > doc.lines) continue;
        ranges.push(makeGutterMarker(n).range(doc.line(n).from));
      }
      ranges.sort((a: any, b: any) => a.from - b.from);
      return RangeSet.of(ranges);
    };
    return gutterExt({
      class: 'rozie-cm-gutter',
      markers: (mView: any) => buildMarkers(mView)
    });
  }
  function makeDecorationExt(dv: any) {
    // Unfilled slot → EMPTY EXTENSION (`[]`), NOT `Decoration.none`. The latter
    // is a DecorationSet (a RangeSet), which is NOT a valid Extension; placing it
    // in the extensions array (via `decorationCompartment.of(...)`) makes
    // EditorState.create throw at runtime — the editor never mounts. Only the
    // browser surfaces this (CM's facet types are loose, so build/typecheck pass).
    if (!(props.renderDecoration ?? props.slots?.["decoration"])) return [];
    // The WidgetType subclass is declared inline (WidgetType REQUIRES subclassing)
    // but its per-widget state (`from`/`to`, the live portal handle) lives in
    // CLOSURE — `makeWidget(from, to)` captures them — NOT in `this` fields, for
    // the same strict-tsc-bundled-leaf reason as the gutter marker (undeclared
    // `this` fields trip TS2339; the overriding methods can't carry the TS-only
    // `override` keyword from plain-JS `<script>`, so the bundled leaves relax
    // `noImplicitOverride`). No `eq` override is needed: the decoration set is
    // rebuilt from the prop on every reconfigure, so default reference-`eq`
    // (always "different") correctly remounts each widget instead of reusing stale
    // DOM. The `view` param is `dView` (the Lit field-rewrite lesson).
    const makeWidget = (from: any, to: any) => {
      let handle: any = null;
      return new class extends WidgetType {
        toDOM(dView: any) {
          const dom = document.createElement('span');
          dom.className = 'rozie-cm-decoration';
          handle = dv(dom, {
            from,
            to,
            view: dView
          });
          return dom;
        }
        destroy() {
          handle?.dispose();
          handle = null;
        }
        // Inline widgets must not be considered editable content.
        ignoreEvent() {
          return false;
        }
      }();
    };
    // Build the DecorationSet from `decorations` against the live doc. Each entry
    // is a point widget at `from` (side: 1 — after the position); out-of-range
    // offsets are clamped to the doc length and skipped if `from` is invalid.
    // Decoration.set REQUIRES the ranges sorted by `from`.
    const buildSet = (state: any) => {
      const len = state.doc.length;
      const ranges = [];
      for (const d of props.decorations as any) {
        if (!d || typeof d.from !== 'number') continue;
        const from = Math.max(0, Math.min(d.from, len));
        const to = typeof d.to === 'number' ? Math.max(0, Math.min(d.to, len)) : from;
        ranges.push(Decoration.widget({
          widget: makeWidget(from, to),
          side: 1
        }).range(from));
      }
      ranges.sort((a: any, b: any) => a.from - b.from);
      return Decoration.set(ranges);
    };
    // A StateField yields the DecorationSet and provides it to EditorView.
    // decorations. The set is rebuilt on every prop-driven reconfigure (the
    // $watch dispatches decorationCompartment.reconfigure(makeDecorationExt(…))),
    // and tracked across local doc edits via mapping so widget positions follow.
    return StateField.define({
      create: (state: any) => buildSet(state),
      update: (deco: any, tr: any) => tr.docChanged ? deco.map(tr.changes) : deco,
      provide: (f: any) => EditorView.decorations.from(f)
    });
  }
  function rebuildGutterExt() {
    return makeGutterExt(portals.gutter);
  }
  function rebuildDecorationExt() {
    return makeDecorationExt(portals.decoration);
  }
  const buildState = useCallback((doc: any) => EditorState.create({
    doc,
    extensions: [baselineCompartment.of(baselineExt()), langCompartment.of(langExt()), themeCompartment.of(themeExt()), readOnlyCompartment.of(EditorState.readOnly.of(props.readOnly)), placeholderCompartment.of(phExt()), panelCompartment.of(panelExt()), topPanelCompartment.of(topPanelExt()),
    // gutter / decoration — the REACTIVE MULTI-INSTANCE portal slots (G5 wave
    // 2). Each lives in a compartment so its driving prop (gutterLines /
    // decorations) reconfigures live; rebuildGutterExt/rebuildDecorationExt
    // read $portals.gutter/$portals.decoration directly (top-level, no bridge).
    gutterCompartment.of(rebuildGutterExt()), decorationCompartment.of(rebuildDecorationExt()),
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
    extensionsCompartment.of(props.extensions)]
  }), [baselineExt, langExt, panelExt, phExt, props.extensions, props.readOnly, rebuildDecorationExt, rebuildGutterExt, setValue, themeExt, tooltipField, topPanelExt]);
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
  function scheduleReconfigure(compartment: any, buildExt: any) {
    if (!view.current) return;
    if (!pendingReconfigures.current) {
      pendingReconfigures.current = new Map();
      queueMicrotask(() => {
        const batch = pendingReconfigures.current;
        pendingReconfigures.current = null;
        if (!view.current || !batch) return;
        const effects = [];
        for (const entry of batch as any) effects.push(entry[0].reconfigure(entry[1]()));
        view.current.dispatch({
          effects
        });
      });
    }
    pendingReconfigures.current.set(compartment, buildExt);
  }
  // Imperative handle (Phase 21 $expose). The 12 editor verbs a consumer can't
  // drive through props alone — exposed uniformly to all 6 targets. Each guards
  // the pre-mount/destroyed `view = null`. Collision-clear: none of the names
  // collide with the props (value/language/theme/readOnly/height/placeholder/
  // extensions/basicSetup/gutterLines/decorations) and there are no events (D-08).
  //
  // undo/redo/selectAll are the basic editor-command verbs a toolbar needs (history
  // ships with basicSetup / the bundled `history()` extension); the @codemirror/
  // commands functions are reached via the `cmCommands` namespace import so the
  // public verb names don't self-shadow the imports. scrollToPos reveals a document
  // position — it is NOT named `scrollIntoView`/`scrollTo` (both inherited
  // HTMLElement methods → would shadow on the Lit leaf, the embla scrollTo lesson).
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
  function undo() {
    if (view.current) cmCommands.undo(view.current);
  }
  function redo() {
    if (view.current) cmCommands.redo(view.current);
  }
  function selectAll() {
    if (view.current) cmCommands.selectAll(view.current);
  }
  // Reveal a document position (jump-to-line, scroll-to-match/error). setSelection
  // moves the caret but does not guarantee scroll; this dispatches the scroll
  // effect. opts default centers the position vertically.
  function scrollToPos(pos: any, opts: any) {
    if (!view.current) return;
    view.current.dispatch({
      effects: EditorView.scrollIntoView(pos, opts ?? {
        y: 'center'
      })
    });
  }

  const _buildStateRef = useRef(buildState);
  _buildStateRef.current = buildState;
  useEffect(() => {
    view.current = new EditorView({
      state: _buildStateRef.current(_valueRef.current),
      parent: hostEl.current!
    });
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      view.current?.destroy();
    };
  }, []);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = value;
    writeDoc(v);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    scheduleReconfigure(langCompartment, langExt);
  }, [props.language]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    scheduleReconfigure(themeCompartment, themeExt);
  }, [props.theme]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    scheduleReconfigure(readOnlyCompartment, () => EditorState.readOnly.of(props.readOnly));
  }, [props.readOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    scheduleReconfigure(placeholderCompartment, phExt);
  }, [props.placeholder]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch5First.current) { _watch5First.current = false; return; }
    scheduleReconfigure(extensionsCompartment, () => props.extensions);
  }, [props.extensions]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch6First.current) { _watch6First.current = false; return; }
    scheduleReconfigure(baselineCompartment, baselineExt);
  }, [props.basicSetup]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch7First.current) { _watch7First.current = false; return; }
    scheduleReconfigure(gutterCompartment, () => rebuildGutterExt());
  }, [props.gutterLines]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch8First.current) { _watch8First.current = false; return; }
    scheduleReconfigure(decorationCompartment, () => rebuildDecorationExt());
  }, [props.decorations]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ getView, focus, getValue, replaceValue, dispatch, insertText, getSelection, setSelection, undo, redo, selectAll, scrollToPos });
  _rozieExposeRef.current = { getView, focus, getValue, replaceValue, dispatch, insertText, getSelection, setSelection, undo, redo, selectAll, scrollToPos };
  useImperativeHandle(ref, () => ({ getView: (...args: Parameters<typeof getView>): ReturnType<typeof getView> => _rozieExposeRef.current.getView(...args), focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args), getValue: (...args: Parameters<typeof getValue>): ReturnType<typeof getValue> => _rozieExposeRef.current.getValue(...args), replaceValue: (...args: Parameters<typeof replaceValue>): ReturnType<typeof replaceValue> => _rozieExposeRef.current.replaceValue(...args), dispatch: (...args: Parameters<typeof dispatch>): ReturnType<typeof dispatch> => _rozieExposeRef.current.dispatch(...args), insertText: (...args: Parameters<typeof insertText>): ReturnType<typeof insertText> => _rozieExposeRef.current.insertText(...args), getSelection: (...args: Parameters<typeof getSelection>): ReturnType<typeof getSelection> => _rozieExposeRef.current.getSelection(...args), setSelection: (...args: Parameters<typeof setSelection>): ReturnType<typeof setSelection> => _rozieExposeRef.current.setSelection(...args), undo: (...args: Parameters<typeof undo>): ReturnType<typeof undo> => _rozieExposeRef.current.undo(...args), redo: (...args: Parameters<typeof redo>): ReturnType<typeof redo> => _rozieExposeRef.current.redo(...args), selectAll: (...args: Parameters<typeof selectAll>): ReturnType<typeof selectAll> => _rozieExposeRef.current.selectAll(...args), scrollToPos: (...args: Parameters<typeof scrollToPos>): ReturnType<typeof scrollToPos> => _rozieExposeRef.current.scrollToPos(...args) }), []);

  return (
    <>
    <div className={"rozie-codemirror"} style={{ height: props.height + 'px' }} data-rozie-s-34cfda5a="">
      <div className={"cm-mount"} ref={hostEl} data-rozie-s-34cfda5a="" />
    </div>










    </>
  );
});
export default CodeMirror;
