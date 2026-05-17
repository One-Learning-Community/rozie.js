import { Component, ViewEncapsulation, signal } from '@angular/core';

import { Producer } from './producer';
import { Inner } from './producer';

@Component({
  selector: 'rozie-consumer',
  standalone: true,
  imports: [Producer, Inner],
  template: `

    <rozie-producer [open]="outerOpen()" (openChange)="outerOpen.set($event)"><ng-template #footer let-close="close">
        <rozie-inner [open]="outerOpen()" (openChange)="outerOpen.set($event)"></rozie-inner>
        <button (click)="close($event)">×</button>
      </ng-template></rozie-producer>

  `,
})
export class Consumer {
  outerOpen = signal(true);
  innerVal = signal('hello');
}

export default Consumer;
