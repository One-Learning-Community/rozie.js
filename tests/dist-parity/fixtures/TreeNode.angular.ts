import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-tree-node',
  standalone: true,
  imports: [forwardRef(() => TreeNode)],
  template: `

    <div class="tree-node" #rozieSpread_0 #rozieListenersTarget_1>
      <span class="tree-node__label">{{ rozieDisplay(node().label) }}</span>
      @if (node().children && node().children.length > 0) {
    <ul class="tree-node__children">
        @for (child of node().children; track child.id; let childIndex = $index) {
    <li [attr.data-index]="rozieAttr(childIndex)">
          <rozie-tree-node [node]="child"></rozie-tree-node>
        </li>
    }
      </ul>
    }</div>

  `,
  styles: [`
    :host(rozie-tree-node) { display: contents; }
    .tree-node { font-family: system-ui; padding-left: 0.5rem; }
    .tree-node__label { display: inline-block; }
    .tree-node__children { list-style: none; margin: 0.25rem 0 0 0; padding-left: 1rem; border-left: 1px dashed currentColor; }
  `],
})
export class TreeNode {
  node = input<Record<string, any>>((() => ({
    id: '',
    label: '',
    children: []
  }))());

  private __rozieDestroyRef = inject(DestroyRef);

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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default TreeNode;
