import { Component, ContentChild, DestroyRef, ElementRef, TemplateRef, ViewEncapsulation, effect, inject, input, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import DummyEngine from 'dummy-engine';

interface DefaultCtx {}

@Component({
  selector: 'rozie-spike-import-el',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="spike-root" #__rozieRoot>
      <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" />
    </div>

  `,
})
export class SpikeImportEl {
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieDestroyRef = inject(DestroyRef);

  ngAfterViewInit() {
    this.instance = new DummyEngine(this.__rozieRoot()?.nativeElement, {
      animation: 150
    });
    this.__rozieDestroyRef.onDestroy(() => this.instance?.destroy());
  }

  instance = null;

  static ngTemplateContextGuard(
    _dir: SpikeImportEl,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }
}

export default SpikeImportEl;
