import { Component, ContentChild, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface StatusCtx {}

@Component({
  selector: 'rozie-default-content-fallback-fixture',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="default-content-fallback-fixture">
      @if (statusTpl) {
    <ng-container *ngTemplateOutlet="(statusTpl ?? templates()?.['status'])" />
    } @else {

        <span class="fallback">No status provided.</span>
      
    }
    </div>

  `,
})
export class DefaultContentFallbackFixture {
  @ContentChild('status', { read: TemplateRef }) statusTpl?: TemplateRef<StatusCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  static ngTemplateContextGuard(
    _dir: DefaultContentFallbackFixture,
    _ctx: unknown,
  ): _ctx is StatusCtx {
    return true;
  }
}

export default DefaultContentFallbackFixture;
