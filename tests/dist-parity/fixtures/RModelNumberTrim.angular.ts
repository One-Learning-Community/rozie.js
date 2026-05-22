import { Component, ViewEncapsulation, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'rozie-rmodel-number-trim',
  standalone: true,
  imports: [FormsModule],
  template: `

    <div class="rmodel-number-trim">
      <input type="text" [ngModel]="quantity()" (ngModelChange)="quantity.set(((__v) => { const __n = parseFloat(__v); return isNaN(__n) ? __v : __n; })((($event).trim())))" [ngModelOptions]="{standalone: true}" placeholder="Enter a quantity" />
      <p class="echo">Quantity: {{ quantity() }}</p>
    </div>

  `,
  styles: [`
    .rmodel-number-trim { display: inline-flex; flex-direction: column; gap: 0.25rem; }
    .echo { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
  `],
})
export class RModelNumberTrim {
  quantity = signal(0);
}

export default RModelNumberTrim;
