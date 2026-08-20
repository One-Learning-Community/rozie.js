import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-search-input',
  standalone: true,
  imports: [FormsModule],
  template: `

    <div class="search-input" #rozieSpread_0 #rozieListenersTarget_1>
      
      <input #inputEl type="search" [placeholder]="placeholder()" [ngModel]="query()" (ngModelChange)="query.set($event)" [ngModelOptions]="{standalone: true}" (input)="debouncedOnSearch_2()" (keydown)="_merged_keydown_3($event)" />

      @if (query().length > 0) {
    <button class="clear-btn" aria-label="Clear" (click)="_clear()">
        ×
      </button>
    } @else {
    <span class="hint">{{ minLength() }}+ chars</span>
    }</div>

  `,
  styles: [`
    :host(rozie-search-input) { display: contents; }
    .search-input { display: inline-flex; align-items: center; gap: 0.25rem; }
    input { padding: 0.25rem 0.5rem; }
    .clear-btn { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
    .hint { color: rgba(0, 0, 0, 0.4); font-size: 0.85em; }
  `],
})
export class SearchInput {
  placeholder = input<string>('Search…');
  minLength = input<number>(2);
  autofocus = input<boolean>(false);
  query = signal('');
  inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  search = output<unknown>();
  clear = output<void>();
  private __rozieDestroyRef = inject(DestroyRef);

  ngAfterViewInit() {
    if (this.autofocus()) this.inputEl()?.nativeElement?.focus();

    // Returning a function from $onMount registers a teardown — equivalent to
    // a separate $onUnmount, useful when setup and teardown logic belong together.
    this.__rozieDestroyRef.onDestroy(() => {
      // e.g., abort an in-flight request initialized in this hook
    });
  }

  isValid = computed(() => this.query().length >= this.minLength());

  onSearch = () => {
    if (this.isValid()) this.search.emit(this.query());
  };
  _clear = () => {
    this.query.set('');
    this.clear.emit();
  };

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

  private debouncedOnSearch_2 = (() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (...args: any[]) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => (this.onSearch as (...a: any[]) => any)(...args), 300);
    };
  })();

  private _guardedOnSearch_4 = ($event: any) => {
    if ($event.key !== 'Enter') return;
    this.onSearch();
  };

  private _guarded_clear_5 = ($event: any) => {
    if ($event.key !== 'Escape') return;
    this._clear();
  };

  private _merged_keydown_3 = ($event: any) => {
    this._guardedOnSearch_4($event);
    this._guarded_clear_5($event);
  };
}

export default SearchInput;
