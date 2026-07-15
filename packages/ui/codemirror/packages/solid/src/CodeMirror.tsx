import type { JSX } from 'solid-js';
import { createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { render } from 'solid-js/web';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';
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
  }
.rozie-codemirror .rozie-cm-panel-top {
    padding: 2px 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    font-size: 12px;
  }
.rozie-codemirror .rozie-cm-tooltip {
    padding: 2px 6px;
    font-size: 11px;
    background: #1a1a1a;
    color: #fff;
    border-radius: 3px;
    white-space: nowrap;
  }
.rozie-codemirror .rozie-cm-gutter {
    min-width: 14px;
  }
.rozie-codemirror .rozie-cm-gutter-marker {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 11px;
    line-height: 1;
  }
.rozie-codemirror .rozie-cm-decoration {
    display: inline-flex;
    align-items: center;
    vertical-align: text-bottom;
  }`);

interface PanelSlotCtx { view: any; }

interface TopPanelSlotCtx { view: any; }

interface TooltipSlotCtx { view: any; pos: any; }

interface GutterSlotCtx { line: any; view: any; }

interface DecorationSlotCtx { from: any; to: any; view: any; }

interface CodeMirrorProps {
  /**
   * The two-way document text (`r-model:value`) — the editor's contents as a string. Typing in the editor writes the new text back through the model path (CodeMirror's `updateListener` extension); a consumer write reflects into the live document, echo-guarded so a programmatic set does not ping-pong. As the sole `model: true` prop this **is** the only change channel — there are no events.
   * @example
   * <CodeMirror r-model:value="source" language="javascript" theme="dark" />
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
  panelSlot?: (ctx: PanelSlotCtx) => JSX.Element;
  topPanelSlot?: (ctx: TopPanelSlotCtx) => JSX.Element;
  tooltipSlot?: (ctx: () => TooltipSlotCtx) => JSX.Element;
  gutterSlot?: (ctx: () => GutterSlotCtx) => JSX.Element;
  decorationSlot?: (ctx: () => DecorationSlotCtx) => JSX.Element;
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
  undo: (...args: any[]) => any;
  redo: (...args: any[]) => any;
  selectAll: (...args: any[]) => any;
  scrollToPos: (...args: any[]) => any;
}

export default function CodeMirror(_props: CodeMirrorProps): JSX.Element {
  const _merged = mergeProps({ language: 'javascript', theme: 'light', readOnly: false, height: 240, placeholder: '', extensions: (() => [])() as any[], basicSetup: false, gutterLines: (() => [])() as any[], decorations: (() => [])() as any[] }, _props);
  const [local, attrs] = splitProps(_merged, ['value', 'language', 'theme', 'readOnly', 'height', 'placeholder', 'extensions', 'basicSetup', 'gutterLines', 'decorations', 'ref']);
  onMount(() => { local.ref?.({ getView, focus, getValue, replaceValue, dispatch, insertText, getSelection, setSelection, undo, redo, selectAll, scrollToPos }); });

  const [value, setValue] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'value', '');
  interface ReactivePortalHandle {
    update(scope: unknown): void;
    dispose(): void;
  }
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
    topPanel: (container: HTMLElement, scope: { view: unknown }): (() => void) => {
      const slot = _props.topPanelSlot ?? _props.slots?.['topPanel'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-topPanel', '34cfda5a');
      const dispose = render(() => slot(scope), container);
      portalDisposers.add(dispose);
      return () => {
        dispose();
        portalDisposers.delete(dispose);
      };
    },
    tooltip: (container: HTMLElement, scope: { view: unknown; pos: unknown }): ReactivePortalHandle => {
      const slot = _props.tooltipSlot ?? _props.slots?.['tooltip'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-tooltip', '34cfda5a');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig as unknown as (() => { view: unknown; pos: unknown })), container);
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
    gutter: (container: HTMLElement, scope: { line: unknown; view: unknown }): ReactivePortalHandle => {
      const slot = _props.gutterSlot ?? _props.slots?.['gutter'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-gutter', '34cfda5a');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig as unknown as (() => { line: unknown; view: unknown })), container);
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
    decoration: (container: HTMLElement, scope: { from: unknown; to: unknown; view: unknown }): ReactivePortalHandle => {
      const slot = _props.decorationSlot ?? _props.slots?.['decoration'];
      if (typeof slot !== 'function') return { update() {}, dispose() {} };
      // Spike 004: portal-scope attribute injection.
      container.setAttribute('data-rozie-portal-decoration', '34cfda5a');
      const [scopeSig, setScopeSig] = createSignal<unknown>(scope, { equals: false });
      const dispose = render(() => slot(scopeSig as unknown as (() => { from: unknown; to: unknown; view: unknown })), container);
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

    // topPanel — the TOP-docked mount-once sibling of `panel` (G5 wave 1). Same
    // `showPanel` facet, same arrow-function-property mount/destroy form (NOT
    // object-method `mount() {}` — the Lit field-rewrite caveat documented on
    // panelExt above applies identically), differing ONLY in `top: true` and the
    // `.rozie-cm-panel-top` host class. Empty ([]) when the slot is unfilled.
    const topPanelExt = () => {
      if (!(_props.topPanelSlot ?? _props.slots?.["topPanel"])) return [];
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
      if (!(_props.tooltipSlot ?? _props.slots?.["tooltip"])) return [];
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

    // gutter — a custom-gutter REACTIVE MULTI-INSTANCE portal slot (G5 wave 2).
    // Each line in `gutterLines` gets a `RozieGutterMarker` whose `toDOM` mounts
    // the consumer fragment via $portals.gutter(dom, scope) — ONE live portal
    // handle PER VISIBLE marker (CM calls toDOM when the line scrolls into view and
    // destroy() when it scrolls out; the reactive handle disposes cleanly). This is
    // the TipTap nodeView multi-instance template: the GutterMarker class captures
    // $portals.gutter and is therefore defined inside this $onMount-invoked factory.
    //
    // The GutterMarker subclass is declared inline (GutterMarker REQUIRES
    // subclassing), but its per-marker state (`line`, the live portal handle) lives
    // in CLOSURE — `makeGutterMarker(line)` captures them — NOT in `this` fields.
    // This is deliberate for the strict-tsc bundled leaves (react/solid/lit): ES
    // class fields assigned only in the constructor (`this.line = …`) without a
    // declaration trip TS2339 under those leaves' strict tsc, and the emitter passes
    // the class through verbatim (a class-field type aid is an emitter concern, OUT
    // OF SCOPE). Closure capture has zero `this`-field surface, so it typechecks
    // cleanly across all six. The overriding CM methods (toDOM/destroy) cannot carry
    // the TS-only `override` keyword — the `<script>` is plain JS (no `lang="ts"`),
    // so `override` is unparseable — so the three bundled leaves relax
    // `noImplicitOverride` in their tsconfig (the Lit leaf already did; react/solid
    // now match). The `view` param is named `mView` — the Lit field-rewrite walks
    // into a method body and rewrites a bare `view` token (matching the top-level
    // `let view`) to `this.view`; `mView` is collision-free. (The panelExt lesson.)
    const makeGutterExt = (gv: any) => {
      if (!(_props.gutterSlot ?? _props.slots?.["gutter"])) return [];
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
        for (const n of local.gutterLines as any) {
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
    };

    // decoration — an inline-widget REACTIVE MULTI-INSTANCE portal slot (G5 wave
    // 2). Each `{ from, to? }` in `decorations` gets a `RozieWidget` whose `toDOM`
    // mounts the consumer fragment via $portals.decoration(dom, scope) — ONE live
    // portal handle PER VISIBLE widget. The decoration set is provided through a
    // compartment-wrapped facet so the `decorations` prop reconfigures it live.
    // The WidgetType class captures $portals.decoration, so it is defined inside
    // this $onMount-invoked factory (the bundled-leaf typecheck discipline).
    const makeDecorationExt = (dv: any) => {
      // Unfilled slot → EMPTY EXTENSION (`[]`), NOT `Decoration.none`. The latter
      // is a DecorationSet (a RangeSet), which is NOT a valid Extension; placing it
      // in the extensions array (via `decorationCompartment.of(...)`) makes
      // EditorState.create throw at runtime — the editor never mounts. Only the
      // browser surfaces this (CM's facet types are loose, so build/typecheck pass).
      if (!(_props.decorationSlot ?? _props.slots?.["decoration"])) return [];
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
        for (const d of local.decorations as any) {
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
    };

    // Bridge the mount-built factories to the top-level $watch reconfigures. Each
    // closes over the captured $portals helper so a prop change can rebuild the
    // extension without re-referencing $portals at top level.
    rebuildGutterExt = () => makeGutterExt(portals.gutter);
    rebuildDecorationExt = () => makeDecorationExt(portals.decoration);
    const buildState = (doc: any) => EditorState.create({
      doc,
      extensions: [baselineCompartment.of(baselineExt()), langCompartment.of(langExt()), themeCompartment.of(themeExt()), readOnlyCompartment.of(EditorState.readOnly.of(local.readOnly)), placeholderCompartment.of(phExt()), panelCompartment.of(panelExt()), topPanelCompartment.of(topPanelExt()),
      // gutter / decoration — the REACTIVE MULTI-INSTANCE portal slots (G5 wave
      // 2). Each lives in a compartment so its driving prop (gutterLines /
      // decorations) reconfigures live; the factory captures the per-target
      // $portals helper (gutter / decoration) here in the mount scope.
      gutterCompartment.of(rebuildGutterExt()), decorationCompartment.of(rebuildDecorationExt()),
      // tooltipField() returns a StateField extension (or [] when the slot is
      // unfilled); no compartment — it is a one-shot mount-time decision.
      tooltipField(), EditorView.updateListener.of((update: any) => {
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
  createEffect(on(() => (() => local.basicSetup)(), (v) => untrack(() => (() => {
    if (!view) return;
    view.dispatch({
      effects: baselineCompartment.reconfigure(baselineExt())
    });
  })()), { defer: true }));
  createEffect(on(() => (() => local.gutterLines)(), (v) => untrack(() => (() => {
    if (!view || !rebuildGutterExt) return;
    view.dispatch({
      effects: gutterCompartment.reconfigure(rebuildGutterExt())
    });
  })()), { defer: true }));
  createEffect(on(() => (() => local.decorations)(), (v) => untrack(() => (() => {
    if (!view || !rebuildDecorationExt) return;
    view.dispatch({
      effects: decorationCompartment.reconfigure(rebuildDecorationExt())
    });
  })()), { defer: true }));
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
  const baselineCompartment = new Compartment();
  const langCompartment = new Compartment();
  const themeCompartment = new Compartment();
  const readOnlyCompartment = new Compartment();
  const placeholderCompartment = new Compartment();
  const extensionsCompartment = new Compartment();
  const panelCompartment = new Compartment();
  // topPanel is the top-docked sibling of `panel` — a SECOND mount-once portal
  // slot (G5 wave 1) wired through the same `showPanel` facet with `top: true`.
  const topPanelCompartment = new Compartment();
  // gutter / decoration are the REACTIVE MULTI-INSTANCE portal slots (G5 wave 2) —
  // one portal handle per visible marker/widget (the TipTap nodeView template).
  // Each owns a compartment so its driving prop (`gutterLines` / `decorations`)
  // reconfigures the marked lines / decorated ranges LIVE with no remount, like
  // every other runtime-updatable prop. The GutterMarker/WidgetType classes that
  // capture $portals.gutter / $portals.decoration are built INSIDE $onMount (a
  // top-level $portals reference fails the bundled-leaf strict typecheck — the
  // panel/tooltip/nodeView discipline), so these compartments are filled from
  // factories invoked in the mount body.
  const gutterCompartment = new Compartment();
  const decorationCompartment = new Compartment();
  // The gutter / decoration extension FACTORIES capture the per-target $portals
  // helper, so they MUST be built inside $onMount (a top-level $portals reference
  // fails the bundled-leaf strict typecheck). But the gutterLines / decorations
  // $watch reconfigures are top-level and need to rebuild the extension on prop
  // change. Bridge with these component-scope `let`s: $onMount assigns each to its
  // mount-built factory; the $watch closures call through them (no-op before mount
  // or when the slot is unfilled). COMPONENT-scope (not $onMount-local) so the
  // top-level $watch can reach them — the same hoist the TipTap toolbarDispose
  // uses for a mount-built handle referenced from outside the mount body.
  let rebuildGutterExt: any = null;
  let rebuildDecorationExt: any = null;
  // tooltip is CodeMirror's FIRST REACTIVE portal slot (G5 wave 1) — a
  // cursor-anchored tooltip via the `showTooltip` facet. Driven by a StateField
  // (`tooltipField`, built inside $onMount) so it tracks the caret; the reactive
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
    return local.language === 'javascript' ? javascript() : [];
  }

  // theme resolution (G3): the two built-in strings map to oneDark / [];
  // anything else is treated as a CM Extension (or Extension[]) and passed
  // straight through the themeCompartment. The $watch(theme) reconfigure below
  // covers extension themes live, identical to the string forms.
  function themeExt(): any {
    const t = local.theme;
    if (t === 'dark') return oneDark;
    if (t === 'light' || t === '' || t == null) return [];
    // t is a CM Extension / Extension[] passthrough by this branch (the widened
    // `theme` prop accepts a string OR an Extension). The strict-tsc leaves get a
    // codegen return-type aid (`themeExt(): any`) so `Compartment.of`/`reconfigure`
    // accept it; the type-neutral targets strip types entirely.
    return t;
  }

  // placeholder ext only when a non-empty placeholder string is supplied.
  function phExt() {
    return local.placeholder ? placeholderExt(local.placeholder) : [];
  }

  // baseline keymap/gutter set (G1). When `basicSetup` is on, use CM6's
  // `basicSetup` bundle (autocomplete, search, bracket matching, code folding,
  // lint gutter, richer keymaps — it ALREADY includes line numbers + history, so
  // the manual trio would double those up). When off, keep the exact thin
  // baseline the wrapper shipped before G1 (line numbers + history + default/
  // history keymaps) → existing consumers stay byte-stable. Composed through
  // `baselineCompartment` (see below) so the `$watch(basicSetup)` reconfigure
  // can swap the bundle live.
  function baselineExt() {
    return local.basicSetup ? [basicSetupBundle] : [lineNumbers(), history(), keymap.of([...defaultKeymap, ...historyKeymap])];
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
  function undo() {
    if (view) cmCommands.undo(view);
  }
  function redo() {
    if (view) cmCommands.redo(view);
  }
  function selectAll() {
    if (view) cmCommands.selectAll(view);
  }
  // Reveal a document position (jump-to-line, scroll-to-match/error). setSelection
  // moves the caret but does not guarantee scroll; this dispatches the scroll
  // effect. opts default centers the position vertically.
  function scrollToPos(pos: any, opts: any) {
    if (!view) return;
    view.dispatch({
      effects: EditorView.scrollIntoView(pos, opts ?? {
        y: 'center'
      })
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
