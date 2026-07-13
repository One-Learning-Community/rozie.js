import { LitElement, css, html, nothing, render } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, untracked } from '@lit-labs/preact-signals';
import { adoptDocumentStyles, createLitControllableProperty, injectGlobalStyles } from '@rozie/runtime-lit';
import { styleMap } from 'lit/directives/style-map.js';
import { EditorState, Compartment, EditorSelection, StateField, RangeSet } from '@codemirror/state';
// `gutter` is imported under an alias: the `gutter` SLOT (G5 wave 2) lowers into
// a same-scope local on targets that bind slots as locals (Svelte snippet prop
// `gutter`, etc.), so the bare CM6 `gutter` import would collide ("Identifier
// 'gutter' has already been declared"). Same discipline as `basicSetup as
// basicSetupBundle` below (a prop-vs-import collision). The `decoration` slot has
// no matching import name, so `Decoration` (capitalized, distinct) needs no alias.
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
// Imported under an alias: the `basicSetup` PROP (G1) would otherwise collide
// with this binding on targets that lower props into same-scope locals (Svelte
// `let basicSetup`, Solid/React destructured `props.basicSetup`).
import { basicSetup as basicSetupBundle } from 'codemirror';

interface RoziePanelSlotCtx {
  view: unknown;
}

interface RozieTopPanelSlotCtx {
  view: unknown;
}

interface RozieTooltipSlotCtx {
  view: unknown;
  pos: unknown;
}

interface RozieGutterSlotCtx {
  line: unknown;
  view: unknown;
}

interface RozieDecorationSlotCtx {
  from: unknown;
  to: unknown;
  view: unknown;
}

@customElement('rozie-code-mirror')
export default class CodeMirror extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-codemirror[data-rozie-s-34cfda5a] {
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
  }
