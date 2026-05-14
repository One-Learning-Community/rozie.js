import { Component, ContentChild, TemplateRef, ViewEncapsulation } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface WrapperCtx {}

interface InnerCtx {}

@Component({
  selector: 'rozie-nested-slot-declared',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="outer">
      
      @if (wrapperTpl) {
    <ng-container *ngTemplateOutlet="wrapperTpl" />
    } @else {

        <div class="wrapper-fallback">
          <ng-container *ngTemplateOutlet="innerTpl" />
        </div>
      
    }
    </div>

  `,
  styles: [`
    .outer { display: block; }
  `],
})
export class NestedSlotDeclared {
  @ContentChild('wrapper', { read: TemplateRef }) wrapperTpl?: TemplateRef<WrapperCtx>;
  @ContentChild('inner', { read: TemplateRef }) innerTpl?: TemplateRef<InnerCtx>;

  static ngTemplateContextGuard(
    _dir: NestedSlotDeclared,
    _ctx: unknown,
  ): _ctx is WrapperCtx | InnerCtx {
    return true;
  }
}

export default NestedSlotDeclared;
