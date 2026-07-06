// Probe (throwaway, NOT a fixture) — reproduces the exact HOISTED shape
// hoistValueTransformIfImpure now emits for an impure custom-modifier
// valueTransform, to confirm the fix renders under Angular AOT.
import { Component, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'rozie-vt-probe',
  standalone: true,
  imports: [FormsModule],
  template: `
    <input [ngModel]="value()" (ngModelChange)="value.set(_rModelTransform_0($event))" [ngModelOptions]="{standalone: true}" />
  `,
})
export class VtProbe {
  value = model<string>('');

  private _rModelTransform_0 = (__v: unknown): unknown => (((__v) => { const __n = (__v as string).trim(); return __n.toUpperCase(); })((__v)));
}
