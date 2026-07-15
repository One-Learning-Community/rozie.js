import { Component, ContentChild, DestroyRef, ElementRef, EmbeddedViewRef, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, forwardRef, inject, input, model, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

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

interface PanelCtx {
  $implicit: { view: any };
  view: any;
}

interface TopPanelCtx {
  $implicit: { view: any };
  view: any;
}

interface TooltipCtx {
  $implicit: { view: any; pos: any };
  view: any;
  pos: any;
}

interface GutterCtx {
  $implicit: { line: any; view: any };
  line: any;
  view: any;
}

interface DecorationCtx {
  $implicit: { from: any; to: any; view: any };
  from: any;
  to: any;
  view: any;
}

@Component({
  selector: 'rozie-code-mirror',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="rozie-codemirror" [style]="{ height: height() + 'px' }">
      <div class="cm-mount" #hostEl></div>
    </div>










    <ng-container #rozie_portalAnchor></ng-container>
  `,
  styles: [`
    :host(rozie-code-mirror) { display: contents; }
    .rozie-codemirror {
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 4px;
      overflow: hidden;
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
    }
    .cm-mount {
      height: 100%;
      width: 100%;
    }

    ::ng-deep .rozie-codemirror .cm-editor {
        height: 100%;
        font-size: 13px;
      }
    ::ng-deep .rozie-codemirror .cm-scroller {
        height: 100%;
      }
    ::ng-deep .rozie-codemirror .rozie-cm-panel {
        padding: 2px 8px;
        border-top: 1px solid rgba(0, 0, 0, 0.12);
        font-size: 12px;
      }
    ::ng-deep .rozie-codemirror .rozie-cm-panel-top {
        padding: 2px 8px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
        font-size: 12px;
      }
    ::ng-deep .rozie-codemirror .rozie-cm-tooltip {
        padding: 2px 6px;
        font-size: 11px;
        background: #1a1a1a;
        color: #fff;
        border-radius: 3px;
        white-space: nowrap;
      }
    ::ng-deep .rozie-codemirror .rozie-cm-gutter {
        min-width: 14px;
      }
    ::ng-deep .rozie-codemirror .rozie-cm-gutter-marker {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        font-size: 11px;
        line-height: 1;
      }
    ::ng-deep .rozie-codemirror .rozie-cm-decoration {
        display: inline-flex;
        align-items: center;
        vertical-align: text-bottom;
      }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CodeMirror),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class CodeMirror {
  /**
   * The two-way document text (`r-model:value`) — the editor's contents as a string. Typing in the editor writes the new text back through the model path (CodeMirror's `updateListener` extension); a consumer write reflects into the live document, echo-guarded so a programmatic set does not ping-pong. As the sole `model: true` prop this **is** the only change channel — there are no events.
   * @example
   * <CodeMirror r-model:value="source" language="javascript" theme="dark" />
   */
  value = model<string>('');
  /**
   * Convenience language. `javascript` loads the bundled `@codemirror/lang-javascript`; any other value falls back to plain text (no syntax highlighting, no throw). Add other languages through `:extensions`. Runtime-updatable via a `langCompartment` reconfigure — switching the prop re-highlights without a remount.
   */
  language = input<string>('javascript');
  /**
   * Editor theme. The built-in strings `light` (the editor default — no theme) or `dark` (the bundled `@codemirror/theme-one-dark`), **or** a CodeMirror `Extension` / `Extension[]` passed straight through (G3) — drop in a theme package or an `EditorView.theme({…})`. A non-string theme is composed via the live `themeCompartment` so it reconfigures with no remount, same as the string forms.
   */
  theme = input<unknown>('light');
  /**
   * Make the document read-only. Runtime-updatable via a `readOnlyCompartment` reconfigure (no remount).
   */
  readOnly = input<boolean>(false);
  /**
   * Editor height in pixels, applied to the wrapper's host box.
   */
  height = input<number>(240);
  /**
   * Placeholder text shown when the document is empty (the bundled `@codemirror/view` `placeholder` extension). An empty string means no placeholder. Runtime-updatable via a `placeholderCompartment` reconfigure.
   */
  placeholder = input<string>('');
  /**
   * Consumer-extensible passthrough — an arbitrary `Extension[]` composed **last** so it wins CodeMirror's last-registered-wins facets. The CodeMirror 6 analog of an options bag: line-wrapping, autocomplete, linting, custom key-bindings, additional languages/themes — anything the curated props do not special-case. Runtime-reconfigurable via an `extensionsCompartment` (no remount when the array changes).
   */
  extensions = input<any[]>((() => [])());
  /**
   * When `true`, swap the thin manual baseline (line numbers + history + default/history keymaps) for CodeMirror 6's batteries-included `basicSetup` bundle — autocomplete, search, bracket matching, code folding, lint gutter, and richer keymaps. The curated props and consumer `:extensions` still compose **after** it, so they continue to win. Runtime-updatable via a `baselineCompartment` reconfigure — toggling it swaps the bundle live, no remount required.
   */
  basicSetup = input<boolean>(false);
  /**
   * The 1-based line numbers that each get a custom gutter marker rendered by the `gutter` reactive multi-instance portal slot (one portal handle per visible marker). Out-of-range lines are ignored. Runtime-updatable via a `gutterCompartment` reconfigure — changing the array re-marks the lines with no remount. Only meaningful when the `gutter` slot is filled.
   */
  gutterLines = input<any[]>((() => [])());
  /**
   * An array of `{ from, to? }` **0-based document offsets** that each get an inline widget rendered by the `decoration` reactive multi-instance portal slot (one portal handle per visible widget). A point widget is placed at `from`; `to` is passed through in scope for the consumer's awareness. Compute an offset from a line via `view.state.doc.line(n).from`. Runtime-updatable via a `decorationCompartment` reconfigure. Only meaningful when the `decoration` slot is filled.
   */
  decorations = input<any[]>((() => [])());
  hostEl = viewChild<ElementRef<HTMLDivElement>>('hostEl');
  @ContentChild('panel', { read: TemplateRef }) panelTpl?: TemplateRef<PanelCtx>;
  @ContentChild('topPanel', { read: TemplateRef }) topPanelTpl?: TemplateRef<TopPanelCtx>;
  @ContentChild('tooltip', { read: TemplateRef }) tooltipTpl?: TemplateRef<TooltipCtx>;
  @ContentChild('gutter', { read: TemplateRef }) gutterTpl?: TemplateRef<GutterCtx>;
  @ContentChild('decoration', { read: TemplateRef }) decorationTpl?: TemplateRef<DecorationCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _panelTpl = contentChild('panel', { read: TemplateRef });
  private _topPanelTpl = contentChild('topPanel', { read: TemplateRef });
  private _tooltipTpl = contentChild('tooltip', { read: TemplateRef });
  private _gutterTpl = contentChild('gutter', { read: TemplateRef });
  private _decorationTpl = contentChild('decoration', { read: TemplateRef });
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;
  private __rozieWatchInitial_5 = true;
  private __rozieWatchInitial_6 = true;
  private __rozieWatchInitial_7 = true;
  private __rozieWatchInitial_8 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.value())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => this.writeDoc(v))(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.language())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.langCompartment.reconfigure(this.langExt())
      });
    })(); }); });
    effect(() => { const __watchVal = (() => this.theme())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.themeCompartment.reconfigure(this.themeExt())
      });
    })(); }); });
    effect(() => { const __watchVal = (() => this.readOnly())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.readOnlyCompartment.reconfigure(EditorState.readOnly.of(v))
      });
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.placeholder())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } (() => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.placeholderCompartment.reconfigure(this.phExt())
      });
    })(); }); });
    effect(() => { const __watchVal = (() => this.extensions())(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((v: any) => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.extensionsCompartment.reconfigure(v)
      });
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.basicSetup())(); untracked(() => { if (this.__rozieWatchInitial_6) { this.__rozieWatchInitial_6 = false; return; } (() => {
      if (!this.view) return;
      this.view.dispatch({
        effects: this.baselineCompartment.reconfigure(this.baselineExt())
      });
    })(); }); });
    effect(() => { const __watchVal = (() => this.gutterLines())(); untracked(() => { if (this.__rozieWatchInitial_7) { this.__rozieWatchInitial_7 = false; return; } (() => {
      if (!this.view || !this.rebuildGutterExt) return;
      this.view.dispatch({
        effects: this.gutterCompartment.reconfigure(this.rebuildGutterExt())
      });
    })(); }); });
    effect(() => { const __watchVal = (() => this.decorations())(); untracked(() => { if (this.__rozieWatchInitial_8) { this.__rozieWatchInitial_8 = false; return; } (() => {
      if (!this.view || !this.rebuildDecorationExt) return;
      this.view.dispatch({
        effects: this.decorationCompartment.reconfigure(this.rebuildDecorationExt())
      });
    })(); }); });
  }

  ngAfterViewInit() {
    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      panel: (container: HTMLElement, scope: { view: unknown }): (() => void) => {
        const tpl = this._panelTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-panel', '34cfda5a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      topPanel: (container: HTMLElement, scope: { view: unknown }): (() => void) => {
        const tpl = this._topPanelTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-topPanel', '34cfda5a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
      tooltip: (container: HTMLElement, scope: { view: unknown; pos: unknown }): ReactivePortalHandle => {
        const tpl = this._tooltipTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-tooltip', '34cfda5a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return {
          update: (s: unknown): void => {
            Object.assign(view.context as object, s as object);
            view.detectChanges();
          },
          dispose: (): void => {
            view.destroy();
            this._portalViews.delete(view as EmbeddedViewRef<unknown>);
          },
        };
      },
      gutter: (container: HTMLElement, scope: { line: unknown; view: unknown }): ReactivePortalHandle => {
        const tpl = this._gutterTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-gutter', '34cfda5a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return {
          update: (s: unknown): void => {
            Object.assign(view.context as object, s as object);
            view.detectChanges();
          },
          dispose: (): void => {
            view.destroy();
            this._portalViews.delete(view as EmbeddedViewRef<unknown>);
          },
        };
      },
      decoration: (container: HTMLElement, scope: { from: unknown; to: unknown; view: unknown }): ReactivePortalHandle => {
        const tpl = this._decorationTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-decoration', '34cfda5a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return {
          update: (s: unknown): void => {
            Object.assign(view.context as object, s as object);
            view.detectChanges();
          },
          dispose: (): void => {
            view.destroy();
            this._portalViews.delete(view as EmbeddedViewRef<unknown>);
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
      if (!(this.panelTpl ?? this.templates()?.['panel'])) return [];
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
      if (!(this.topPanelTpl ?? this.templates()?.['topPanel'])) return [];
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
      if (!(this.tooltipTpl ?? this.templates()?.['tooltip'])) return [];
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
      if (!(this.gutterTpl ?? this.templates()?.['gutter'])) return [];
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
        for (const n of this.gutterLines() as any) {
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
      if (!(this.decorationTpl ?? this.templates()?.['decoration'])) return [];
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
        for (const d of this.decorations() as any) {
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
      extensions: [this.baselineCompartment.of(this.baselineExt()), this.langCompartment.of(this.langExt()), this.themeCompartment.of(this.themeExt()), this.readOnlyCompartment.of(EditorState.readOnly.of(this.readOnly())), this.placeholderCompartment.of(this.phExt()), this.panelCompartment.of(panelExt()), this.topPanelCompartment.of(topPanelExt()),
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
        this.value.set(update.state.doc.toString()), this.__rozieCvaOnChange(update.state.doc.toString());
      }),
      // Consumer extensions LAST so they win CM6's last-registered-wins facets.
      this.extensionsCompartment.of(this.extensions())]
    });
    this.view = new EditorView({
      state: buildState(this.value()),
      parent: this.hostEl()!.nativeElement
    });
    this.__rozieDestroyRef.onDestroy(() => this.view?.destroy());
    this.__rozieDestroyRef.onDestroy(() => {
      for (const view of this._portalViews) view.destroy();
      this._portalViews.clear();
    });
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
  langExt = (): any => this.language() === 'javascript' ? javascript() : [];
  themeExt = (): any => {
    const t = this.theme();
    if (t === 'dark') return oneDark;
    if (t === 'light' || t === '' || t == null) return [];
    // t is a CM Extension / Extension[] passthrough by this branch (the widened
    // `theme` prop accepts a string OR an Extension). The strict-tsc leaves get a
    // codegen return-type aid (`themeExt(): any`) so `Compartment.of`/`reconfigure`
    // accept it; the type-neutral targets strip types entirely.
    return t;
  };
  phExt = (): any => this.placeholder() ? placeholderExt(this.placeholder()) : [];
  baselineExt = () => this.basicSetup() ? [basicSetupBundle] : [lineNumbers(), history(), keymap.of([...defaultKeymap, ...historyKeymap])];
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
  getView = () => {
    return this.view;
  };
  focus = () => {
    this.view?.focus();
  };
  getValue = () => {
    return this.view ? this.view.state.doc.toString() : '';
  };
  replaceValue = (v: any) => {
    this.writeDoc(v);
  };
  dispatch = (tr: any) => {
    this.view?.dispatch(tr);
  };
  insertText = (text: any) => {
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
  };
  getSelection = () => {
    return this.view ? this.view.state.selection.main : null;
  };
  setSelection = (range: any) => {
    if (!this.view) return;
    const sel = typeof range === 'number' ? EditorSelection.single(range) : EditorSelection.single(range.anchor, range.head);
    this.view.dispatch({
      selection: sel
    });
  };
  undo = () => {
    if (this.view) cmCommands.undo(this.view);
  };
  redo = () => {
    if (this.view) cmCommands.redo(this.view);
  };
  selectAll = () => {
    if (this.view) cmCommands.selectAll(this.view);
  };
  scrollToPos = (pos: any, opts: any) => {
    if (!this.view) return;
    this.view.dispatch({
      effects: EditorView.scrollIntoView(pos, opts ?? {
        y: 'center'
      })
    });
  };

  private __rozieCvaOnChange: (v: string) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: string | null): void {
    this.value.set(v ?? '');
  }
  registerOnChange(fn: (v: string) => void): void {
    this.__rozieCvaOnChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.__rozieCvaOnTouchedFn = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.__rozieCvaDisabled.set(isDisabled);
  }
  __rozieCvaOnTouched(): void {
    this.__rozieCvaOnTouchedFn();
  }

  static ngTemplateContextGuard(
    _dir: CodeMirror,
    _ctx: unknown,
  ): _ctx is PanelCtx | TopPanelCtx | TooltipCtx | GutterCtx | DecorationCtx {
    return true;
  }
}

export default CodeMirror;
