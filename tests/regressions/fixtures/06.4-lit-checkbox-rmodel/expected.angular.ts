import { Component, ViewEncapsulation, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'rozie-checkbox-rmodel',
  standalone: true,
  imports: [FormsModule],
  template: `

    <label class="toggle">
      
      <input type="checkbox" [ngModel]="checked()" (ngModelChange)="checked.set($event)" [ngModelOptions]="{standalone: true}" />
      <span>Enabled</span>
    </label>

  `,
  styles: [`
    .toggle { display: inline-flex; gap: 0.25rem; align-items: center; }
  `],
})
export class CheckboxRModel {
  checked = model<boolean>(false);
}

export default CheckboxRModel;
