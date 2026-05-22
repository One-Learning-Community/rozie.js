import { Component, DestroyRef, ViewEncapsulation, effect, inject, signal } from '@angular/core';

@Component({
  selector: 'rozie-class-selector-probe',
  standalone: true,
  template: `

    <div class="panel" [attr.data-handle]="'.panel'" [attr.data-grip]="gripSelector">
      <span class="grip" aria-hidden="true">⋮⋮</span>
      @if (ready()) {
    <span>ready</span>
    }</div>

  `,
  styles: [`
    .panel {
      display: block;
      padding: 0.5rem;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .grip {
      cursor: grab;
      user-select: none;
      color: rgba(0, 0, 0, 0.35);
    }
  `],
})
export class ClassSelectorProbe {
  ready = signal(false);

  ngAfterViewInit() {
    this.ready.set(true);
  }

  gripSelector = ".grip";
}

export default ClassSelectorProbe;
