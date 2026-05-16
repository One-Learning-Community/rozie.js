import { Component, ViewEncapsulation } from '@angular/core';

import { Wrapper } from './wrapper';

@Component({
  selector: 'rozie-consumer',
  standalone: true,
  imports: [Wrapper],
  template: `

    <rozie-wrapper><ng-template #title>Hello from consumer</ng-template></rozie-wrapper>

  `,
})
export class Consumer {

}

export default Consumer;
