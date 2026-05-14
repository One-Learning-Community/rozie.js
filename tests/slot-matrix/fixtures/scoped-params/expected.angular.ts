import { Component, ContentChild, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface ItemCtx {
  $implicit: { value: any };
  value: any;
}

@Component({
  selector: 'rozie-scoped-params-fixture',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="scoped-params-fixture">
      <ng-container *ngTemplateOutlet="itemTpl; context: { $implicit: { value: label() }, value: label() }" />
    </div>

  `,
})
export class ScopedParamsFixture {
  label = input<string>('item');
  @ContentChild('item', { read: TemplateRef }) itemTpl?: TemplateRef<ItemCtx>;

  static ngTemplateContextGuard(
    _dir: ScopedParamsFixture,
    _ctx: unknown,
  ): _ctx is ItemCtx {
    return true;
  }
}

export default ScopedParamsFixture;
