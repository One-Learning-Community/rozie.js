import { Component, ContentChild, TemplateRef, ViewEncapsulation, computed, contentChildren, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RozieSlot } from '@rozie/runtime-angular';

import { Inner } from './inner';

interface TitleCtx {}

interface DefaultCtx {}

@Component({
  selector: 'rozie-wrapper',
  standalone: true,
  imports: [NgTemplateOutlet, Inner],
  template: `

    <rozie-inner><ng-template #header>
        @if ((titleTpl ?? __rozieFillMap()['title'] ?? templates()?.['title'])) {
    <ng-container *ngTemplateOutlet="(titleTpl ?? __rozieFillMap()['title'] ?? templates()?.['title'])" />
    } @else {
    default title
    }
      </ng-template><ng-template #defaultSlot>@if ((defaultTpl ?? __rozieFillMap()['defaultSlot'] ?? templates()?.['defaultSlot'])) {
    <ng-container *ngTemplateOutlet="(defaultTpl ?? __rozieFillMap()['defaultSlot'] ?? templates()?.['defaultSlot'])" />
    } @else {
    default body
    }</ng-template></rozie-inner>

  `,
  styles: [`
    :host(rozie-wrapper) { display: contents; }
  `],
})
export class Wrapper {
  @ContentChild('title', { read: TemplateRef }) titleTpl?: TemplateRef<TitleCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  __rozieFills = contentChildren(RozieSlot, { descendants: true });
  __rozieFillMap = computed(() => {
    const map = Object.create(null) as Record<string, TemplateRef<unknown>>;
    for (const f of this.__rozieFills()) {
      const k = f.rozieSlot();
      if (k == null) continue;
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      map[k === '' ? 'defaultSlot' : k] = f.templateRef;
    }
    return map;
  });

  static ngTemplateContextGuard(
    _dir: Wrapper,
    _ctx: unknown,
  ): _ctx is TitleCtx | DefaultCtx {
    return true;
  }
}

export default Wrapper;
