import { Component, ViewEncapsulation, signal } from '@angular/core';

@Component({
  selector: 'rozie-event-loop-var-shadow',
  standalone: true,
  template: `

    <ul>
      @for (e of items(); track e.id) {
    <li>
        <span>{{ e.label }}</span>
        
        <button type="button" (click)="removeItem(e.id)">×</button>
      </li>
    }
    </ul>

  `,
})
export class EventLoopVarShadow {
  items = signal([{
    id: 'a',
    label: 'A'
  }, {
    id: 'b',
    label: 'B'
  }]);

  removeItem = (id: any) => {
    this.items.set(this.items().filter((x: any) => x.id !== id));
  };
}

export default EventLoopVarShadow;
