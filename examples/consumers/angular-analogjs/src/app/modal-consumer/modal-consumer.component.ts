// Phase 07.2 Plan 06 — ModalConsumer dogfood page (Wave 2 close-out).
//
// ModalConsumer.rozie composes Modal + WrapperModal with named + scoped +
// default-shorthand + dynamic-name + re-projected fills — the full surface
// Phase 07.2 ships. The compiled Angular output uses `<ng-template #header>`
// blocks for named fills and a `templates` getter for the dynamic-name
// fill, per Plan 07.2-04 emit shape.
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import ModalConsumer from '../../ModalConsumer.rozie';

@Component({
  selector: 'rozie-modal-consumer-page',
  standalone: true,
  imports: [CommonModule, ModalConsumer],
  template: `
    <div data-testid="rozie-mount">
      <h2>ModalConsumer Demo</h2>
      <p>Dogfood: Modal + WrapperModal composed with named, scoped, default, dynamic-name, and re-projected fills.</p>
      <rozie-modal-consumer title="Confirm action"></rozie-modal-consumer>
    </div>
  `,
})
export class ModalConsumerPageComponent {}
