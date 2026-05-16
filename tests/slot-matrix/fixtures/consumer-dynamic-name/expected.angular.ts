import { Component, TemplateRef, ViewChild, ViewEncapsulation, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { Producer } from './producer';

@Component({
  selector: 'rozie-consumer',
  standalone: true,
  imports: [NgTemplateOutlet, Producer],
  template: `

    <rozie-producer><ng-template #__dynSlot_0>Dynamic fill</ng-template><ng-container *ngTemplateOutlet="templates[slotName()]"></ng-container></rozie-producer>

  `,
})
export class Consumer {
  slotName = signal('a');

  @ViewChild('__dynSlot_0', { static: true }) __dynSlot_0?: TemplateRef<unknown>;

  get templates(): Record<string, TemplateRef<unknown>> {
      return { [this.slotName()]: this.__dynSlot_0! };
    }
}

export default Consumer;
