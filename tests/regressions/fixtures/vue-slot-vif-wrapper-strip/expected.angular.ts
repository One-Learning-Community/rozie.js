import { Component, ContentChild, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface HeaderCtx {}

interface DefaultCtx {}

@Component({
  selector: 'rozie-presence-slot-fallback',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <section class="panel">
      @if (headerTpl || title()) {
    <header>
        
        @if (headerTpl) {
    <ng-container *ngTemplateOutlet="headerTpl" />
    } @else {
    {{ title() }}
    }
      </header>
    }<div class="body">
        <ng-container *ngTemplateOutlet="defaultTpl" />
      </div>
    </section>

  `,
  styles: [`
    .panel { border: 1px solid rgba(0, 0, 0, 0.1); }
  `],
})
export class PresenceSlotFallback {
  title = input<string>('');
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;

  static ngTemplateContextGuard(
    _dir: PresenceSlotFallback,
    _ctx: unknown,
  ): _ctx is HeaderCtx | DefaultCtx {
    return true;
  }
}

export default PresenceSlotFallback;
