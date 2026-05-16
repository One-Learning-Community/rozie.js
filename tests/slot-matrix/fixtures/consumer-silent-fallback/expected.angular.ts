import { Component, ViewEncapsulation } from '@angular/core';

import { Producer } from './producer';

@Component({
  selector: 'rozie-consumer',
  standalone: true,
  imports: [Producer],
  template: `

    <rozie-producer [title]="'Hello'"><ng-template #defaultSlot>Body text</ng-template></rozie-producer>

  `,
})
export class Consumer {

}

export default Consumer;
