import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

interface HeaderCtx {
  $implicit: { close: any };
  close: any;
}

interface DefaultCtx {
  $implicit: { close: any };
  close: any;
}

interface FooterCtx {
  $implicit: { close: any };
  close: any;
}

function __rozieDisplay(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      // Circular structure or a non-serialisable value (BigInt nested in an
      // object). Degrade to a non-throwing form so the wrap never crashes the
      // render — that is the entire point of "safe" interpolation (SPEC-1).
      return String(v);
    }
  }
  return String(v);
}

@Component({
  selector: 'rozie-modal',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    @if (open()) {
    <div class="modal-backdrop" #backdropEl (click)="_guardedHandler0($event)">
      <div #dialogEl class="modal-dialog" role="dialog" aria-modal="true" [attr.aria-label]="rozieDisplay(title() || undefined)" tabindex="-1">
        @if (title() || (headerTpl ?? templates()?.['header'])) {
    <header>
          @if ((headerTpl ?? templates()?.['header'])) {
    <ng-container *ngTemplateOutlet="(headerTpl ?? templates()?.['header']); context: { $implicit: { close: _close }, close: _close }" />
    } @else {

            <h2>{{ title() }}</h2>
          
    }
          <button class="close-btn" aria-label="Close" (click)="_close()">×</button>
        </header>
    }<div class="modal-body">
          <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot']); context: { $implicit: { close: _close }, close: _close }" />
        </div>

        @if ((footerTpl ?? templates()?.['footer'])) {
    <footer>
          @if ((footerTpl ?? templates()?.['footer'])) {
    <ng-container *ngTemplateOutlet="(footerTpl ?? templates()?.['footer']); context: { $implicit: { close: _close }, close: _close }" />
    }
        </footer>
    }</div>
    </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: var(--rozie-modal-z, 2000);
    }
    .modal-dialog {
      background: white;
      border-radius: 8px;
      min-width: 20rem;
      max-width: min(90vw, 40rem);
      max-height: 90vh;
      display: flex; flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      outline: none;
    }
    header, footer { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    header { border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
    header h2 { flex: 1; margin: 0; font-size: 1.1rem; }
    footer { border-top: 1px solid rgba(0, 0, 0, 0.08); justify-content: flex-end; }
    .modal-body { padding: 1rem; overflow: auto; }
    .close-btn { background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1; }

    ::ng-deep :root {
    --rozie-modal-z: 2000;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Modal),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Modal {
  open = model<boolean>(false);
  closeOnEscape = input<boolean>(true);
  closeOnBackdrop = input<boolean>(true);
  lockBodyScroll = input<boolean>(true);
  title = input<string>('');
  backdropEl = viewChild<ElementRef<HTMLDivElement>>('backdropEl');
  dialogEl = viewChild<ElementRef<HTMLDivElement>>('dialogEl');
  close = output<void>();
  @ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  @ContentChild('footer', { read: TemplateRef }) footerTpl?: TemplateRef<FooterCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;

  constructor() {
      const renderer = inject(Renderer2);

      effect((onCleanup) => {
        if (!(this.open() && this.closeOnEscape())) return;
        const handler = ($event: KeyboardEvent) => {
          if ($event.key !== 'Escape') return;
          this._close();
        };
        const unlisten = renderer.listen('document', 'keydown', handler);
        onCleanup(unlisten);
      });

    effect(() => { const __watchVal = (() => this.open())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
      if (isOpen) this.lockScroll();else this.unlockScroll();
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    this.lockScroll();
    this.__rozieDestroyRef.onDestroy(this.unlockScroll);
    this.dialogEl()?.nativeElement?.focus();
  }

  _close = () => {
    this.open.set(false), this.__rozieCvaOnChange(false);
    this.close.emit();
  };
  savedBodyOverflow = '';
  lockScroll = () => {
    if (!this.lockBodyScroll() || !this.open()) return;
    this.savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  };
  unlockScroll = () => {
    if (!this.lockBodyScroll()) return;
    document.body.style.overflow = this.savedBodyOverflow;
  };

  private __rozieCvaOnChange: (v: boolean) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  private __rozieCvaDisabled = signal(false);

  writeValue(v: boolean | null): void {
    this.open.set(v ?? false);
  }
  registerOnChange(fn: (v: boolean) => void): void {
    this.__rozieCvaOnChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.__rozieCvaOnTouchedFn = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.__rozieCvaDisabled.set(isDisabled);
  }
  __rozieCvaOnTouched(): void {
    this.__rozieCvaOnTouchedFn();
  }

  static ngTemplateContextGuard(
    _dir: Modal,
    _ctx: unknown,
  ): _ctx is HeaderCtx | DefaultCtx | FooterCtx {
    return true;
  }

  private _guardedHandler0 = ($event: any) => {
    if ($event.target !== $event.currentTarget) return;
    this.closeOnBackdrop() && this._close();
  };

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }
}

export default Modal;