`;

  /**
   * The two-way document text (`r-model:value`) — the editor's contents as a string. Typing in the editor writes the new text back through the model path (CodeMirror's `updateListener` extension); a consumer write reflects into the live document, echo-guarded so a programmatic set does not ping-pong. As the sole `model: true` prop this **is** the only change channel — there are no events.
   * @example
   * <CodeMirror r-model:value="source" language="javascript" theme="dark" />
   */
  @property({ type: String, attribute: 'value' }) _value_attr: string = '';
  private _valueControllable = createLitControllableProperty<string>({ host: this, eventName: 'value-change', defaultValue: '', initialControlledValue: undefined });
  /**
   * Convenience language. `javascript` loads the bundled `@codemirror/lang-javascript`; any other value falls back to plain text (no syntax highlighting, no throw). Add other languages through `:extensions`. Runtime-updatable via a `langCompartment` reconfigure — switching the prop re-highlights without a remount.
   */
  @property({ type: String, reflect: true }) language: string = 'javascript';
  /**
   * Editor theme. The built-in strings `light` (the editor default — no theme) or `dark` (the bundled `@codemirror/theme-one-dark`), **or** a CodeMirror `Extension` / `Extension[]` passed straight through (G3) — drop in a theme package or an `EditorView.theme({…})`. A non-string theme is composed via the live `themeCompartment` so it reconfigures with no remount, same as the string forms.
   */
  @property({ type: Object }) theme: unknown = 'light';
  /**
   * Make the document read-only. Runtime-updatable via a `readOnlyCompartment` reconfigure (no remount).
   */
  @property({ type: Boolean, reflect: true }) readOnly: boolean = false;
  /**
   * Editor height in pixels, applied to the wrapper's host box.
   */
  @property({ type: Number, reflect: true }) height: number = 240;
  /**
   * Placeholder text shown when the document is empty (the bundled `@codemirror/view` `placeholder` extension). An empty string means no placeholder. Runtime-updatable via a `placeholderCompartment` reconfigure.
   */
  @property({ type: String, reflect: true }) placeholder: string = '';
  /**
   * Consumer-extensible passthrough — an arbitrary `Extension[]` composed **last** so it wins CodeMirror's last-registered-wins facets. The CodeMirror 6 analog of an options bag: line-wrapping, autocomplete, linting, custom key-bindings, additional languages/themes — anything the curated props do not special-case. Runtime-reconfigurable via an `extensionsCompartment` (no remount when the array changes).
   */
  @property({ type: Array }) extensions: any[] = [];
  /**
   * When `true`, swap the thin manual baseline (line numbers + history + default/history keymaps) for CodeMirror 6's batteries-included `basicSetup` bundle — autocomplete, search, bracket matching, code folding, lint gutter, and richer keymaps. The curated props and consumer `:extensions` still compose **after** it, so they continue to win. Runtime-updatable via a `baselineCompartment` reconfigure — toggling it swaps the bundle live, no remount required.
   */
  @property({ type: Boolean, reflect: true }) basicSetup: boolean = false;
  /**
   * The 1-based line numbers that each get a custom gutter marker rendered by the `gutter` reactive multi-instance portal slot (one portal handle per visible marker). Out-of-range lines are ignored. Runtime-updatable via a `gutterCompartment` reconfigure — changing the array re-marks the lines with no remount. Only meaningful when the `gutter` slot is filled.
   */
  @property({ type: Array }) gutterLines: any[] = [];
  /**
   * An array of `{ from, to? }` **0-based document offsets** that each get an inline widget rendered by the `decoration` reactive multi-instance portal slot (one portal handle per visible widget). A point widget is placed at `from`; `to` is passed through in scope for the consumer's awareness. Compute an offset from a line via `view.state.doc.line(n).from`. Runtime-updatable via a `decorationCompartment` reconfigure. Only meaningful when the `decoration` slot is filled.
   */
  @property({ type: Array }) decorations: any[] = [];
  @query('[data-rozie-ref="hostEl"]') private _refHostEl!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieFirstUpdateDone = false;
private _portalContainers = new Set<HTMLElement>();

  @state() private _hasSlotPanel = false;
  @queryAssignedElements({ slot: 'panel', flatten: true }) private _slotPanelElements!: Element[];
  @property({ attribute: false }) panel?: (scope: { view: unknown }) => unknown;
  @state() private _hasSlotTopPanel = false;
  @queryAssignedElements({ slot: 'topPanel', flatten: true }) private _slotTopPanelElements!: Element[];
  @property({ attribute: false }) topPanel?: (scope: { view: unknown }) => unknown;
  @state() private _hasSlotTooltip = false;
  @queryAssignedElements({ slot: 'tooltip', flatten: true }) private _slotTooltipElements!: Element[];
  @property({ attribute: false }) tooltip?: (scope: { view: unknown; pos: unknown }) => unknown;
  @state() private _hasSlotGutter = false;
  @queryAssignedElements({ slot: 'gutter', flatten: true }) private _slotGutterElements!: Element[];
  @property({ attribute: false }) gutter?: (scope: { line: unknown; view: unknown }) => unknown;
  @state() private _hasSlotDecoration = false;
  @queryAssignedElements({ slot: 'decoration', flatten: true }) private _slotDecorationElements!: Element[];
  @property({ attribute: false }) decoration?: (scope: { from: unknown; to: unknown; view: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="panel"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotPanel = this._slotPanelElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="topPanel"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotTopPanel = this._slotTopPanelElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="tooltip"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotTooltip = this._slotTooltipElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="gutter"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotGutter = this._slotGutterElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="decoration"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDecoration = this._slotDecorationElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotPanel = Array.from(this.children).some((el) => el.getAttribute('slot') === 'panel');
    this._hasSlotTopPanel = Array.from(this.children).some((el) => el.getAttribute('slot') === 'topPanel');
    this._hasSlotTooltip = Array.from(this.children).some((el) => el.getAttribute('slot') === 'tooltip');
    this._hasSlotGutter = Array.from(this.children).some((el) => el.getAttribute('slot') === 'gutter');
    this._hasSlotDecoration = Array.from(this.children).some((el) => el.getAttribute('slot') === 'decoration');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    adoptDocumentStyles(this);

    this._armListeners();

    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      panel: (container: HTMLElement, scope: { view: unknown }): (() => void) => {
        const tpl = this.panel;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-panel', '34cfda5a');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
      topPanel: (container: HTMLElement, scope: { view: unknown }): (() => void) => {
        const tpl = this.topPanel;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-topPanel', '34cfda5a');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
      tooltip: (container: HTMLElement, scope: { view: unknown; pos: unknown }): ReactivePortalHandle => {
        const tpl = this.tooltip;
        if (typeof tpl !== 'function') return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-tooltip', '34cfda5a');
        const renderScope = (s: { view: unknown; pos: unknown }): void => {
          render(tpl(s), container);
        };
        renderScope(scope);
        this._portalContainers.add(container);
        return {
          update: (s: { view: unknown; pos: unknown }): void => renderScope(s),
          dispose: (): void => {
            render(nothing, container);
            this._portalContainers.delete(container);
          },
        };
      },
      gutter: (container: HTMLElement, scope: { line: unknown; view: unknown }): ReactivePortalHandle => {
        const tpl = this.gutter;
        if (typeof tpl !== 'function') return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-gutter', '34cfda5a');
        const renderScope = (s: { line: unknown; view: unknown }): void => {
          render(tpl(s), container);
        };
        renderScope(scope);
        this._portalContainers.add(container);
        return {
          update: (s: { line: unknown; view: unknown }): void => renderScope(s),
          dispose: (): void => {
            render(nothing, container);
            this._portalContainers.delete(container);
          },
        };
      },
      decoration: (container: HTMLElement, scope: { from: unknown; to: unknown; view: unknown }): ReactivePortalHandle => {
        const tpl = this.decoration;
        if (typeof tpl !== 'function') return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-decoration', '34cfda5a');
        const renderScope = (s: { from: unknown; to: unknown; view: unknown }): void => {
          render(tpl(s), container);
        };
        renderScope(scope);
        this._portalContainers.add(container);
        return {
          update: (s: { from: unknown; to: unknown; view: unknown }): void => renderScope(s),
          dispose: (): void => {
            render(nothing, container);
            this._portalContainers.delete(container);
          },
        };
      },
    };

    this._disconnectCleanups.push((() => this.view?.destroy()));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.value)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => this.writeDoc(v))(__watchVal); }); }));

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
      if (!(this.panel !== undefined)) return [];
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
    // topPanel — the TOP-docked mount-once sibling of `panel` (G5 wave 1). Same
    // `showPanel` facet, same arrow-function-property mount/destroy form (NOT
    // object-method `mount() {}` — the Lit field-rewrite caveat documented on
    // panelExt above applies identically), differing ONLY in `top: true` and the
    // `.rozie-cm-panel-top` host class. Empty ([]) when the slot is unfilled.
    const topPanelExt = () => {
      if (!(this.topPanel !== undefined)) return [];
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
      if (!(this.tooltip !== undefined)) return [];
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
      if (!(this.gutter !== undefined)) return [];
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
        for (const n of this.gutterLines as any) {
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
      if (!(this.decoration !== undefined)) return [];
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
        for (const d of this.decorations as any) {
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
    // Bridge the mount-built factories to the top-level $watch reconfigures. Each
    // closes over the captured $portals helper so a prop change can rebuild the
    // extension without re-referencing $portals at top level.
    this.rebuildGutterExt = () => makeGutterExt(portals.gutter);
    this.rebuildDecorationExt = () => makeDecorationExt(portals.decoration);
    const buildState = (doc: any) => EditorState.create({
      doc,
      extensions: [this.baselineCompartment.of(this.baselineExt()), this.langCompartment.of(this.langExt()), this.themeCompartment.of(this.themeExt()), this.readOnlyCompartment.of(EditorState.readOnly.of(this.readOnly)), this.placeholderCompartment.of(this.phExt()), this.panelCompartment.of(panelExt()), this.topPanelCompartment.of(topPanelExt()),
      // gutter / decoration — the REACTIVE MULTI-INSTANCE portal slots (G5 wave
      // 2). Each lives in a compartment so its driving prop (gutterLines /
      // decorations) reconfigures live; the factory captures the per-target
      // $portals helper (gutter / decoration) here in the mount scope.
      this.gutterCompartment.of(this.rebuildGutterExt()), this.decorationCompartment.of(this.rebuildDecorationExt()),
      // tooltipField() returns a StateField extension (or [] when the slot is
      // unfilled); no compartment — it is a one-shot mount-time decision.
      tooltipField(), EditorView.updateListener.of((update: any) => {
        if (!update.docChanged) return;
        if (this.suppressEmit) return;
        // Push the new doc out through the model:true emit path. Consumers
        // bound via `r-model:value="$data.x"` receive the change.
        this._valueControllable.write(update.state.doc.toString());
      }),
      // Consumer extensions LAST so they win CM6's last-registered-wins facets.
      this.extensionsCompartment.of(this.extensions)]
    });
    this.view = new EditorView({
      state: buildState(this.value),
      parent: this._refHostEl
    });
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('language'))) { const __watchVal = (() => this.language)(); (() => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.langCompartment.reconfigure(this.langExt())
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('theme'))) { const __watchVal = (() => this.theme)(); (() => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.themeCompartment.reconfigure(this.themeExt())
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('readOnly'))) { const __watchVal = (() => this.readOnly)(); ((v: any) => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.readOnlyCompartment.reconfigure(EditorState.readOnly.of(v))
      });
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('placeholder'))) { const __watchVal = (() => this.placeholder)(); (() => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.placeholderCompartment.reconfigure(this.phExt())
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('extensions'))) { const __watchVal = (() => this.extensions)(); ((v: any) => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.extensionsCompartment.reconfigure(v)
      });
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('basicSetup'))) { const __watchVal = (() => this.basicSetup)(); (() => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.baselineCompartment.reconfigure(this.baselineExt())
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('gutterLines'))) { const __watchVal = (() => this.gutterLines)(); (() => {
      if (!this.view || !this.rebuildGutterExt) return;
      this.view.dispatch({
        effects: this.gutterCompartment.reconfigure(this.rebuildGutterExt())
      });
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('decorations'))) { const __watchVal = (() => this.decorations)(); (() => {
      if (!this.view || !this.rebuildDecorationExt) return;
      this.view.dispatch({
        effects: this.decorationCompartment.reconfigure(this.rebuildDecorationExt())
      });
    })(); }
    this.__rozieFirstUpdateDone = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const container of this._portalContainers) render(nothing, container);
      this._portalContainers.clear();
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'value') this._valueControllable.notifyAttributeChange(value as unknown as string);
  }

  render() {
    return html`
