import { Component, ContentChild, TemplateRef, ViewEncapsulation } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface WrapperCtx {}

@Component({
  selector: 'rozie-nested-slots-fixture',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="nested-slots-fixture">
      @if (wrapperTpl) {
    <ng-container *ngTemplateOutlet="wrapperTpl" />
    } @else {

        <div class="wrapper-fallback">
          <ng-container *ngTemplateOutlet="innerTpl" />
        </div>
      
    }
    </div>

  `,
})
export class NestedSlotsFixture {
  @ContentChild('wrapper', { read: TemplateRef }) wrapperTpl?: TemplateRef<WrapperCtx>;

  static ngTemplateContextGuard(
    _dir: NestedSlotsFixture,
    _ctx: unknown,
  ): _ctx is WrapperCtx {
    return true;
  }
}

export default NestedSlotsFixture;
