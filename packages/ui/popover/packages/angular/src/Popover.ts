import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

// The `offset` AND `arrow` middleware factories are ALIASED on import: both are
// ALSO author PROP names (`offset`, `arrow`). A bare `offset`/`arrow` shorthand in
// the buildMiddleware factories object resolves to the PROP — on Vue/Svelte the
// destructured prop local shadows the import, and on Angular the emitter rewrites
// the bare shorthand to the prop signal (`offset: this.offset()`, a number) instead
// of the middleware function (TS2322). Aliasing both severs the import↔prop clash.
// (The Cropper import-name==component-name class, applied to imports vs PROP names —
// two collisions, not one.) computePosition/autoUpdate/flip/shift carry no clash.
import { computePosition, autoUpdate, offset as offsetMiddleware, flip, shift, arrow as arrowMiddleware, size } from '@floating-ui/dom';
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

@Component({
  selector: 'rozie-popover',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-popover" #rozieSpread_0 #rozieListenersTarget_1>

      
      <div class="rozie-popover-anchor" #anchorEl [attr.aria-haspopup]="rozieAttr(hasGestureTrigger() ? 'dialog' : null)" [attr.aria-expanded]="rozieAttr(hasGestureTrigger() ? !!open() : null)" [attr.aria-describedby]="rozieAttr(isTooltip() && open() ? 'rozie-popover-floating' : null)" (click)="trigger() === 'click' && onAnchorClick()" (pointerenter)="trigger() === 'hover' && onAnchorPointerEnter()" (pointerleave)="trigger() === 'hover' && onAnchorPointerLeave()" (focusin)="trigger() === 'focus' && onAnchorFocus()" (focusout)="trigger() === 'focus' && onAnchorBlur()">
        <ng-container *ngTemplateOutlet="(anchorTpl ?? __rozieFillMap()['anchor'] ?? templates()?.['anchor']); context: { $implicit: { open: open(), toggle: toggle, show: show, hide: hide }, open: open(), toggle: toggle, show: show, hide: hide }" />
      </div>

      
      @if ((open() || keepMounted()) && !(disabled() || this.__rozieCvaDisabled())) {
    <div class="rozie-popover-floating" [ngClass]="{ 'rozie-popover-floating--static': disablePositioning(), 'rozie-popover-floating--bare': bare(), 'rozie-popover-floating--hidden': !open() }" #floatingEl id="rozie-popover-floating" [attr.role]="rozieAttr(floatingRole())" [attr.aria-modal]="!!(floatingRole() === 'dialog')">
        @if (arrow()) {
    <div class="rozie-popover-arrow" #arrowEl></div>
    }<ng-container *ngTemplateOutlet="(defaultTpl ?? __rozieFillMap()['defaultSlot'] ?? templates()?.['defaultSlot'])" />
      </div>
    }</div>

  `,
  styles: [`
    :host(rozie-popover) { display: contents; }
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
    .rozie-popover-floating--static {
      position: static;
      left: auto;
      top: auto;
      width: auto;
      z-index: auto;
    }
    .rozie-popover-floating--bare {
      background: none;
      border: none;
      border-radius: 0;
      box-shadow: none;
      padding: 0;
    }
    .rozie-popover-floating--hidden {
      display: none;
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
   * How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur, or `'manual'` for a composing component that drives `open` itself — every built-in gesture handler no-ops and the anchor omits `aria-haspopup`/`aria-expanded` (only a real gesture trigger claims the popup). Drives both the gesture handlers and the ARIA role (`'hover'`/`'focus'` → tooltip, `'click'` → popover dialog, `'manual'` → no anchor ARIA claim).
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
   * Opt in to modal dialog semantics for a `click` popover. **Off by default:** a click popover is a non-modal, click-outside-dismissable layer, so its panel is rendered role-neutral (the slot content owns its own ARIA role — e.g. a `role="menu"`) and carries NO `aria-modal`. Set `modal` for a genuinely modal dialog popover: the panel then gets `role="dialog"` + `aria-modal="true"`. **Note:** Popover ships no focus trap (it stays a minimal headless primitive); if you set `modal`, provide your own focus containment so the `aria-modal` claim holds. Ignored for `hover`/`focus` triggers (always tooltip-flavored).
   */
  modal = input<boolean>(false);
  /**
   * Floating UI positioning strategy — 'absolute' (default) or 'fixed'. Use 'fixed' to escape a scrollable/overflow-clipping ancestor (e.g. a sticky table header). Reconciled at runtime.
   */
  strategy = input<string>('absolute');
  /**
   * Suppress the floating panel's own chrome (background, border, border-radius, box-shadow, padding) so a composing component can supply its own instead. Off by default — the panel keeps its standard `--rozie-popover-*` chrome tokens.
   */
  bare = input<boolean>(false);
  /**
   * Render the floating panel in normal document flow instead of computing a floating position — no `computePosition` call and no `autoUpdate` tracking is ever started. For a composing component that already controls the panel's layout (e.g. an `inline` consumer) rather than a genuinely floating popover.
   */
  disablePositioning = input<boolean>(false);
  /**
   * Render the floating panel hidden instead of unmounting it while closed, so a composing component whose panel content owns scroll state (e.g. a virtualizer) keeps its DOM across a close/open cycle. A one-shot position computation runs once at mount so the hidden panel already carries correct coordinates before the first open.
   */
  keepMounted = input<boolean>(false);
  /**
   * Match the floating panel's width exactly to the anchor's width, via the Floating UI `size` middleware. Writes the panel's `width` style only — never touches height.
   */
  matchWidth = input<boolean>(false);
  /**
   * Suppress Popover's own Escape-key and click-outside dismissal listeners while `true`. For a composing component that drives `open` itself and needs to temporarily veto Popover's independent dismissal — e.g. while a host sub-surface anchored to (but not nested inside) the composed control legitimately holds focus. Off by default; existing `trigger="manual"` consumers relying on real click-outside dismissal are unaffected unless they opt in.
   */
  disableDismiss = input<boolean>(false);
  anchorEl = viewChild<ElementRef<HTMLDivElement>>('anchorEl');
  floatingEl = viewChild<ElementRef<HTMLDivElement>>('floatingEl');
  arrowEl = viewChild<ElementRef<HTMLDivElement>>('arrowEl');
  change = output<unknown>();
  @ContentChild('anchor', { read: TemplateRef }) anchorTpl?: TemplateRef<AnchorCtx>;
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
        if (!(this.open() && !this.disableDismiss())) return;
        const handler = ($event: KeyboardEvent) => {
          if ($event.key !== 'Escape') return;
          this.dismiss();
        };
        const unlisten = renderer.listen('document', 'keydown', handler);
        onCleanup(unlisten);
      });

      effect((onCleanup) => {
        if (!(this.open() && !this.disableDismiss())) return;
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
        queueMicrotask(() => {
          if (!this.open() || (this.disabled() || this.__rozieCvaDisabled())) return;
          this.floatingNode = this.floatingEl()?.nativeElement;
          this.arrowNode = this.arrowEl()?.nativeElement;
          this.startTracking();
        });
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
    const __disabled = (this.disabled() || this.__rozieCvaDisabled());
    // $refs read ONLY here (ROZ123). The floating + arrow elements live behind r-if
    // and may be null until open (or keepMounted); startTracking re-reads via the
    // watch path.
    this.anchorNode = this.anchorEl()?.nativeElement;
    if (this.open() && !__disabled) {
      // floatingNode is populated by its r-if having rendered; read it lazily inside
      // the watch/handlers too. Position on next tick when it exists.
      this.floatingNode = this.floatingEl()?.nativeElement;
      this.arrowNode = this.arrowEl()?.nativeElement;
      this.startTracking();
    } else if (this.keepMounted() && !__disabled) {
      // keepMounted (D-03): the panel is mounted-but-hidden. Read the refs and run
      // a ONE-SHOT position() — never startTracking()/autoUpdate, which stays
      // strictly open-gated (D-11) — so the hidden panel already carries real
      // coordinates before the first open instead of painting at 0,0. position()
      // itself no-ops when disablePositioning is set.
      this.floatingNode = this.floatingEl()?.nativeElement;
      this.arrowNode = this.arrowEl()?.nativeElement;
      this.position();
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
  // `document.activeElement` stops at the OUTERMOST shadow-DOM host when focus
  // lives inside a NESTED shadow tree — e.g. a Lit consumer that composes
  // `<rozie-popover>` inside its own shadow root (data-table's vendored copy):
  // clicking the trigger focuses a real element several shadow boundaries deep,
  // but `document.activeElement` only resolves as far as the outermost custom
  // element (`<rozie-data-table>`), not the actual focused node. Walking
  // `.shadowRoot.activeElement` recursively drills to the true focused element.
  // On the other 5 targets (no shadow DOM) `el.shadowRoot` is always
  // null/undefined, so the loop is a no-op and this degrades to a plain
  // `document.activeElement` read — one implementation, safe on every target.
  deepActiveElement = () => {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    return el;
  };
  // Drive the two-way model + emit in one place. Named `requestOpen` (NOT `setOpen`)
  // to dodge the React generated `setOpen` setter for the `open` model (ROZ524).
  //
  // Focus-return (phase 72-06b, D-08 a11y finding): scoped to `trigger === 'click'`
  // only — click-triggered popovers are genuinely interactive (a real dialog the
  // user tabs/clicks into), so restoring focus to the trigger on dismissal matches
  // standard disclosure-widget a11y practice. Deliberately NOT applied to
  // `hover`/`focus` triggers (tooltip-flavored, see `isTooltip()`): those close on
  // pointerleave/blur constantly during normal mouse/keyboard traversal, and
  // forcing a focus() call on every such close would fight the user's own focus
  // movement rather than restore anything lost.
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
  // Apply the resolved x/y (and arrow offset, when present) onto the floating element.
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
  // Recompute the position once. Pure engine call; safe to invoke whenever both
  // elements exist and the content is open. `opts` is a null-let (→ `any`) so the
  // loosely-typed `<props>` placement (string) + the `unknown[]` middleware array don't
  // fail the strict leaf tsc against Floating UI's `Placement` / `Middleware[]` types
  // (the cropper `let cfg = null` constructor-args idiom).
  position = () => {
    const __strategy = this.strategy();
    if (this.disablePositioning()) return;
    if (!this.anchorNode || !this.floatingNode) return;
    const middleware = buildMiddleware({
      offset: offsetMiddleware,
      flip,
      shift,
      arrow: arrowMiddleware,
      size
    }, {
      offset: this.offset(),
      disableFlip: this.disableFlip(),
      disableShift: this.disableShift(),
      arrow: this.arrow(),
      arrowEl: this.arrowNode,
      matchWidth: !!this.matchWidth()
    });
    // 'fixed' inline position MUST be written before computePosition measures the
    // floating element's offset parent (fixed vs absolute changes the containing
    // block). Default 'absolute' explicitly CLEARS any inline position instead of
    // writing `position: absolute` — so a never-fixed popover still writes no
    // visible inline position (byte-identical-off preserved: `style.position = ''`
    // is a no-op when the property was never set), while a live `strategy`
    // reconcile (fixed → absolute, see the $watch below) correctly resets the
    // stale inline `fixed` so the stylesheet's `position: absolute` rule re-takes
    // over instead of positioning `fixed` with absolute-computed coordinates
    // (72-REVIEW.md WR-01).
    if (__strategy === 'fixed') {
      this.floatingNode.style.position = 'fixed';
    } else {
      this.floatingNode.style.position = '';
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
  // Start autoUpdate (idempotent — stop any prior subscription first) and do an
  // initial position. Floating UI's autoUpdate keeps the position fresh on scroll/
  // resize/ancestor-layout changes and returns its own teardown.
  startTracking = () => {
    if (this.disablePositioning()) return;
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
  // ─── trigger gesture handlers (wired conditionally on the anchor by `trigger`) ──
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
  // Dismissal handler — method reference for the <listeners> block (an inline
  // handler referencing $event leaks into React's useEffect deps → TS2552; every
  // corpus <listener> uses a method-ref + modifiers).
  dismiss = () => {
    this.requestOpen(false);
  };
  // ─── role helpers (plain functions; tooltip vs popover-dialog by trigger) ───────
  // hasGestureTrigger() (D-02): whether `trigger` is one of the three REAL anchor
  // gestures. `'manual'` (and any other unrecognized value) returns false, which
  // gates the anchor's `aria-haspopup`/`aria-expanded` off entirely — a composing
  // component driving `open` itself must not have its wrapper claim a popup it
  // does not own (D-01).
  hasGestureTrigger = () => this.trigger() === 'click' || this.trigger() === 'hover' || this.trigger() === 'focus';
  // hover/focus triggers are tooltip-flavored; click is an interactive popover.
  isTooltip = () => this.trigger() === 'hover' || this.trigger() === 'focus';
  // Role: hover/focus → 'tooltip'; a click popover is 'dialog' ONLY when the consumer
  // opts into `modal` (which is what also emits aria-modal). A default (non-modal)
  // click popover returns `undefined` — a role-NEUTRAL positioned container, so the slot
  // content owns its own semantics (e.g. the data-table ⋯ menu declares role="menu").
  // Emitting role="dialog" + aria-modal="true" on a click-outside-dismissable panel
  // with no focus trap wrongly tells assistive tech that sibling content is inert (IN-03).
  // `undefined` (not `null`) for the neutral case: the Vue `:role` binding target is
  // `string | undefined`, and under strict vue-tsc `null` is not assignable to it —
  // `undefined` drops the attribute identically (Vue/Solid nullish-attr drop treats both
  // alike) while keeping the emitted leaf's inferred type a clean `'tooltip' | 'dialog' | undefined`.
  floatingRole = () => this.isTooltip() ? 'tooltip' : this.modal() ? 'dialog' : undefined;
  // ─── imperative handle ($expose) ────────────────────────────────────────────────
  // Verbs: show/hide/toggle/reposition. NOT `update` (reserved Lit lifecycle) → the
  // reposition verb is `reposition`. None collide with the `change` emit, the `open`
  // model, or its React `setOpen` setter, nor with inherited HTMLElement members.
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

export default Popover;
