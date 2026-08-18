import { Directive, TemplateRef, inject, input } from '@angular/core';

@Directive({
  selector: 'ng-template[rozieSlot]',
  standalone: true,
})
export class RozieSlot {
  readonly rozieSlot = input.required<string>();
  readonly templateRef = inject(TemplateRef<unknown>);
}
