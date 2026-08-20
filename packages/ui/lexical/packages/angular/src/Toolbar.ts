import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, signal, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { createRozieAttrApplier, createRozieHostAttrsReader, rozieToken } from '@rozie/runtime-angular';

// NAMESPACE imports (D-05): both the `$`-API selection reads AND the command
// constants come through namespace bindings, so no bare `$`-identifier ever reaches
// the Svelte compiler (spike 013 / compile-lexical-check.mjs).
import * as lexical from 'lexical';
import * as lexicalList from '@lexical/list';
import * as lexicalLink from '@lexical/link';
import * as lexicalUtils from '@lexical/utils';

// The shared editor context object provided by the shell ({ get instance() {…} },
// spike 010 late-binding getter). `$inject` binds to a `const` (ROZ132), then aliases
// through a null-`let` (typeNeutralize) so `.instance` type-checks on the strict
// bundled leaves; TOP-LEVEL scope so the hoisted Solid teardown can reach it (see
// RichTextPlugin header for the full rationale).

@Component({
  selector: 'rozie-toolbar',
  standalone: true,
  imports: [NgClass],
  template: `

    <div class="rozie-lexical-toolbar" role="toolbar" aria-label="Text formatting" #rozieSpread_0 #rozieListenersTarget_1>
      <button type="button" class="rozie-lexical-toolbar-btn" [ngClass]="{ active: active().bold }" [attr.aria-pressed]="!!active().bold" aria-label="Bold" (mousedown)="$event.preventDefault()" (click)="formatBold()"><strong>B</strong></button>
      <button type="button" class="rozie-lexical-toolbar-btn" [ngClass]="{ active: active().italic }" [attr.aria-pressed]="!!active().italic" aria-label="Italic" (mousedown)="$event.preventDefault()" (click)="formatItalic()"><em>I</em></button>
      <button type="button" class="rozie-lexical-toolbar-btn" [ngClass]="{ active: active().link }" [attr.aria-pressed]="!!active().link" aria-label="Link" (mousedown)="$event.preventDefault()" (click)="toggleLink()">Link</button>
      <button type="button" class="rozie-lexical-toolbar-btn" [ngClass]="{ active: active().list }" [attr.aria-pressed]="!!active().list" aria-label="Bullet list" (mousedown)="$event.preventDefault()" (click)="insertList()">&bull; List</button>
    </div>

  `,
  styles: [`
    :host(rozie-toolbar) { display: contents; }
    .rozie-lexical-toolbar {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem;
      margin-bottom: 0.375rem;
    }
    .rozie-lexical-toolbar-btn {
      padding: 0.25rem 0.5rem;
      min-width: 1.75rem;
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .rozie-lexical-toolbar-btn:hover {
      background: rgba(0, 0, 0, 0.05);
    }
    .rozie-lexical-toolbar-btn.active {
      background: #1a1a1a;
      color: #ffffff;
      border-color: #1a1a1a;
    }
  `],
})
export class Toolbar {
  active = signal({
    bold: false,
    italic: false,
    link: false,
    list: false
  });
  editorCtx = inject(rozieToken('rozie-lexical-editor'));
  private __rozieDestroyRef = inject(DestroyRef);

  constructor() {
    this.ctx = this.editorCtx;

    // The registerUpdateListener cleanup, captured once we register. null = not yet /
    // torn down. `disposed` guards the deferred activation against an unmount that races
    // ahead of the microtask below.
  }

  ngAfterViewInit() {
    // Defer one microtask so the parent shell's $onMount has created the editor —
    // child mount hooks fire before the parent's on React/Vue/Solid (see header).
    queueMicrotask(this.activate);
    this.__rozieDestroyRef.onDestroy(() => {
      this.disposed = true;
      if (this.teardown) {
        this.teardown();
        this.teardown = null;
      }
    });
  }

  ctx: any = null;
  teardown: any = null;
  disposed = false;
  refreshActive = () => {
    const sel = lexical.$getSelection();
    if (!lexical.$isRangeSelection(sel)) {
      this.active.set({
        bold: false,
        italic: false,
        link: false,
        list: false
      });
      return;
    }
    const anchorNode = sel.anchor.getNode();
    // Ancestor-type reads via the namespace `$`-API: a ListNode / LinkNode anywhere
    // above the caret means the current selection is inside a list / link.
    const listNode = lexicalUtils.$getNearestNodeOfType(anchorNode, lexicalList.ListNode);
    const linkNode = lexicalUtils.$getNearestNodeOfType(anchorNode, lexicalLink.LinkNode);
    this.active.set({
      bold: sel.hasFormat('bold'),
      italic: sel.hasFormat('italic'),
      link: linkNode !== null,
      list: listNode !== null
    });
  };
  activate = () => {
    if (this.teardown || this.disposed) return;
    const editor = this.ctx && this.ctx.instance;
    if (!editor) return;
    // READ side: on every editor update, read the current selection and reflect it into
    // $data.active so each button's active styling tracks the caret live. registerUpdateListener
    // returns its own cleanup.
    this.teardown = editor.registerUpdateListener(({
      editorState
    }: any) => {
      editorState.read(() => {
        this.refreshActive();
      });
    });
    // Seed the initial state so the buttons render correct active styling before the
    // first user-driven update fires.
    editor.getEditorState().read(() => {
      this.refreshActive();
    });
  };
  formatBold = () => {
    const editor = this.ctx && this.ctx.instance;
    if (!editor) return;
    editor.dispatchCommand(lexical.FORMAT_TEXT_COMMAND, 'bold');
  };
  formatItalic = () => {
    const editor = this.ctx && this.ctx.instance;
    if (!editor) return;
    editor.dispatchCommand(lexical.FORMAT_TEXT_COMMAND, 'italic');
  };
  insertList = () => {
    const editor = this.ctx && this.ctx.instance;
    if (!editor) return;
    editor.dispatchCommand(lexicalList.INSERT_UNORDERED_LIST_COMMAND, undefined);
  };
  toggleLink = () => {
    const editor = this.ctx && this.ctx.instance;
    if (!editor) return;
    editor.dispatchCommand(lexicalLink.TOGGLE_LINK_COMMAND, this.active().link ? null : 'https://example.com');
  };

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));

  private __rozieGetHostAttrs = createRozieHostAttrsReader(inject(ElementRef));

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

export default Toolbar;
