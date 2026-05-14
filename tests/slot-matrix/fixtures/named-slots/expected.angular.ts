import { Component, ContentChild, TemplateRef, ViewEncapsulation } from '@angular/core';
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
        <ng-container *ngTemplateOutlet="headerTpl" />
      </header>
      <footer>
        <ng-container *ngTemplateOutlet="footerTpl" />
      </footer>
    </div>

  `,
})
export class NamedSlotsFixture {
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;
  @ContentChild('footer', { read: TemplateRef }) footerTpl?: TemplateRef<FooterCtx>;

  static ngTemplateContextGuard(
    _dir: NamedSlotsFixture,
    _ctx: unknown,
  ): _ctx is HeaderCtx | FooterCtx {
    return true;
  }
}

export default NamedSlotsFixture;
