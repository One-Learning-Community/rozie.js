import { Component, ContentChild, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { Inner } from './inner';

interface TitleCtx {}

interface DefaultCtx {}

@Component({
  selector: 'rozie-wrapper',
  standalone: true,
  imports: [NgTemplateOutlet, Inner],
  template: `

    <rozie-inner><ng-template #header>
        @if ((titleTpl ?? templates()?.['title'])) {
    <ng-container *ngTemplateOutlet="(titleTpl ?? templates()?.['title'])" />
    } @else {
    default title
    }
      </ng-template><ng-template #defaultSlot>@if ((defaultTpl ?? templates()?.['defaultSlot'])) {
    <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" />
    } @else {
    default body
    }</ng-template></rozie-inner>

  `,
  styles: [`
    :host(rozie-wrapper) { display: contents; }
  `],
})
export class Wrapper {
  @ContentChild('title', { read: TemplateRef }) titleTpl?: TemplateRef<TitleCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  static ngTemplateContextGuard(
    _dir: Wrapper,
    _ctx: unknown,
  ): _ctx is TitleCtx | DefaultCtx {
    return true;
  }
}

export default Wrapper;
