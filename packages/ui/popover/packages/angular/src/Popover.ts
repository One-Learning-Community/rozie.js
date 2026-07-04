import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

// The `offset` AND `arrow` middleware factories are ALIASED on import: both are
// ALSO author PROP names (`offset`, `arrow`). A bare `offset`/`arrow` shorthand in
// the buildMiddleware factories object resolves to the PROP — on Vue/Svelte the
// destructured prop local shadows the import, and on Angular the emitter rewrites
// the bare shorthand to the prop signal (`offset: this.offset()`, a number) instead
// of the middleware function (TS2322). Aliasing both severs the import↔prop clash.
// (The Cropper import-name==component-name class, applied to imports vs PROP names —
// two collisions, not one.) computePosition/autoUpdate/flip/shift carry no clash.
import { computePosition, autoUpdate, offset as offsetMiddleware, flip, shift, arrow as arrowMiddleware } from '@floating-ui/dom';
import { buildMiddleware } from './internal/middleware';

// null-lets so the bundled-leaf typeNeutralize pass annotates them `any`:
//   anchorNode/floatingNode/arrowNode hold the resolved ref ELEMENTS (read ONLY in
//   $onMount/handlers, ROZ123). They are deliberately named DIFFERENTLY from the
//   `ref="anchorEl"` / `ref="floatingEl"` / `ref="arrowEl"` template ref names: the
//   React/Svelte emitters declare a `const anchorEl = useRef(...)` for the ref, and a
//   top-level `let anchorEl` hoisted to its own `useRef` would REDECLARE it (TS2451 —
//   the local-name==ref-name self-shadow class, here in its `let X = null; X = $refs.X`
//   variant, which deconflictRefShadows does NOT auto-rewrite since it only fires on the
//   `const X = $refs.X` init shape).
//   stopAutoUpdate is the autoUpdate teardown handle — a TOP-LEVEL `let` so the Solid
//   onMount→onCleanup split (teardown is a separate closure) can still see it.
//   lastFocusedEl (phase 72-06b) holds whatever had DOM focus at the moment a
//   `trigger="click"` popover opened (natively the clicked trigger element itself,
//   since a mousedown focuses a native `<button>` before its `click` fires) —
//   restored on dismissal so Escape/click-outside don't drop focus to `<body>`.
//   Same null-let convention as the others: read/written only in handlers, `any`
//   via typeNeutralize.

interface AnchorCtx {
  $implicit: { open: any; toggle: any; show: any; hide: any };
  open: any;
  toggle: any;
  show: any;
  hide: any;
}

interface DefaultCtx {}

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

function __rozieAttr(v: unknown): string | null {
  return v == null ? null : __rozieDisplay(v);
}

