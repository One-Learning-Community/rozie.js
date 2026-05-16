import { Component, TemplateRef, ViewChild, ViewEncapsulation, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { Modal } from './Modal';
import { WrapperModal } from './WrapperModal';

@Component({
  selector: 'rozie-modal-consumer',
  standalone: true,
  imports: [NgTemplateOutlet, Modal, WrapperModal],
  template: `

    <div class="modal-consumer">
      <rozie-modal [open]="open()"><ng-template #header let-close="close">
          <h2>{{ title() }}</h2>
          <button class="close" (click)="close($event)">×</button>
        </ng-template><ng-template #footer let-close="close">
          <button (click)="close($event)">Cancel</button>
          <button (click)="onConfirm()">OK</button>
        </ng-template><ng-template #defaultSlot>
        Are you sure you want to proceed?
        </ng-template></rozie-modal>

      <rozie-modal [open]="open()"><ng-template #__dynSlot_0>
          <span class="dynamic-fill">Dynamic header via slotName</span>
        </ng-template><ng-template #defaultSlot>
        Dynamic-name demo body
      </ng-template><ng-container *ngTemplateOutlet="templates[slotName()]"></ng-container></rozie-modal>

      <rozie-wrapper-modal [title]="title()"><ng-template #title>
          <h2>Re-projected title</h2>
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
  open = signal(true);
  slotName = signal('header');

  onConfirm = () => {
    this.open.set(false);
  };

  @ViewChild('__dynSlot_0', { static: true }) __dynSlot_0?: TemplateRef<unknown>;

  get templates(): Record<string, TemplateRef<unknown>> {
      return { [this.slotName()]: this.__dynSlot_0! };
    }
}

export default ModalConsumer;
