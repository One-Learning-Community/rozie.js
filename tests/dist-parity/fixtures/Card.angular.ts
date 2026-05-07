import { Component, ContentChild, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { CardHeader } from './CardHeader';

interface DefaultCtx {}

@Component({
  selector: 'rozie-card',
  standalone: true,
  imports: [NgTemplateOutlet, CardHeader],
  template: `

    <article class="card">
      <rozie-card-header [title]="title()" [on-close]="onClose()"></rozie-card-header>
      <div class="card__body">
        <ng-container *ngTemplateOutlet="defaultTpl" />
      </div>
    </article>

  `,
  styles: [`
    .card { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
    .card__body { padding: 1rem; }
  `],
})
export class Card {
  title = input<string>('');
  onClose = input<(...args: unknown[]) => unknown>(null);
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;

  static ngTemplateContextGuard(
    _dir: Card,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }
}

export default Card;
