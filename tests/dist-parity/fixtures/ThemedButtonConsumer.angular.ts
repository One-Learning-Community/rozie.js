import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, signal, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

import { ThemedButton } from './ThemedButton';
import { ThemedButtonManual } from './ThemedButtonManual';
import { ThemedButtonListenersManual } from './ThemedButtonListenersManual';
import { ThemedButtonAllManual } from './ThemedButtonAllManual';

@Component({
  selector: 'rozie-themed-button-consumer',
  standalone: true,
  imports: [ThemedButton, ThemedButtonManual, ThemedButtonListenersManual, ThemedButtonAllManual],
  template: `

    <div class="themed-button-consumer" #rozieSpread_0 #rozieListenersTarget_1>
      <rozie-themed-button id="auto-btn" type="button" aria-label="Auto-fallthrough button" data-testid="auto-themed-button" class="extra-variant" style="--btn-bg: #ef4444" [label]="'Auto'" (click)="onClick()($event)" (mouseenter)="onMouseEnter()($event)"></rozie-themed-button>

      <rozie-themed-button-manual id="manual-btn" type="button" aria-label="Manual fallthrough button" data-testid="manual-themed-button" class="extra-variant" style="--btn-bg: #10b981" [label]="'Manual'" (click)="onClick()($event)" (mouseenter)="onMouseEnter()($event)"></rozie-themed-button-manual>

      <rozie-themed-button-listeners-manual id="listeners-manual-btn" type="button" aria-label="Listeners-manual fallthrough button" data-testid="listeners-manual-themed-button" class="extra-variant" style="--btn-bg: #f59e0b" [label]="'Listeners Manual'" (click)="onClick()($event)" (mouseenter)="onMouseEnter()($event)"></rozie-themed-button-listeners-manual>

      <rozie-themed-button-all-manual id="all-manual-btn" type="button" aria-label="All-manual fallthrough button" data-testid="all-manual-themed-button" class="extra-variant" style="--btn-bg: #8b5cf6" [label]="'All Manual'" (click)="onClick()($event)" (mouseenter)="onMouseEnter()($event)"></rozie-themed-button-all-manual>
    </div>

  `,
  styles: [`
    :host(rozie-themed-button-consumer) { display: contents; }
    .themed-button-consumer {
      display: inline-flex;
      gap: 0.75rem;
      padding: 0.5rem;
    }
    .extra-variant {
      font-weight: 600;
    }
  `],
})
export class ThemedButtonConsumer {
  onClick = signal(() => {});
  onMouseEnter = signal(() => {});

  private __rozieDestroyRef = inject(DestroyRef);

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));

  private __rozieGetHostAttrs = createRozieHostAttrsReader(inject(ElementRef));

  private __rozieSpread_0_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });

  private rozieListenersTarget_1 = viewChild<ElementRef>('rozieListenersTarget_1');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_1: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_1 = false;

  private __rozieListenersEffect_1 = effect(() => {
    const el = this.rozieListenersTarget_1()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_1) off();
    this.__rozieListenersDisposers_1 = [];
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (typeof v !== 'function') continue;
      const norm = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
      const dispose = this.__rozieListenersRenderer.listen(el, norm, v as EventListener);
      this.__rozieListenersDisposers_1.push(dispose);
    }
    if (!this.__rozieListenersDestroyRegistered_1) {
      this.__rozieListenersDestroyRegistered_1 = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const off of this.__rozieListenersDisposers_1) off();
        this.__rozieListenersDisposers_1 = [];
      });
    }
  });
}

export default ThemedButtonConsumer;
