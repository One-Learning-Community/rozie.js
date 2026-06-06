import { Component, ContentChild, DestroyRef, ElementRef, EmbeddedViewRef, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, forwardRef, inject, input, model, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { EditorState, Compartment, EditorSelection } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, showPanel, placeholder as placeholderExt } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

interface PanelCtx {
  $implicit: { view: any };
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
    .rozie-codemirror :global(.cm-editor) {
      height: 100%;
      font-size: 13px;
    }
    .rozie-codemirror :global(.cm-scroller) {
      height: 100%;
    }
    .rozie-codemirror :global(.rozie-cm-panel) {
      padding: 2px 8px;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
      font-size: 12px;
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
  value = model<string>('');
  language = input<string>('javascript');
  theme = input<string>('light');
  readOnly = input<boolean>(false);
  height = input<number>(240);
  placeholder = input<string>('');
  extensions = input<any[]>((() => [])());
  hostEl = viewChild<ElementRef<HTMLDivElement>>('hostEl');
  @ContentChild('panel', { read: TemplateRef }) panelTpl?: TemplateRef<PanelCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _panelTpl = contentChild('panel', { read: TemplateRef });
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;
  private __rozieWatchInitial_5 = true;

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
  }

  ngAfterViewInit() {
    const portals = {
      panel: (container: HTMLElement, scope: { view: unknown }): (() => void) => {
        const tpl = this._panelTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-panel', '34cfda5a');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
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
    const buildState = (doc: any) => EditorState.create({
      doc,
      extensions: [lineNumbers(), history(), keymap.of([...defaultKeymap, ...historyKeymap]), this.langCompartment.of(this.langExt()), this.themeCompartment.of(this.themeExt()), this.readOnlyCompartment.of(EditorState.readOnly.of(this.readOnly())), this.placeholderCompartment.of(this.phExt()), this.panelCompartment.of(panelExt()), EditorView.updateListener.of((update: any) => {
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
  langCompartment = new Compartment();
  themeCompartment = new Compartment();
  readOnlyCompartment = new Compartment();
  placeholderCompartment = new Compartment();
  extensionsCompartment = new Compartment();
  panelCompartment = new Compartment();
  langExt = () => this.language() === 'javascript' ? javascript() : [];
  themeExt = () => this.theme() === 'dark' ? oneDark : [];
  phExt = () => this.placeholder() ? placeholderExt(this.placeholder()) : [];
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

  private __rozieCvaOnChange: (v: string) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  private __rozieCvaDisabled = signal(false);

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
  ): _ctx is PanelCtx {
    return true;
  }
}

export default CodeMirror;
