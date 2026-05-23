import { Component, ElementRef, Renderer2, TemplateRef, ViewChild, ViewEncapsulation, effect, inject, input, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { Modal } from './Modal';
import { WrapperModal } from './WrapperModal';

@Component({
  selector: 'rozie-modal-consumer',
  standalone: true,
  imports: [NgTemplateOutlet, Modal, WrapperModal],
  template: `

    <div class="modal-consumer" #rozieSpread_0>
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

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (v === null || v === false) renderer.removeAttribute(el, k);
        else renderer.setAttribute(el, k, String(v));
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

  private __rozieSpread_0_effect = effect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });

  @ViewChild('__dynSlot_0', { static: true }) __dynSlot_0?: TemplateRef<unknown>;

  get templates(): Record<string, TemplateRef<unknown>> {
      return { [this.slotName()]: this.__dynSlot_0! };
    }
}

export default ModalConsumer;
