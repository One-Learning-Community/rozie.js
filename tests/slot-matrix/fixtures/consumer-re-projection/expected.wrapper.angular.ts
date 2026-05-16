import { Component, ContentChild, TemplateRef, ViewEncapsulation } from '@angular/core';
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
        @if (titleTpl) {
    <ng-container *ngTemplateOutlet="titleTpl" />
    } @else {
    default title
    }
      </ng-template><ng-template #defaultSlot>@if (defaultTpl) {
    <ng-container *ngTemplateOutlet="defaultTpl" />
    } @else {
    default body
    }</ng-template></rozie-inner>

  `,
})
export class Wrapper {
  @ContentChild('title', { read: TemplateRef }) titleTpl?: TemplateRef<TitleCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;

  static ngTemplateContextGuard(
    _dir: Wrapper,
    _ctx: unknown,
  ): _ctx is TitleCtx | DefaultCtx {
    return true;
  }
}

export default Wrapper;
