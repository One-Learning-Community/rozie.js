import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, input, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-array-style-merge',
  standalone: true,
  template: `

      <div #rozieSpread_0 #rozieListenersTarget_1>
        <span [attr.style]="__rozieMergeStyle({ color: 'red' }, { color: 'blue' })">object+object override (later wins → blue)</span>
        <span [attr.style]="__rozieMergeStyle(s(), { fontSize: '12px' })">string+object</span>
        <span [attr.style]="__rozieMergeStyle(base(), s())">dynamic+dynamic</span>
      </div>

  `,
  styles: [`
    :host(rozie-array-style-merge) { display: contents; }
  `],
})
export class ArrayStyleMerge {
  base = input<Record<string, any>>((() => ({}))());
  s = input<string>('');

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

  __rozieMergeStyle(
    ...parts: Array<string | Record<string, string | number> | null | undefined>
  ): string {
    const decls: string[] = [];
    for (const part of parts) {
      if (part == null) continue;
      if (typeof part === 'string') {
        const trimmed = part.trim().replace(/;+\s*$/, '');
        if (trimmed !== '') decls.push(trimmed);
        continue;
      }
      for (const key of Object.keys(part)) {
        const value = part[key];
        if (value == null) continue;
        const kebabKey = key.startsWith('--')
          ? key
          : key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
        decls.push(`${kebabKey}: ${value}`);
      }
    }
    return decls.join('; ');
  }
}

export default ArrayStyleMerge;
