import { Component, ContentChild, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface HeaderCtx {}

interface FooterCtx {}

@Component({
  selector: 'rozie-named-slots-fixture',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="named-slots-fixture">
      <header>
        <ng-container *ngTemplateOutlet="(headerTpl ?? templates()?.['header'])" />
      </header>
      <footer>
        <ng-container *ngTemplateOutlet="(footerTpl ?? templates()?.['footer'])" />
      </footer>
    </div>

  `,
})
export class NamedSlotsFixture {
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;
  @ContentChild('footer', { read: TemplateRef }) footerTpl?: TemplateRef<FooterCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  static ngTemplateContextGuard(
    _dir: NamedSlotsFixture,
    _ctx: unknown,
  ): _ctx is HeaderCtx | FooterCtx {
    return true;
  }
}

export default NamedSlotsFixture;
