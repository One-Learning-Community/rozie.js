import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'rozie-search-input',
  standalone: true,
  imports: [FormsModule],
  template: `

    <div class="search-input" #rozieSpread_0>
      
      <input #inputEl type="search" [placeholder]="placeholder()" [ngModel]="query()" (ngModelChange)="query.set($event)" [ngModelOptions]="{standalone: true}" (input)="debouncedOnSearch_1()" (keydown)="_merged_keydown_2($event)" />

      @if (query().length > 0) {
    <button class="clear-btn" aria-label="Clear" (click)="_clear()">
        ×
      </button>
    } @else {
    <span class="hint">{{ minLength() }}+ chars</span>
    }</div>

  `,
  styles: [`
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

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (v === null || v === false) renderer.removeAttribute(el, k);
        else renderer.setAttribute(el, k, String(v));
      }
      prevKeysByElement.set(el, Object.keys(safeObj));
    };
  })();

  private __rozieGetHostAttrs = (() => {
    const host = inject(ElementRef);
    return () => {
      const el = host.nativeElement as HTMLElement;
      const out: Record<string, unknown> = {};
      for (const a of Array.from(el.attributes)) out[a.name] = a.value;
      return out;
    };
  })();

  private __rozieSpread_0_effect = effect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });

  private debouncedOnSearch_1 = (() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (...args: any[]) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => (this.onSearch as (...a: any[]) => any)(...args), 300);
    };
  })();

  private _guardedOnSearch_3 = ($event: any) => {
    if ($event.key !== 'Enter') return;
    this.onSearch();
  };

  private _guarded_clear_4 = ($event: any) => {
    if ($event.key !== 'Escape') return;
    this._clear();
  };

  private _merged_keydown_2 = ($event: any) => {
    this._guardedOnSearch_3($event);
    this._guarded_clear_4($event);
  };
}

export default SearchInput;