<div class="rozie-codemirror" style=${styleMap({ height: this.height + 'px' })} data-rozie-s-34cfda5a>
  <div class="cm-mount" data-rozie-ref="hostEl" data-rozie-s-34cfda5a></div>
</div>

<slot name="panel"></slot>

<slot name="topPanel"></slot>

<slot name="tooltip"></slot>

<slot name="gutter"></slot>

<slot name="decoration"></slot>
`;
  }

  view: any = null;

  suppressEmit = false;

  baselineCompartment = new Compartment();

  langCompartment = new Compartment();

  themeCompartment = new Compartment();

  readOnlyCompartment = new Compartment();

  placeholderCompartment = new Compartment();

  extensionsCompartment = new Compartment();

  panelCompartment = new Compartment();

  topPanelCompartment = new Compartment();

  gutterCompartment = new Compartment();

  decorationCompartment = new Compartment();

  rebuildGutterExt: any = null;

  rebuildDecorationExt: any = null;

  langExt = (): any => this.language === 'javascript' ? javascript() : [];

  themeExt = (): any => {
  const t = this.theme;
  if (t === 'dark') return oneDark;
  if (t === 'light' || t === '' || t == null) return [];
  // t is a CM Extension / Extension[] passthrough by this branch (the widened
  // `theme` prop accepts a string OR an Extension). The strict-tsc leaves get a
  // codegen return-type aid (`themeExt(): any`) so `Compartment.of`/`reconfigure`
  // accept it; the type-neutral targets strip types entirely.
  return t;
};

  phExt = (): any => this.placeholder ? placeholderExt(this.placeholder) : [];

  baselineExt = () => this.basicSetup ? [basicSetupBundle] : [lineNumbers(), history(), keymap.of([...defaultKeymap, ...historyKeymap])];

  writeDoc = (v: any) => {
  if (!this.view) return;
  const current = this.view.state.doc.toString();
  const next = v ?? '';
  if (current === next) return;
  this.suppressEmit = true;
  try {
    this.view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: next
      }
    });
  } finally {
    this.suppressEmit = false;
  }
};

  getView() {
    return this.view;
  }

  focus() {
    this.view?.focus();
  }

  getValue() {
    return this.view ? this.view.state.doc.toString() : '';
  }

  replaceValue(v: any) {
    this.writeDoc(v);
  }

  dispatch(tr: any) {
    this.view?.dispatch(tr);
  }

  insertText(text: any) {
    if (!this.view) return;
    const {
      from,
      to
    } = this.view.state.selection.main;
    this.view.dispatch({
      changes: {
        from,
        to,
        insert: text
      },
      userEvent: 'input.type'
    });
  }

  getSelection() {
    return this.view ? this.view.state.selection.main : null;
  }

  setSelection(range: any) {
    if (!this.view) return;
    const sel = typeof range === 'number' ? EditorSelection.single(range) : EditorSelection.single(range.anchor, range.head);
    this.view.dispatch({
      selection: sel
    });
  }

  undo() {
    if (this.view) cmCommands.undo(this.view);
  }

  redo() {
    if (this.view) cmCommands.redo(this.view);
  }

  selectAll() {
    if (this.view) cmCommands.selectAll(this.view);
  }

  scrollToPos(pos: any, opts: any) {
    if (!this.view) return;
    this.view.dispatch({
      effects: EditorView.scrollIntoView(pos, opts ?? {
        y: 'center'
      })
    });
  }

  get value(): string { return this._valueControllable.read(); }
  set value(v: string) { this._valueControllable.notifyPropertyWrite(v); }
}

injectGlobalStyles('rozie-code-mirror-global', `
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
  }
`);
