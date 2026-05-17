import { Component, ContentChild, TemplateRef, ViewEncapsulation, input } from '@angular/core';
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
    <ng-container *ngTemplateOutlet="(wrapperTpl ?? templates()?.['wrapper'])" />
    } @else {

        <div class="wrapper-fallback">
          <ng-container *ngTemplateOutlet="(innerTpl ?? templates()?.['inner'])" />
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
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  static ngTemplateContextGuard(
    _dir: NestedSlotDeclared,
    _ctx: unknown,
  ): _ctx is WrapperCtx | InnerCtx {
    return true;
  }
}

export default NestedSlotDeclared;
