import { Component, ContentChild, TemplateRef, ViewEncapsulation, computed, model } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface ItemCtx {
  $implicit: { item: any; remaining: any };
  item: any;
  remaining: any;
}

@Component({
  selector: 'rozie-scoped-slot-context',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <ul class="list">
      
      @for (item of items(); track item.id) {
    <li>
        @if (itemTpl) {
    <ng-container *ngTemplateOutlet="itemTpl; context: { $implicit: { item: item, remaining: remaining() }, item: item, remaining: remaining() }" />
    } @else {

          {{ item.label }}
        
    }
      </li>
    }
    </ul>

  `,
  styles: [`
    .list { list-style: none; padding: 0; }
  `],
})
export class ScopedSlotContext {
  items = model<unknown[]>((() => [])());
  @ContentChild('item', { read: TemplateRef }) itemTpl?: TemplateRef<ItemCtx>;

  remaining = computed(() => this.items().filter(i => !i.done).length);

  static ngTemplateContextGuard(
    _dir: ScopedSlotContext,
    _ctx: unknown,
  ): _ctx is ItemCtx {
    return true;
  }
}

export default ScopedSlotContext;
