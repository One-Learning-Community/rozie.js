import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

interface DefaultCtx {}

@Component({
  selector: 'rozie-dialog',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <dialog class="rozie-dialog" [attr.aria-label]="ariaLabel()" [attr.aria-labelledby]="ariaLabelledby()" #rozieSpread_0 (cancel)="onCancel($event)" (click)="onClick($event)" #rozieListenersTarget_1>
      
      <div class="rozie-dialog-panel" #panelEl>
        <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" />
      </div>
    </dialog>

  `,
  styles: [`
    :host(rozie-dialog) { display: contents; }
    @media (prefers-reduced-motion: no-preference) {
      .rozie-dialog {
        transition: opacity var(--rozie-dialog-transition, 0.15s ease), transform var(--rozie-dialog-transition, 0.15s ease), overlay 0.15s ease allow-discrete, display 0.15s ease allow-discrete;
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      .rozie-dialog:not([open]) {
        opacity: 0;
        transform: translateY(0.5rem) scale(0.98);
      }
      @starting-style {
        .rozie-dialog[open] {
          opacity: 0;
          transform: translateY(0.5rem) scale(0.98);
        }
      }
      .rozie-dialog::backdrop {
        transition: opacity var(--rozie-dialog-transition, 0.15s ease), overlay 0.15s ease allow-discrete, display 0.15s ease allow-discrete;
        opacity: 1;
      }
      .rozie-dialog:not([open])::backdrop {
        opacity: 0;
      }
      @starting-style {
        .rozie-dialog[open]::backdrop {
          opacity: 0;
        }
      }
    }
    .rozie-dialog {
      margin: auto; /* centers in the top layer */
      padding: 0;
      width: var(--rozie-dialog-width, auto);
      max-width: var(--rozie-dialog-max-width, min(32rem, calc(100vw - 2rem)));
      max-height: var(--rozie-dialog-max-height, calc(100vh - 2rem));
      border: var(--rozie-dialog-border, none);
      border-radius: var(--rozie-dialog-radius, 0.75rem);
      background: var(--rozie-dialog-bg, #fff);
      color: var(--rozie-dialog-color, inherit);
      box-shadow: var(--rozie-dialog-shadow, 0 10px 38px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.25));
      overflow: auto;
    }
    .rozie-dialog::backdrop {
      background: var(--rozie-dialog-backdrop-bg, rgba(0, 0, 0, 0.5));
      backdrop-filter: var(--rozie-dialog-backdrop-filter, none);
    }
    .rozie-dialog-panel {
      padding: var(--rozie-dialog-padding, 1.5rem);
      font: var(--rozie-dialog-font, inherit);
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Dialog),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Dialog {
  /**
   * Whether the dialog is shown (two-way `r-model`). The sole `model: true` prop — two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`) and Dialog reconciles the native `<dialog>` to it via `showModal()` / `close()`. Every close path (backdrop, Escape, programmatic `hide()`) writes `open = false` and emits `close`.
   * @example
   * <Dialog r-model:open="confirmOpen" ariaLabelledby="confirm-title" />
   */
  open = model<boolean>(false);
  /**
   * Opt **out** of backdrop-click-to-dismiss. By default a click on the scrim (the `<dialog>` element itself, outside the content panel) closes the dialog with `reason: 'backdrop'`; set this to require an explicit action.
   */
  disableBackdropClose = input<boolean>(false);
  /**
   * Opt **out** of Escape-to-dismiss. By default the native `cancel` event (Esc) closes with `reason: 'escape'`; the component `preventDefault()`s it so the close always flows through the `open` model. Set this to keep the dialog open on Escape (e.g. a required confirmation).
   */
  disableEscapeClose = input<boolean>(false);
  /**
   * Opt **out** of locking `<html>` scroll while the dialog is open. By default `document.documentElement` `overflow` is set to `hidden` for the duration the dialog is shown; set this to leave background scrolling enabled.
   */
  disableScrollLock = input<boolean>(false);
  /**
   * Accessible name for the dialog (`aria-label`) when there is no visible title to point at. Prefer `ariaLabelledby` when a visible heading exists.
   */
  ariaLabel = input<(string) | null>(null);
  /**
   * The `id` of the element that titles the dialog (`aria-labelledby`) — preferred over `ariaLabel` when a visible heading exists inside the dialog.
   */
  ariaLabelledby = input<(string) | null>(null);
  panelEl = viewChild<ElementRef<HTMLDivElement>>('panelEl');
  close = output<unknown>();
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieWatchInitial_0 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.open())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
      this.sync(isOpen);
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    this.sync(this.open());
  }

  applyScrollLock = (lock: any) => {
    if (this.disableScrollLock()) return;
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (root) root.style.overflow = lock ? 'hidden' : '';
  };
  sync = (isOpen: any) => {
    const panel = this.panelEl()?.nativeElement;
    const el = (panel && panel.parentElement) as HTMLDialogElement | null;
    if (!el) return;
    if (isOpen) {
      if (!el.open) el.showModal();
      this.applyScrollLock(true);
    } else {
      if (el.open) el.close();
      this.applyScrollLock(false);
    }
  };
  closeWith = (reason: any) => {
    this.open.set(false), this.__rozieCvaOnChange(false);
    this.close.emit({
      reason
    });
  };
  onCancel = (e: any) => {
    if (e) e.preventDefault();
    if (this.disableEscapeClose()) return;
    this.closeWith('escape');
  };
  onClick = (e: any) => {
    if (this.disableBackdropClose()) return;
    const panel = this.panelEl()?.nativeElement;
    const el = panel && panel.parentElement;
    if (e && el && e.target === el) this.closeWith('backdrop');
  };
  show = () => {
    this.open.set(true), this.__rozieCvaOnChange(true);
  };
  hide = () => {
    this.closeWith('programmatic');
  };

  private __rozieCvaOnChange: (v: boolean) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

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
    _dir: Dialog,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }

  private __rozieDestroyRef = inject(DestroyRef);

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    const prevClassTokensByElement = new WeakMap<HTMLElement, string[]>();
    const prevStylePropsByElement = new WeakMap<HTMLElement, string[]>();
    const parseClassTokens = (value: unknown): string[] => {
      if (typeof value !== 'string') return [];
      const out: string[] = [];
      for (const tok of value.split(/\s+/)) {
        if (tok.length > 0) out.push(tok);
      }
      return out;
    };
    const parseStyleDecls = (value: unknown): Array<[string, string]> => {
      if (typeof value !== 'string') return [];
      const out: Array<[string, string]> = [];
      for (const decl of value.split(';')) {
        const colon = decl.indexOf(':');
        if (colon < 0) continue;
        const prop = decl.slice(0, colon).trim();
        const val = decl.slice(colon + 1).trim();
        if (prop.length > 0) out.push([prop, val]);
      }
      return out;
    };
    const applyClassMerge = (el: HTMLElement, value: unknown) => {
      const next = parseClassTokens(value);
      const prev = prevClassTokensByElement.get(el) ?? [];
      const nextSet = new Set(next);
      for (const tok of prev) {
        if (!nextSet.has(tok)) el.classList.remove(tok);
      }
      for (const tok of next) el.classList.add(tok);
      prevClassTokensByElement.set(el, next);
    };
    const applyStyleMerge = (el: HTMLElement, value: unknown) => {
      const next = parseStyleDecls(value);
      const prev = prevStylePropsByElement.get(el) ?? [];
      const nextProps = next.map(([p]) => p);
      const nextSet = new Set(nextProps);
      for (const prop of prev) {
        if (!nextSet.has(prop)) el.style.removeProperty(prop);
      }
      for (const [prop, val] of next) el.style.setProperty(prop, val, 'important');
      prevStylePropsByElement.set(el, nextProps);
    };
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (k === 'class' || k === 'style') continue;
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      if (!('class' in safeObj) && prevClassTokensByElement.has(el)) {
        applyClassMerge(el, '');
      }
      if (!('style' in safeObj) && prevStylePropsByElement.has(el)) {
        applyStyleMerge(el, '');
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (k === 'class') {
          applyClassMerge(el, v);
        } else if (k === 'style') {
          applyStyleMerge(el, v);
        } else if (v === null || v === false) {
          renderer.removeAttribute(el, k);
        } else {
          renderer.setAttribute(el, k, String(v));
        }
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

export default Dialog;
