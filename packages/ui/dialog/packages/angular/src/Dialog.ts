import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

import { applyScrollLock as applySharedScrollLock } from './internal/scrollLock';

// ---- native reconcile ---------------------------------------------------
// The <dialog> element, cached by sync() so $onUnmount can reach it without
// reading $refs during teardown.

interface DefaultCtx {}

@Component({
  selector: 'rozie-dialog',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <dialog class="rozie-dialog" [attr.aria-label]="rozieAttr(ariaLabel())" [attr.aria-labelledby]="rozieAttr(ariaLabelledby())" #rozieSpread_0 (cancel)="onCancel($event)" (click)="onClick($event)" #rozieListenersTarget_1>
      
      <div class="rozie-dialog-panel" #panelEl>
        <ng-container *ngTemplateOutlet="(defaultTpl ?? __rozieFillMap()['defaultSlot'] ?? templates()?.['defaultSlot'])" />
      </div>
    </dialog>

  `,
  styles: [`
    :host(rozie-dialog) { display: contents; }
    @media (prefers-reduced-motion: no-preference) {
      .rozie-dialog {
        transition: opacity var(--rozie-dialog-transition, var(--rdg-transition, 0.15s ease)), transform var(--rozie-dialog-transition, var(--rdg-transition, 0.15s ease)), overlay 0.15s ease allow-discrete, display 0.15s ease allow-discrete;
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
        transition: opacity var(--rozie-dialog-transition, var(--rdg-transition, 0.15s ease)), overlay 0.15s ease allow-discrete, display 0.15s ease allow-discrete;
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
      width: var(--rozie-dialog-width, var(--rdg-width, auto));
      max-width: var(--rozie-dialog-max-width, var(--rdg-max-width, min(32rem, calc(100vw - 2rem))));
      max-height: var(--rozie-dialog-max-height, var(--rdg-max-height, calc(100vh - 2rem)));
      border: var(--rozie-dialog-border, var(--rdg-border, none));
      border-radius: var(--rozie-dialog-radius, var(--rdg-radius, 0.75rem));
      background: var(--rozie-dialog-bg, var(--rdg-bg, #fff));
      color: var(--rozie-dialog-color, var(--rdg-color, inherit));
      box-shadow: var(--rozie-dialog-shadow, var(--rdg-shadow, 0 10px 38px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.25)));
      overflow: auto;
    }
    .rozie-dialog::backdrop {
      background: var(--rozie-dialog-backdrop-bg, var(--rdg-backdrop-bg, rgba(0, 0, 0, 0.5)));
      backdrop-filter: var(--rozie-dialog-backdrop-filter, var(--rdg-backdrop-filter, none));
    }
    .rozie-dialog-panel {
      padding: var(--rozie-dialog-padding, var(--rdg-padding, 1.5rem));
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
   * <rozie-dialog [(open)]="confirmOpen" ariaLabelledby="confirm-title" />
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
   * What to focus when the dialog opens: a CSS selector matched inside the dialog content, or an Element. By default the native `showModal()` choice applies: the first element with `autofocus`, otherwise the first focusable element. Use it to start on a specific field (e.g. `initialFocus="input[name=title]"`) without waiting for the dialog to mount. A selector that matches nothing, or an element that is not focusable, leaves the native choice in place.
   * @example
   * <rozie-dialog [(open)]="renameOpen" initialFocus="#label-name" />
   */
  initialFocus = input<(string | Element) | null>(null);
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
  private __rozieWatchInitial_0 = true;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.setScrollLock(false);
      const el = this.dialogEl;
      const back = this.returnFocusTo;
      this.dialogEl = null;
      this.returnFocusTo = null;
      if (!el || !el.open) return;
      if (el.isConnected) el.close();
      if (!back) return;
      setTimeout(() => {
        const active = document.activeElement;
        if (back.isConnected && (!active || active === document.body)) back.focus();
      }, 0);
    });
    effect(() => { const __watchVal = (() => this.open())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
      this.sync(isOpen);
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    this.sync(this.open());
  }

  dialogEl: HTMLDialogElement | null = null;
  // Whether THIS instance currently holds one count of the shared scroll lock.
  holdsLock = false;
  // The element focused when the dialog opened, for the unmount-while-open
  // focus return (a normal close gets the native return from close()).
  returnFocusTo: HTMLElement | null = null;
  // Lock/unlock <html> scroll for this instance. The actual lock/unlock is
  // REF-COUNTED (./internal/scrollLock) across every Dialog instance sharing this
  // leaf's module, because a naive per-instance toggle unlocks scrolling the
  // moment ANY dialog closes, even while an OUTER dialog is still open. This
  // wrapper releases only a count this instance took: a dialog that mounts closed
  // (or closes twice) must not release a count another open dialog holds. The
  // opt-out is read when locking only, so toggling it while open still releases.
  setScrollLock = (lock: any) => {
    if (lock === this.holdsLock) return;
    if (lock && this.disableScrollLock()) return;
    this.holdsLock = lock;
    applySharedScrollLock(lock);
  };
  // Focus `initialFocus` after showModal() has made its native choice. A selector
  // is matched inside the panel and, on Lit, inside the light-DOM content
  // assigned to the panel's <slot> (which panel.querySelector cannot see).
  focusInitial = (panel: any) => {
    const target: any = this.initialFocus();
    if (!target) return;
    let node: any = null;
    if (typeof target === 'string') {
      node = panel.querySelector(target);
      const slot: any = node ? null : panel.querySelector('slot');
      const assigned: any[] = slot && typeof slot.assignedElements === 'function' ? slot.assignedElements({
        flatten: true
      }) : [];
      for (let i = 0; !node && i < assigned.length; i++) {
        node = assigned[i].matches(target) ? assigned[i] : assigned[i].querySelector(target);
      }
    } else {
      node = target;
    }
    if (node && typeof node.focus === 'function') node.focus();
  };
  // Reconcile the native <dialog> to the desired open state. Guarded on the
  // native `el.open` flag (showModal throws if already open; close is a no-op when
  // closed). Reads $refs in a post-mount callback (ROZ123-safe).
  //
  // The ref lives on the inner panel <div> (which the emitter types as
  // HTMLDivElement), and we reach the <dialog> via `panel.parentElement` cast to
  // HTMLDialogElement. This sidesteps an emitter gap: the per-target ref-type map
  // has no `dialog` case, so a ref placed directly on <dialog> would be typed the
  // generic HTMLElement (no `.open`/`.showModal()`/`.close()`), failing strict
  // leaf typecheck. Fixing it here keeps the change source-only (no emitter edit).
  sync = (isOpen: any) => {
    const panel = this.panelEl()?.nativeElement;
    const el = (panel && panel.parentElement) as HTMLDialogElement | null;
    if (!el) return;
    this.dialogEl = el;
    if (isOpen) {
      if (!el.open) {
        const active = document.activeElement;
        this.returnFocusTo = active instanceof HTMLElement ? active : null;
        el.showModal();
        this.focusInitial(panel);
      }
      this.setScrollLock(true);
    } else {
      if (el.open) el.close();
      this.returnFocusTo = null;
      this.setScrollLock(false);
    }
  };
  // ---- close funnel (single $emit site) ----------------------------------
  closeWith = (reason: any) => {
    this.open.set(false), this.__rozieCvaOnChange(false);
    this.close.emit({
      reason
    });
  };
  // ---- handlers ----------------------------------------------------------
  // Native Esc fires `cancel` on the <dialog>. preventDefault so WE drive the
  // close through the model (keeping `open` in sync); honor the opt-out.
  onCancel = (e: any) => {
    if (e) e.preventDefault();
    if (this.disableEscapeClose()) return;
    this.closeWith('escape');
  };
  // A click whose target IS the <dialog> element (not its panel/children) is a
  // backdrop click — the ::backdrop is part of the dialog box. We compare the
  // real `e.target` (reliable even under Solid's event delegation) to the dialog
  // element resolved via the panel ref's parent.
  onClick = (e: any) => {
    if (this.disableBackdropClose()) return;
    const panel = this.panelEl()?.nativeElement;
    const el = panel && panel.parentElement;
    if (e && el && e.target === el) this.closeWith('backdrop');
  };
  // ---- lifecycle ---------------------------------------------------------
  // ---- imperative handle -------------------------------------------------
  // show()/hide() — named to avoid the `open` model + `@close` event collisions.
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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default Dialog;
