import { Component, ViewEncapsulation, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'rozie-rmodel-number-trim',
  standalone: true,
  imports: [FormsModule],
  template: `

    <div class="rmodel-number-trim">
      <input type="text" [ngModel]="quantity()" (ngModelChange)="quantity.set((Number.isNaN(Number.parseFloat((($event).trim()))) ? (($event).trim()) : Number.parseFloat((($event).trim()))))" [ngModelOptions]="{standalone: true}" placeholder="Enter a quantity" />
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

  protected readonly Number = Number;
}

export default RModelNumberTrim;
