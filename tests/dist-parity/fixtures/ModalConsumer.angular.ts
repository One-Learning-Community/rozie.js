import { Component, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewChild, ViewEncapsulation, afterRenderEffect, effect, inject, input, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { Modal } from './Modal';
import { WrapperModal } from './WrapperModal';

@Component({
  selector: 'rozie-modal-consumer',
  standalone: true,
  imports: [NgTemplateOutlet, Modal, WrapperModal],
  template: `

    <div class="modal-consumer" #rozieSpread_0 #rozieListenersTarget_1>
      <rozie-modal [open]="open1()" (openChange)="open1.set($event)"><ng-template #header let-close="close">
          <h2>{{ title() }}</h2>
          <button class="close" (click)="close($event)">×</button>
        </ng-template><ng-template #footer let-close="close">
          <button (click)="close($event)">Cancel</button>
          <button (click)="onConfirm()">OK</button>
        </ng-template><ng-template #defaultSlot>
        Are you sure you want to proceed?
        </ng-template></rozie-modal>

      <rozie-modal [open]="open2()" (openChange)="open2.set($event)" [templates]="templates"><ng-template #__dynSlot_0>
          <span class="dynamic-fill">Dynamic header via slotName</span>
        </ng-template><ng-template #defaultSlot>
        Dynamic-name demo body
      </ng-template></rozie-modal>

      <rozie-wrapper-modal [open]="open3()" (openChange)="open3.set($event)" [title]="title()"><ng-template #brand>
          <h2>Re-projected brand</h2>
        </ng-template><ng-template #actions>
          <button>Wrapper action</button>
        </ng-template><ng-template #defaultSlot>
        Body via wrapper's default slot
        </ng-template></rozie-wrapper-modal>
    </div>

  `,
  styles: [`
    .modal-consumer { display: flex; flex-direction: column; gap: 1rem; }
    .close { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
    .dynamic-fill { font-weight: bold; }
  `],
})
export class ModalConsumer {
  title = input<string>('Confirm');
  open1 = signal(true);
  open2 = signal(true);
  open3 = signal(true);
  slotName = signal('header');

  onConfirm = () => {
    this.open1.set(false);
  };

  private __rozieDestroyRef = inject(DestroyRef);

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

  @ViewChild('__dynSlot_0', { static: true }) __dynSlot_0?: TemplateRef<unknown>;

  get templates(): Record<string, TemplateRef<unknown>> {
      return { [this.slotName()]: this.__dynSlot_0! };
    }
}

export default ModalConsumer;
