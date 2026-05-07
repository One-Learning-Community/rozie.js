import { Component, DestroyRef, ElementRef, ViewEncapsulation, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'rozie-search-input',
  standalone: true,
  imports: [FormsModule],
  template: `

    <div class="search-input">
      
      <input #inputEl type="search" [placeholder]="placeholder()" [ngModel]="query()" (ngModelChange)="query.set($event)" [ngModelOptions]="{standalone: true}" (input)="debouncedOnSearch($event)" (keydown)="_merged_keydown_1($event)" />

      @if (query().length > 0) {
    <button class="clear-btn" aria-label="Clear" (click)="_clear($event)">
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
  clear = output<unknown>();

  constructor() {
    if (this.autofocus()) this.inputEl()?.nativeElement?.focus();

    // Returning a function from $onMount registers a teardown — equivalent to
    // a separate $onUnmount, useful when setup and teardown logic belong together.
    inject(DestroyRef).onDestroy(() => {
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

  private debouncedOnSearch = (() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (...args: any[]) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => (this.onSearch)(...args), 300);
    };
  })();

  private _guardedOnSearch_2 = (e: any) => {
    if (e.key !== 'Enter') return;
    this.onSearch(e);
  };

  private _guarded_clear_3 = (e: any) => {
    if (e.key !== 'Escape') return;
    this._clear(e);
  };

  private _merged_keydown_1 = (e: any) => {
    this._guardedOnSearch_2(e);
    this._guarded_clear_3(e);
  };
}

export default SearchInput;
