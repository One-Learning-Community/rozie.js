import { Component, ViewEncapsulation, input } from '@angular/core';

@Component({
  selector: 'rozie-card-header',
  standalone: true,
  template: `

    <header class="card-header">
      <h3 class="card-header__title">{{ title() }}</h3>
      @if (onClose()) {
    <button class="card-header__close" (click)="(onClose())($event)">×</button>
    }</header>

  `,
  styles: [`
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
    .card-header__title { margin: 0; font-size: 1rem; font-weight: 600; }
    .card-header__close { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }
  `],
})
export class CardHeader {
  title = input<string>('');
  onClose = input<(...args: unknown[]) => unknown>(null);
}

export default CardHeader;
