import { Component, ContentChild, DestroyRef, ElementRef, InjectionToken, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

// D-05 / REQ-37: the namespace-import form is the ONLY cross-target-safe way to
// use Lexical's `$`-prefixed API. Every `$`-call below is `lexical.$…` (a property
// access), never a bare `$`-identifier — that is what keeps the emitted Svelte
// clean of `dollar_prefix_invalid`.
import * as lexical from 'lexical';
// Non-`$` helpers use ordinary named imports (unaffected by the Svelte reservation).
import { registerRichText, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { mergeRegister } from '@lexical/utils';
// The reference @mention DecoratorNode (D-07) + the per-target mount bridge
// (D-06/REQ-39). BOTH are VENDORED by codegen into every leaf: `./MentionNode`
// resolves to the shared neutral node, and `./mountDecorators` resolves to the
// leaf's target-matched hand-written bridge (one import specifier, 5 different
// vendored files). Only the non-`$` `MentionNode` CLASS + `mountDecorators` fn are
// imported here — never a `$`-prefixed named import (that would trip Svelte's
// dollar_prefix_invalid, D-05).
import { MentionNode } from './MentionNode';
import { mountDecorators } from './mountDecorators';

// The live editor instance — null before mount / after teardown. Declared at
// TOP-LEVEL script scope (NOT inside $onMount) so it is reachable from BOTH the
// $provide getter below AND the Solid-split onCleanup teardown, which the Solid
// emitter hoists OUTSIDE the mount-body IIFE (the ADDING-A-FAMILY cross-phase-scope
// gotcha — a mount-local `let` would be TS2304 in the teardown).

interface DefaultCtx {}

const __rozieTokenRegistry: Map<string, InjectionToken<unknown>> =
  ((globalThis as Record<string, unknown>).__rozieCtx ??= new Map()) as Map<
    string,
    InjectionToken<unknown>
  >;
function rozieToken(key: string): InjectionToken<unknown> {
  let token = __rozieTokenRegistry.get(key);
  if (!token) {
    token = new InjectionToken<unknown>('rozie:' + key);
    __rozieTokenRegistry.set(key, token);
  }
  return token;
}

@Component({
  selector: 'rozie-lexical-editor',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="rozie-lexical" #rozieSpread_0 #rozieListenersTarget_1>
      
      <div #rootEl class="rozie-lexical-content" [contentEditable]="true" [attr.aria-label]="ariaLabel()"></div>
      
      <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" />
    </div>

  `,
  styles: [`
    :host(rozie-lexical-editor) { display: contents; }
    .rozie-lexical {
      display: block;
    }
    .rozie-lexical-content {
      min-height: 6rem;
      padding: 0.625rem 0.875rem;
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 6px;
      outline: none;
      font: inherit;
    }
    .rozie-lexical-content:focus {
      border-color: #4f46e5;
    }

    ::ng-deep .rozie-lexical-content strong {
        font-weight: 700;
      }
    ::ng-deep .rozie-lexical-content em {
        font-style: italic;
      }
    ::ng-deep .rozie-lexical-content ul {
        margin: 0.25rem 0;
        padding-left: 1.5rem;
      }
    ::ng-deep .rozie-lexical-content ol {
        margin: 0.25rem 0;
        padding-left: 1.5rem;
      }
    ::ng-deep .rozie-lexical-content h1 {
        font-size: 1.5rem;
        margin: 0.5rem 0 0.375rem;
      }
    ::ng-deep .rozie-lexical-content h2 {
        font-size: 1.25rem;
        margin: 0.5rem 0 0.375rem;
      }
    ::ng-deep .rozie-lexical-content .rozie-mention {
        background: var(--rozie-lexical-mention-bg, #e0e7ff);
        border-radius: var(--rozie-lexical-mention-radius, 6px);
        padding: var(--rozie-lexical-mention-padding, 1px 6px);
        font-size: var(--rozie-lexical-mention-font-size, 0.875rem);
      }
  `],
  providers: [
    {
      provide: rozieToken('rozie-lexical-editor'),
      useFactory: () => { const __rozieCtxHost = inject(forwardRef(() => LexicalEditor)); return ({
  get instance() {
    return __rozieCtxHost.editor;
  }
}); },
    },
  ],
})
export class LexicalEditor {
  /**
   * Extra Lexical node classes to register at editor creation. Lexical requires every node class to be declared up front, so consumer node extensions are passed here and composed after the built-in RichText/List/Link + `@mention` `MentionNode` set (the reference DecoratorNode is registered by the shell itself; these consumer nodes are composed last so they win).
   */
  nodes = input<any[]>((() => [])());
  /**
   * The Lexical editor `namespace` (scopes clipboard/collaboration). Falls back to `rozie-lexical` when left empty.
   */
  namespace = input<string>('');
  /**
   * Accessible name (`aria-label`) applied to the contenteditable host. Omitted from the DOM when unset — supply one for a labelled editing region.
   */
  ariaLabel = input<(string) | null>(null);
  /**
   * Lexical `theme` object mapping node/format types to CSS class names. The styling hook for this deliberately-unstyled primitive (D-12) — bring your own design-system classes.
   */
  theme = input<Record<string, any>>((() => ({}))());
  rootEl = viewChild<ElementRef<HTMLDivElement>>('rootEl');
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieDestroyRef = inject(DestroyRef);

  ngAfterViewInit() {
    this.editor = lexical.createEditor({
      namespace: this.namespace() || 'rozie-lexical',
      // The full v1.0 node CLASS set is declared here (Lexical requires all node
      // classes up front); consumer `nodes` are composed LAST so they win.
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, MentionNode, ...this.nodes()],
      // Fail-loud: rethrow rather than swallow editor-state corruption (T-76-01).
      onError: (e: any) => {
        throw e;
      },
      theme: this.theme()
    });

    // Bind the editor to the authored contenteditable host.
    // Bind the editor to the authored contenteditable host.
    this.editor.setRootElement(this.rootEl()!.nativeElement);

    // Register the RichText baseline AND wire the per-target @mention decorator bridge
    // (D-06): mountDecorators returns an unregister fn, folded into the same
    // mergeRegister so the decorator listener tears down with everything else. Plugin
    // components (wave 2) add History/List/Link BEHAVIOR against the same $injected
    // editor. mountDecorators runs AFTER setRootElement so getElementByKey resolves.
    // Register the RichText baseline AND wire the per-target @mention decorator bridge
    // (D-06): mountDecorators returns an unregister fn, folded into the same
    // mergeRegister so the decorator listener tears down with everything else. Plugin
    // components (wave 2) add History/List/Link BEHAVIOR against the same $injected
    // editor. mountDecorators runs AFTER setRootElement so getElementByKey resolves.
    const cleanup = mergeRegister(registerRichText(this.editor), mountDecorators(this.editor));

    // Seed an empty paragraph so the caret has a block to land in when the document
    // is empty (the spike 015 seed pattern, in the `lexical.$…` namespace form).
    // Seed an empty paragraph so the caret has a block to land in when the document
    // is empty (the spike 015 seed pattern, in the `lexical.$…` namespace form).
    this.editor.update(() => {
      const root = lexical.$getRoot();
      if (root.getFirstChild() === null) {
        const paragraph = lexical.$createParagraphNode();
        root.append(paragraph);
      }
    });

    // Teardown colocated in the $onMount return (D-04): unregister everything, then
    // null the instance so a late teardown read sees a defined value.
    this.__rozieDestroyRef.onDestroy(() => {
      cleanup();
      this.editor = null;
    });
  }

  editor: any = null;

  static ngTemplateContextGuard(
    _dir: LexicalEditor,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    const prevClassTokensByElement = new WeakMap<HTMLElement, string[]>();
    const prevStylePropsByElement = new WeakMap<HTMLElement, string[]>();
    const parseClassTokens = (value: unknown): string[] => {
      if (typeof value !== 'string') return [];
      const out: string[] = [];
      for (const tok of value.split(/\s+/)) {
        if (tok.length > 0) out.push(tok);
      }
      return out;
    };
    const parseStyleDecls = (value: unknown): Array<[string, string]> => {
      if (typeof value !== 'string') return [];
      const out: Array<[string, string]> = [];
      for (const decl of value.split(';')) {
        const colon = decl.indexOf(':');
        if (colon < 0) continue;
        const prop = decl.slice(0, colon).trim();
        const val = decl.slice(colon + 1).trim();
        if (prop.length > 0) out.push([prop, val]);
      }
      return out;
    };
    const applyClassMerge = (el: HTMLElement, value: unknown) => {
      const next = parseClassTokens(value);
      const prev = prevClassTokensByElement.get(el) ?? [];
      const nextSet = new Set(next);
      for (const tok of prev) {
        if (!nextSet.has(tok)) el.classList.remove(tok);
      }
      for (const tok of next) el.classList.add(tok);
      prevClassTokensByElement.set(el, next);
    };
    const applyStyleMerge = (el: HTMLElement, value: unknown) => {
      const next = parseStyleDecls(value);
      const prev = prevStylePropsByElement.get(el) ?? [];
      const nextProps = next.map(([p]) => p);
      const nextSet = new Set(nextProps);
      for (const prop of prev) {
        if (!nextSet.has(prop)) el.style.removeProperty(prop);
      }
      for (const [prop, val] of next) el.style.setProperty(prop, val, 'important');
      prevStylePropsByElement.set(el, nextProps);
    };
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (k === 'class' || k === 'style') continue;
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      if (!('class' in safeObj) && prevClassTokensByElement.has(el)) {
        applyClassMerge(el, '');
      }
      if (!('style' in safeObj) && prevStylePropsByElement.has(el)) {
        applyStyleMerge(el, '');
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (k === 'class') {
          applyClassMerge(el, v);
        } else if (k === 'style') {
          applyStyleMerge(el, v);
        } else if (v === null || v === false) {
          renderer.removeAttribute(el, k);
        } else {
          renderer.setAttribute(el, k, String(v));
        }
      }
      prevKeysByElement.set(el, Object.keys(safeObj));
    };
  })();

  private __rozieGetHostAttrs = (() => {
    const host = inject(ElementRef);
    return () => {
      const el = host.nativeElement as HTMLElement;
      const out: Record<string, unknown> = {};
      for (const a of Array.from(el.attributes)) out[a.name] = a.value;
      return out;
    };
  })();

  private __rozieSpread_0_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });

  private rozieListenersTarget_1 = viewChild<ElementRef>('rozieListenersTarget_1');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_1: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_1 = false;

  private __rozieListenersEffect_1 = effect(() => {
    const el = this.rozieListenersTarget_1()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_1) off();
    this.__rozieListenersDisposers_1 = [];
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (typeof v !== 'function') continue;
      const norm = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
      const dispose = this.__rozieListenersRenderer.listen(el, norm, v as EventListener);
      this.__rozieListenersDisposers_1.push(dispose);
    }
    if (!this.__rozieListenersDestroyRegistered_1) {
      this.__rozieListenersDestroyRegistered_1 = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const off of this.__rozieListenersDisposers_1) off();
        this.__rozieListenersDisposers_1 = [];
      });
    }
  });
}

export default LexicalEditor;
