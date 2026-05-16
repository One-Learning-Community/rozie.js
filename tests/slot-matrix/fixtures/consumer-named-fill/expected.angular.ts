import { Component, ViewEncapsulation } from '@angular/core';

import { Producer } from './producer';

@Component({
  selector: 'rozie-consumer',
  standalone: true,
  imports: [Producer],
  template: `

    <rozie-producer><ng-template #header>
        <h2>Custom Header</h2>
      </ng-template><ng-template #defaultSlot>
      Custom body content
    </ng-template></rozie-producer>

  `,
})
export class Consumer {

}

export default Consumer;
