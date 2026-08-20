import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

// Tiny inline "engine" that appends a `.cm-editor` element the author cannot
// reach with scoped CSS (no Rozie scope attribute is stamped onto it). The
// :root { } engine rule is the only mechanism that styles it across targets.
class MiniEngine {
  constructor(rootEl: any) {
    this.rootEl = rootEl;
    const editor = document.createElement('div');
    editor.className = 'cm-editor';
    const scroller = document.createElement('div');
    scroller.className = 'cm-scroller';
    editor.appendChild(scroller);
    rootEl.appendChild(editor);
    this.editor = editor;
  }
  destroy() {
    if (this.editor) this.editor.remove();
    this.editor = null;
  }
}

@Component({
  selector: 'rozie-engine-dom-escape',
  standalone: true,
  template: `

    <div class="rozie-engine-host" #__rozieRoot #rozieSpread_0 #rozieListenersTarget_1></div>

  `,
  styles: [`
    :host(rozie-engine-dom-escape) { display: contents; }
    .rozie-engine-host {
      display: block;
      position: relative;
    }

    ::ng-deep :root {
    --rozie-engine-accent: #4f46e5;
    }

    ::ng-deep .rozie-engine-host .cm-editor {
        height: 100%;
        font-size: 13px;
        color: var(--rozie-engine-accent);
      }
    ::ng-deep .rozie-engine-host .cm-scroller {
        height: 100%;
        overflow: auto;
      }
  `],
})
export class EngineDomEscape {
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  private __rozieDestroyRef = inject(DestroyRef);

  ngAfterViewInit() {
    this.instance = new MiniEngine(this.__rozieRoot()!.nativeElement);
    this.__rozieDestroyRef.onDestroy(() => this.instance?.destroy());
  }

  instance: any = null;

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

export default EngineDomEscape;
