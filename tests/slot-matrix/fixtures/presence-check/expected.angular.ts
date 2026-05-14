import { Component, ContentChild, TemplateRef, ViewEncapsulation } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface AsideCtx {}

@Component({
  selector: 'rozie-presence-check-fixture',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="presence-check-fixture">
      @if (asideTpl) {
    <aside>
        @if (asideTpl) {
    <ng-container *ngTemplateOutlet="asideTpl" />
    }
      </aside>
    }</div>

  `,
})
export class PresenceCheckFixture {
  @ContentChild('aside', { read: TemplateRef }) asideTpl?: TemplateRef<AsideCtx>;

  static ngTemplateContextGuard(
    _dir: PresenceCheckFixture,
    _ctx: unknown,
  ): _ctx is AsideCtx {
    return true;
  }
}

export default PresenceCheckFixture;
