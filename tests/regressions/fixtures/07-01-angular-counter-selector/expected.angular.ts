import { Component, ViewEncapsulation, model } from '@angular/core';

@Component({
  selector: 'rozie-counter',
  standalone: true,
  template: `

    <button class="counter" (click)="bump($event)">{{ value() }}</button>

  `,
  styles: [`
    .counter { font-variant-numeric: tabular-nums; }
  `],
})
export class Counter {
  value = model<number>(0);

  bump = () => {
    this.value.set(this.value() + 1);
  };
}

export default Counter;
