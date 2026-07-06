import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, effect, inject, signal, viewChild } from '@angular/core';

@Component({
  selector: 'rozie-ron-probe',
  standalone: true,
  template: `

    <div class="r-on-probe">
      <span (click)="$event.stopPropagation(); fn()($event)" (input)="debouncedOnInput($event)">literal modifier-bearing</span>
      <span #rozieListenersTarget_1>dynamic</span>
      <span (click)="_merged_click_2($event)">R6 source-order merge</span>
    </div>

  `,
  styles: [`
    .r-on-probe {
      display: inline-flex;
      gap: 0.5rem;
      padding: 0.25rem;
    }
    .r-on-probe span {
      display: inline-block;
      padding: 0.125rem 0.25rem;
    }
  `],
})
export class ROnProbe {
  fn = signal(() => {});
  onInput = signal(() => {});
  f1 = signal(() => {});
  f2 = signal(() => {});
  someObj = signal({
    click: () => {},
    mouseenter: () => {}
  });

  private __rozieDestroyRef = inject(DestroyRef);

  private debouncedOnInput = (() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (...args: any[]) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => (this.onInput() as (...a: any[]) => any)(...args), 300);
    };
  })();

  private rozieListenersTarget_1 = viewChild<ElementRef>('rozieListenersTarget_1');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_1: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_1 = false;

  private __rozieListenersEffect_1 = effect(() => {
    const el = this.rozieListenersTarget_1()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_1) off();
    this.__rozieListenersDisposers_1 = [];
    const obj = (this.someObj()) ?? {};
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

  private _merged_click_2 = ($event: any) => {
    this.f1()($event);
    this.f2()($event);
  };
}

export default ROnProbe;
