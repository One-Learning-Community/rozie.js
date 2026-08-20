import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, input, signal, viewChild } from '@angular/core';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

import { Modal } from './Modal';
import { WrapperModal } from './WrapperModal';

@Component({
  selector: 'rozie-modal-consumer',
  standalone: true,
  imports: [RozieSlot, Modal, WrapperModal],
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

      <rozie-modal [open]="open2()" (openChange)="open2.set($event)"><ng-template [rozieSlot]="slotName()">
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
    :host(rozie-modal-consumer) { display: contents; }
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

export default ModalConsumer;
