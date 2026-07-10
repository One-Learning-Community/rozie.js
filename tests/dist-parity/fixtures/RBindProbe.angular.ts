import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'rozie-rbind-probe',
  standalone: true,
  imports: [NgClass],
  template: `

    <div class="rbind-probe" #rozieListenersTarget_0>
      <span [ngClass]="['a', 'b']" #rozieSpread_1>canonical</span>
      <span #rozieSpread_2 [ngClass]="['b', 'a']">reordered</span>
    </div>

  `,
  styles: [`
    :host(rozie-rbind-probe) { display: contents; }
    .rbind-probe {
      display: inline-flex;
      gap: 0.5rem;
      padding: 0.25rem;
    }
    .a { color: #1f2937; }
    .b { font-weight: 700; }
  `],
})
export class RBindProbe {


  private __rozieDestroyRef = inject(DestroyRef);

  private rozieListenersTarget_0 = viewChild<ElementRef>('rozieListenersTarget_0');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_0: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_0 = false;

  private __rozieListenersEffect_0 = effect(() => {
    const el = this.rozieListenersTarget_0()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_0) off();
    this.__rozieListenersDisposers_0 = [];
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (typeof v !== 'function') continue;
      const norm = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
      const dispose = this.__rozieListenersRenderer.listen(el, norm, v as EventListener);
      this.__rozieListenersDisposers_0.push(dispose);
    }
    if (!this.__rozieListenersDestroyRegistered_0) {
      this.__rozieListenersDestroyRegistered_0 = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const off of this.__rozieListenersDisposers_0) off();
        this.__rozieListenersDisposers_0 = [];
      });
    }
  });

  private rozieSpread_1 = viewChild<ElementRef>('rozieSpread_1');

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

  private __rozieSpread_1_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_1()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, { id: 'x' });
  });

  private rozieSpread_2 = viewChild<ElementRef>('rozieSpread_2');

  private __rozieSpread_2_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_2()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, { id: 'y' });
  });
}

export default RBindProbe;
