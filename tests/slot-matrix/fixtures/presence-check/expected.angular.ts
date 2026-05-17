import { Component, ContentChild, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface AsideCtx {}

@Component({
  selector: 'rozie-presence-check-fixture',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="presence-check-fixture">
      @if ((asideTpl ?? templates()?.['aside'])) {
    <aside>
        @if ((asideTpl ?? templates()?.['aside'])) {
    <ng-container *ngTemplateOutlet="(asideTpl ?? templates()?.['aside'])" />
    }
      </aside>
    }</div>

  `,
})
export class PresenceCheckFixture {
  @ContentChild('aside', { read: TemplateRef }) asideTpl?: TemplateRef<AsideCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  static ngTemplateContextGuard(
    _dir: PresenceCheckFixture,
    _ctx: unknown,
  ): _ctx is AsideCtx {
    return true;
  }
}

export default PresenceCheckFixture;
