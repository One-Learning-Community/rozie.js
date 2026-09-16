import { Component, DestroyRef, ElementRef, ViewEncapsulation, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-editor-text',
  standalone: true,
  template: `

    <input #inputEl class="rdt-cell-editor" type="text" data-editing-cell="" [attr.aria-label]="rozieAttr(a11yLabel())" [value]="draft()" (input)="onInput($event)" (keydown)="onKeydown($event)" (blur)="onBlur()" />

  `,
  styles: [`
    :host(rozie-editor-text) { display: contents; }
  `],
})
export class EditorText {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label` fallback.
   */
  columnId = input<string>('');
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column = input<(unknown) | null>(null);
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row = input<(unknown) | null>(null);
  /**
   * The current cell value the editor seeds its local draft from (setup-once).
   */
  value = input<(unknown) | null>(null);
  /**
   * `(value) => void` — commit the edited cell value (from the `#editor` slot scope). Null-guarded at call sites.
   */
  commit = input<((...args: any[]) => any) | null>(null);
  /**
   * `() => void` — revert the edit and close the editor (from the `#editor` slot scope). Null-guarded at call sites.
   */
  cancel = input<((...args: any[]) => any) | null>(null);
  /**
   * Focus this editor's primary input when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus = input<boolean>(false);
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel = input<string>('');
  draft = signal('');
  inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  private __rozieWatchInitial_0 = true;

  constructor() {
    // Seed the draft once at setup from the incoming value (setup-once, NOT in the
    // template). Normalize null/undefined to '' so the input value binds to a string.
    this.draft.set(this.value() != null ? String(this.value()) : '');
    effect(() => { const __watchVal = (() => this.autofocus())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => {
      if (v) this.inputEl()?.nativeElement?.focus();
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    if (this.autofocus()) this.inputEl()?.nativeElement?.focus();
  }

  // Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
  // ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
  onInput = (e: any) => {
    this.draft.set(e && e.target ? e.target.value : '');
  };
  // commit/cancel are Function props (default null) — guard before calling.
  doCommit = () => {
    const __commit = this.commit();
    __commit && __commit(this.draft());
  };
  doCancel = () => {
    const __cancel = this.cancel();
    __cancel && __cancel();
  };
  onKeydown = (e: any) => {
    if (e && e.key === 'Enter') {
      e.preventDefault();
      this.doCommit();
    } else if (e && e.key === 'Escape') {
      e.preventDefault();
      this.doCancel();
    }
  };
  onBlur = () => {
    this.doCommit();
  };
  // Editor-owns-focus contract: focus OUR OWN input when the host says we should hold focus.
  // $onMount covers the initial open (autofocus already true on first render); the LAZY $watch
  // (NOT { immediate: true } — an immediate watch fires PRE-mount, null ref on Lit/Solid) covers
  // a REACTIVE refocus while already mounted (e.g. a row-mode validation failure that flips
  // autofocus back onto this already-open drop-in).
  // C-11 — the accessible name must be the column's HUMAN header, not its internal id.
  // `columnId` is a lookup key (`unit_price`, `col_3`); a screen reader announcing it is
  // reading an implementation detail aloud. table-core keeps the authored header on
  // `column.columnDef.header`, which is a string for every declarative `<Column header>`;
  // a header rendered by a function has no static text, so fall back to the id rather
  // than invent one.
  a11yLabel = () => {
    const __columnLabel = this.columnLabel();
    if (typeof __columnLabel === 'string' && __columnLabel !== '') return __columnLabel;
    return this.columnId();
  };

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default EditorText;
