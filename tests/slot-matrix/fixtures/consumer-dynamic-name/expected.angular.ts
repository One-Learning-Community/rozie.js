import { Component, ViewEncapsulation, signal } from '@angular/core';
import { RozieSlot } from '@rozie/runtime-angular';

import { Producer } from './producer';

@Component({
  selector: 'rozie-consumer',
  standalone: true,
  imports: [RozieSlot, Producer],
  template: `

    <rozie-producer><ng-template [rozieSlot]="slotName()">Dynamic fill</ng-template></rozie-producer>

  `,
  styles: [`
    :host(rozie-consumer) { display: contents; }
  `],
})
export class Consumer {
  slotName = signal('a');
}

export default Consumer;