@Component({
  selector: 'rozie-popover',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="rozie-popover" #rozieSpread_0 #rozieListenersTarget_1>

      
      <div class="rozie-popover-anchor" #anchorEl aria-haspopup="dialog" [attr.aria-expanded]="!!open()" [attr.aria-describedby]="rozieAttr(isTooltip() && open() ? 'rozie-popover-floating' : null)" (click)="trigger() === 'click' && onAnchorClick()" (pointerenter)="trigger() === 'hover' && onAnchorPointerEnter()" (pointerleave)="trigger() === 'hover' && onAnchorPointerLeave()" (focusin)="trigger() === 'focus' && onAnchorFocus()" (focusout)="trigger() === 'focus' && onAnchorBlur()">
        <ng-container *ngTemplateOutlet="(anchorTpl ?? templates()?.['anchor']); context: { $implicit: { open: open(), toggle: toggle, show: show, hide: hide }, open: open(), toggle: toggle, show: show, hide: hide }" />
      </div>

      
      @if (open() && !(disabled() || this.__rozieCvaDisabled())) {
    <div class="rozie-popover-floating" #floatingEl id="rozie-popover-floating" [attr.role]="rozieAttr(floatingRole())" [attr.aria-modal]="!!(floatingRole() === 'dialog')">
        @if (arrow()) {
    <div class="rozie-popover-arrow" #arrowEl></div>
    }<ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" />
      </div>
    }</div>

  `,
  styles: [`
    .rozie-popover {
      display: contents;
    }
    .rozie-popover-anchor {
      display: inline-block;
    }
    .rozie-popover-floating {
      position: absolute;
      left: 0;
      top: 0;
      z-index: var(--rozie-popover-z, 1000);
      width: max-content;
      max-width: var(--rozie-popover-max-width, calc(100vw - 16px));
      background: var(--rozie-popover-bg, #fff);
      color: var(--rozie-popover-color, inherit);
      border: var(--rozie-popover-border, 1px solid rgba(0, 0, 0, 0.12));
      border-radius: var(--rozie-popover-radius, 8px);
      box-shadow: var(--rozie-popover-shadow, 0 8px 24px rgba(0, 0, 0, 0.12));
      padding: var(--rozie-popover-padding, 8px 12px);
    }
    .rozie-popover-arrow {
      position: absolute;
      width: var(--rozie-popover-arrow-size, 8px);
      height: var(--rozie-popover-arrow-size, 8px);
      background: var(--rozie-popover-bg, #fff);
      border: var(--rozie-popover-border, 1px solid rgba(0, 0, 0, 0.12));
      transform: rotate(45deg);
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Popover),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Popover {
  /**
   * Whether the floating content is open. The sole `model: true` prop — two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`) and Popover writes the new state back whenever the trigger or a dismissal toggles it. Left unbound it falls back to an uncontrolled default.
   */
  open = model<boolean>(false);
  /**
   * Floating UI placement of the content relative to the anchor — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end` (e.g. `bottom-start`). With `disableFlip` off, the content may flip to the opposite side when it would overflow the viewport. Reconciled at runtime.
   */
  placement = input<string>('bottom');
  /**
   * How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur. Drives both the gesture handlers and the ARIA role (`'hover'`/`'focus'` → tooltip, `'click'` → popover dialog).
   */
  trigger = input<string>('click');
  /**
   * Distance in pixels between the anchor and the floating content (the Floating UI `offset` middleware). Reconciled at runtime.
   */
  offset = input<number>(8);
  /**
   * Disable the Floating UI `flip` middleware. By default the content flips to the opposite side of the anchor when it would overflow the viewport; set this to keep it pinned to `placement` regardless.
   */
  disableFlip = input<boolean>(false);
  /**
   * Disable the Floating UI `shift` middleware. By default the content shifts along its axis to stay within the viewport; set this to keep it strictly aligned to the anchor.
   */
  disableShift = input<boolean>(false);
  /**
   * Opt in to a positioned arrow element. When set, Popover renders an arrow `<div>` and runs the Floating UI `arrow` middleware against it so it points at the anchor. Style it via the `--rozie-popover-*` arrow CSS custom properties.
   */
  arrow = input<boolean>(false);
  /**
   * Disable the control entirely: the trigger no longer opens the content and any open content is suppressed.
   */
  disabled = input<boolean>(false);
  /**
   * Floating UI positioning strategy — 'absolute' (default) or 'fixed'. Use 'fixed' to escape a scrollable/overflow-clipping ancestor (e.g. a sticky table header). Reconciled at runtime.
   */
  strategy = input<string>('absolute');
  anchorEl = viewChild<ElementRef<HTMLDivElement>>('anchorEl');
  floatingEl = viewChild<ElementRef<HTMLDivElement>>('floatingEl');
  arrowEl = viewChild<ElementRef<HTMLDivElement>>('arrowEl');
  change = output<unknown>();
  @ContentChild('anchor', { read: TemplateRef }) anchorTpl?: TemplateRef<AnchorCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;
  private __rozieWatchInitial_5 = true;

  constructor() {
      const renderer = inject(Renderer2);

      effect((onCleanup) => {
        if (!(this.open())) return;
        const handler = ($event: KeyboardEvent) => {
          if ($event.key !== 'Escape') return;
          this.dismiss();
        };
        const unlisten = renderer.listen('document', 'keydown', handler);
        onCleanup(unlisten);
      });

      effect((onCleanup) => {
        if (!(this.open())) return;
        const handler = ($event: MouseEvent) => {
          const target = $event.target as Node;
          if (this.anchorEl()?.nativeElement?.contains(target) || this.floatingEl()?.nativeElement?.contains(target)) return;
          this.dismiss();
        };
        const unlisten = renderer.listen('document', 'click', handler);
        onCleanup(unlisten);
      });

    effect(() => { const __watchVal = (() => this.open())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
      if (isOpen && !(this.disabled() || this.__rozieCvaDisabled())) {
        this.floatingNode = this.floatingEl()?.nativeElement;
        this.arrowNode = this.arrowEl()?.nativeElement;
        this.startTracking();
      } else {
        this.stopTracking();
      }
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.placement())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      if (this.open()) this.position();
    })(); }); });
    effect(() => { const __watchVal = (() => this.offset())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => {
      if (this.open()) this.position();
    })(); }); });
    effect(() => { const __watchVal = (() => this.disableFlip())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } (() => {
      if (this.open()) this.position();
    })(); }); });
    effect(() => { const __watchVal = (() => this.disableShift())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } (() => {
      if (this.open()) this.position();
    })(); }); });
    effect(() => { const __watchVal = (() => this.strategy())(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } (() => {
      if (this.open()) this.position();
    })(); }); });
  }

  ngAfterViewInit() {
    // $refs read ONLY here (ROZ123). The floating + arrow elements live behind r-if
    // and may be null until open; startTracking re-reads via the watch path.
    this.anchorNode = this.anchorEl()?.nativeElement;
    if (this.open() && !(this.disabled() || this.__rozieCvaDisabled())) {
      // floatingNode is populated by its r-if having rendered; read it lazily inside
      // the watch/handlers too. Position on next tick when it exists.
      this.floatingNode = this.floatingEl()?.nativeElement;
      this.arrowNode = this.arrowEl()?.nativeElement;
      this.startTracking();
    }
    this.__rozieDestroyRef.onDestroy(() => {
      this.stopTracking();
    });
  }

  anchorNode: any = null;
  floatingNode: any = null;
  arrowNode: any = null;
  stopAutoUpdate: any = null;
  lastFocusedEl: any = null;
  deepActiveElement = () => {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    return el;
  };
  requestOpen = (next: any) => {
    const __trigger = this.trigger();
    if (this.open() === next) return;
    if (next && __trigger === 'click') {
      this.lastFocusedEl = this.deepActiveElement();
    }
    this.open.set(next), this.__rozieCvaOnChange(next);
    this.change.emit(next);
    if (!next && __trigger === 'click' && this.lastFocusedEl && this.lastFocusedEl.isConnected && typeof this.lastFocusedEl.focus === 'function') {
      this.lastFocusedEl.focus();
    }
    if (!next) {
      this.lastFocusedEl = null;
    }
  };
  applyPosition = (x: any, y: any, middlewareData: any) => {
    if (!this.floatingNode) return;
    this.floatingNode.style.left = x + 'px';
    this.floatingNode.style.top = y + 'px';
    if (this.arrowNode && middlewareData && middlewareData.arrow) {
      const ax = middlewareData.arrow.x;
      const ay = middlewareData.arrow.y;
      this.arrowNode.style.left = ax == null ? '' : ax + 'px';
      this.arrowNode.style.top = ay == null ? '' : ay + 'px';
    }
  };
  position = () => {
    const __strategy = this.strategy();
    if (!this.anchorNode || !this.floatingNode) return;
    const middleware = buildMiddleware({
      offset: offsetMiddleware,
      flip,
      shift,
      arrow: arrowMiddleware
    }, {
      offset: this.offset(),
      disableFlip: this.disableFlip(),
      disableShift: this.disableShift(),
      arrow: this.arrow(),
      arrowEl: this.arrowNode
    });
    // 'fixed' inline position MUST be written before computePosition measures the
    // floating element's offset parent (fixed vs absolute changes the containing
    // block). Default 'absolute' writes NO inline position — the stylesheet's
    // `position: absolute` stands unchanged, so the default path stays
    // byte-identical (adding an unconditional inline `position: absolute` here
    // would be a specificity change even though the value matches).
    if (__strategy === 'fixed') {
      this.floatingNode.style.position = 'fixed';
    }
    let opts: any = null;
    opts = {
      placement: this.placement(),
      strategy: __strategy,
      middleware
    };
    computePosition(this.anchorNode, this.floatingNode, opts).then((result: any) => {
      this.applyPosition(result.x, result.y, result.middlewareData);
    });
  };
  startTracking = () => {
    if (!this.anchorNode || !this.floatingNode) return;
    if (this.stopAutoUpdate) {
      this.stopAutoUpdate();
      this.stopAutoUpdate = null;
    }
    this.stopAutoUpdate = autoUpdate(this.anchorNode, this.floatingNode, this.position);
  };
  stopTracking = () => {
    if (this.stopAutoUpdate) {
      this.stopAutoUpdate();
      this.stopAutoUpdate = null;
    }
  };
  onAnchorClick = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    this.requestOpen(!this.open());
  };
  onAnchorPointerEnter = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    this.requestOpen(true);
  };
  onAnchorPointerLeave = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    this.requestOpen(false);
  };
  onAnchorFocus = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    this.requestOpen(true);
  };
  onAnchorBlur = () => {
    if ((this.disabled() || this.__rozieCvaDisabled())) return;
    this.requestOpen(false);
  };
  dismiss = () => {
    this.requestOpen(false);
  };
  isTooltip = () => this.trigger() === 'hover' || this.trigger() === 'focus';
  floatingRole = () => this.isTooltip() ? 'tooltip' : 'dialog';
  show = () => {
    if (!(this.disabled() || this.__rozieCvaDisabled())) this.requestOpen(true);
  };
  hide = () => {
    this.requestOpen(false);
  };
  toggle = () => {
    if (!(this.disabled() || this.__rozieCvaDisabled())) this.requestOpen(!this.open());
  };
  reposition = () => {
    this.position();
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
    _dir: Popover,
    _ctx: unknown,
  ): _ctx is AnchorCtx | DefaultCtx {
    return true;
  }

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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default Popover;
