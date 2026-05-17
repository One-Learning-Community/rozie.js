import { Component, ContentChild, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface DefaultCtx {}

@Component({
  selector: 'rozie-default-slot-fixture',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="default-slot-fixture">
      <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" />
    </div>

  `,
})
export class DefaultSlotFixture {
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  static ngTemplateContextGuard(
    _dir: DefaultSlotFixture,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }
}

export default DefaultSlotFixture;
