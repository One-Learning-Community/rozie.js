import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, forwardRef, inject, input, model, signal, untracked, viewChild } from '@angular/core';
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
import { buildMiddleware, AVAILABLE_WIDTH_PROPERTY } from './internal/middleware';

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
//   lastFocusedEl (phase 72-06b; widened by release-0.8.0 audit B5) holds whatever
//   had DOM focus at the moment a non-tooltip popover opened — through its trigger,
//   the handle, or a controlled `open` write (natively the clicked trigger element
//   itself, since a mousedown focuses a native `<button>` before its `click` fires)
//   — restored on close only when focus would otherwise be lost (see restoreFocus).
//   Same null-let convention as the others: read/written only in handlers, `any`
//   via typeNeutralize.

/** An `aria-haspopup` token: what kind of popup a click popover's panel is (the `popupRole` prop). */
export type PopoverPopupRole = 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid';

interface AnchorCtx {
  $implicit: { open: boolean; toggle: () => void; show: () => void; hide: () => void; panelId: string; popupRole: PopoverPopupRole | null };
  open: boolean;
  toggle: () => void;
  show: () => void;
  hide: () => void;
  panelId: string;
  popupRole: PopoverPopupRole | null;
}

interface DefaultCtx {}

@Component({
  selector: 'rozie-popover',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-popover" #rozieSpread_0 #rozieListenersTarget_1>

      
      <div class="rozie-popover-anchor" #anchorEl [attr.aria-haspopup]="rozieAttr(anchorHaspopup())" [attr.aria-expanded]="rozieAttr(trigger() === 'click' ? !!open() : null)" [attr.aria-controls]="rozieAttr(trigger() === 'click' && open() ? panelId() : null)" [attr.aria-describedby]="rozieAttr(isTooltip() && open() ? panelId() : null)" (click)="trigger() === 'click' && onAnchorClick()" (pointerenter)="trigger() === 'hover' && onAnchorPointerEnter()" (pointerleave)="trigger() === 'hover' && onAnchorPointerLeave()" (focusin)="trigger() === 'focus' && onAnchorFocus()" (focusout)="trigger() === 'focus' && onAnchorBlur()">
        <ng-container *ngTemplateOutlet="(anchorTpl ?? __rozieFillMap()['anchor'] ?? templates()?.['anchor']); context: { $implicit: { open: open(), toggle: toggle, show: show, hide: hide, panelId: panelId(), popupRole: anchorPopupRole() }, open: open(), toggle: toggle, show: show, hide: hide, panelId: panelId(), popupRole: anchorPopupRole() }" />
      </div>

      
      @if ((open() || keepMounted()) && !(disabled() || this.__rozieCvaDisabled())) {
    <div class="rozie-popover-floating" [ngClass]="{ 'rozie-popover-floating--static': disablePositioning(), 'rozie-popover-floating--bare': bare(), 'rozie-popover-floating--hidden': !open() }" #floatingEl [attr.id]="rozieAttr(panelId())" [attr.role]="rozieAttr(floatingRole())" [attr.aria-modal]="rozieAttr(floatingRole() === 'dialog' ? 'true' : null)">
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
      z-index: var(--rozie-popover-z, var(--rpo-z, 1000));
      width: max-content;
      /* The second min() argument is written by Popover while it tracks the anchor
         (the width available to the panel); it is not a theming token. border-box makes
         the cap include the padding and border. */
      box-sizing: border-box;
      max-width: min(var(--rozie-popover-max-width, var(--rpo-max-width, calc(100vw - 16px))), var(--rozie-popover-available-width, 100vw));
      background: var(--rozie-popover-bg, var(--rpo-bg, #fff));
      color: var(--rozie-popover-color, var(--rpo-color, inherit));
      border: var(--rozie-popover-border, var(--rpo-border, 1px solid rgba(0, 0, 0, 0.12)));
      border-radius: var(--rozie-popover-radius, var(--rpo-radius, 8px));
      box-shadow: var(--rozie-popover-shadow, var(--rpo-shadow, 0 8px 24px rgba(0, 0, 0, 0.12)));
      padding: var(--rozie-popover-padding, var(--rpo-padding, 8px 12px));
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
      width: var(--rozie-popover-arrow-size, var(--rpo-arrow-size, 8px));
      height: var(--rozie-popover-arrow-size, var(--rpo-arrow-size, 8px));
      background: var(--rozie-popover-bg, var(--rpo-bg, #fff));
      border: var(--rozie-popover-border, var(--rpo-border, 1px solid rgba(0, 0, 0, 0.12)));
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
   * Whether the floating content is open. The sole `model: true` prop, and its change event is the only change signal Popover fires. Bind it two-way — Vue `v-model:open`, React/Solid `open` + `onOpenChange`, Svelte `bind:open`, Angular `[(open)]`, Lit the `open` property + the `open-change` event — and Popover writes the new state back whenever the trigger, a dismissal or the handle toggles it. Left unbound it falls back to an uncontrolled default.
   */
  open = model<boolean>(false);
  /**
   * Floating UI placement of the content relative to the anchor — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end` (e.g. `bottom-start`). With `disableFlip` off, the content flips to the opposite side when it would overflow the viewport, and a `left`/`right` placement with no room on either side falls back to below or above the anchor. Reconciled at runtime.
   */
  placement = input<string>('bottom');
  /**
   * How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur, or `'manual'` for a composing component that drives `open` itself — every built-in gesture handler no-ops. Drives both the gesture handlers and the ARIA: `'click'` sets `aria-haspopup`/`aria-expanded`/`aria-controls` on the anchor wrapper; `'hover'`/`'focus'` are tooltips (`role="tooltip"` panel, `aria-describedby` on the wrapper, no popup claim); `'manual'` makes no anchor ARIA claim. The wrapper is not focusable, so put the matching attributes on your own focusable trigger too — the `anchor` slot passes `open`, `panelId` and `popupRole` for exactly that. The `aria-haspopup` value is the `popupRole` prop (default `'dialog'`).
   */
  trigger = input<string>('click');
  /**
   * Distance in pixels between the anchor and the floating content (the Floating UI `offset` middleware). Reconciled at runtime.
   */
  offset = input<number>(8);
  /**
   * Disable the Floating UI `flip` middleware. By default the content flips to the opposite side of the anchor when it would overflow the viewport, and a `left`/`right` placement with no room on either side falls back to below or above the anchor; set this to keep it pinned to `placement` regardless.
   */
  disableFlip = input<boolean>(false);
  /**
   * Disable the Floating UI `shift` middleware. By default the content shifts to stay within the viewport (a `left`/`right` placement that fits nowhere slides back across the anchor), and its width is capped at the available width Popover measures and publishes on the panel as `--rozie-popover-available-width`; set this to keep it strictly aligned to the anchor and drop that measured cap.
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
  /**
   * The kind of popup the panel content is, announced as `aria-haspopup` on the anchor wrapper of a `click` popover: `'dialog'` (the default), `'menu'`, `'listbox'`, `'tree'` or `'grid'`; any other value is treated as `'dialog'`. Set `'menu'` when the panel hosts a menu (your content carries `role="menu"`), so a menu button keeps the click trigger and its focus return. The `anchor` slot passes the same value as `popupRole` (with `open` and `panelId`) so you can put `aria-haspopup` / `aria-expanded` / `aria-controls` on your own focusable trigger. It is `null` for the tooltip triggers (`'hover'` / `'focus'`), which claim no popup; for `'manual'` it is the prop value, for the trigger you own.
   */
  popupRole = input<string>('dialog');
  /**
   * Id base for the floating panel, whose id is `idBase + '-panel'` — also exposed to the `anchor` slot as `panelId`, so your trigger can set `aria-controls` (click) or `aria-describedby` (tooltip) to it. Leave it empty (the default) and each instance generates a unique id base after mount (`rozie-popover-<n>`), so several popovers on one page never share a panel id; set it when you need a stable, predictable id. On Lit the panel lives in the element's shadow root, so an id reference from light DOM, including your slotted anchor content, cannot resolve to it; there the anchor wrapper's own attributes, which sit inside the shadow root, carry the reference. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase = input<string>('');
  /**
   * Position the content against an external reference instead of the built-in anchor wrapper: either a DOM Element another component owns (e.g. a calendar event element) or a Floating UI virtual element — an object with a `getBoundingClientRect()` method and an optional `contextElement` — e.g. to open at a pointer position. The reference is measured and tracked with Floating UI's `autoUpdate` and reconciled at runtime; `null` (the default) keeps the built-in anchor. A click on a referenced Element does not count as an outside click (so a consumer toggle on it closes the panel); with a virtual element only the anchor wrapper and the panel count as inside. You own the trigger ARIA on your own element (`aria-haspopup` / `aria-expanded`, plus `aria-controls` pointing at `idBase + '-panel'`), typically with `trigger='manual'` and a two-way-bound `open`. If a referenced Element is removed from the document while open, the popover closes. Pass a stable value — a new object on every render restarts tracking.
   */
  reference = input<(Element | Record<string, any>) | null>(null);
  autoId = signal('');
  anchorEl = viewChild<ElementRef<HTMLDivElement>>('anchorEl');
  floatingEl = viewChild<ElementRef<HTMLDivElement>>('floatingEl');
  arrowEl = viewChild<ElementRef<HTMLDivElement>>('arrowEl');
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
  private __rozieWatchInitial_6 = true;
  private __rozieWatchInitial_7 = true;
  private __rozieWatchInitial_8 = true;
  private __rozieWatchInitial_9 = true;

  constructor() {
      const renderer = inject(Renderer2);

      effect((onCleanup) => {
        if (!(this.open() && !this.disableDismiss())) return;
        const handler = ($event: KeyboardEvent) => {
          if ($event.key !== 'Escape') return;
          ((this.dismiss) as (...args: any[]) => any)($event);
        };
        const unlisten = renderer.listen('document', 'keydown', handler);
        onCleanup(unlisten);
      });

      effect((onCleanup) => {
        if (!(this.open() && !this.disableDismiss())) return;
        const listenTarget = typeof document === 'undefined' ? null : document;
        if (!listenTarget) return;
        const handler = ($event: MouseEvent) => {
          const target = $event.target as Node;
          if (this.anchorEl()?.nativeElement?.contains(target) || this.floatingEl()?.nativeElement?.contains(target)) return;
          ((this.dismissOutside) as (...args: any[]) => any)($event);
        };
        listenTarget.addEventListener('click', handler as EventListener, true);
        onCleanup(() => listenTarget.removeEventListener('click', handler as EventListener, true));
      });

    effect(() => { const __watchVal = (() => this.open())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
      if (isOpen && !(this.disabled() || this.__rozieCvaDisabled())) {
        // A controlled `open` write (or the handle) never ran requestOpen's capture.
        this.captureReturnFocus();
        queueMicrotask(() => this.trackWhenRendered(3));
      } else {
        this.stopTracking();
        // A controlled close (the consumer wrote `open = false`); an internal close
        // already restored in requestOpen, so this is a no-op then.
        this.restoreFocus();
      }
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.placement())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => this.refresh())(); }); });
    effect(() => { const __watchVal = (() => this.offset())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => this.refresh())(); }); });
    effect(() => { const __watchVal = (() => this.disableFlip())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } (() => this.refresh())(); }); });
    effect(() => { const __watchVal = (() => this.disableShift())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((off: any) => {
      if (off) this.clearAvailableWidth();
      this.refresh();
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.disablePositioning())(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((off: any) => {
      if (off) {
        this.stopTracking();
        this.clearInlinePosition();
      } else if (this.open() && !(this.disabled() || this.__rozieCvaDisabled())) {
        this.startTracking();
      }
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.strategy())(); untracked(() => { if (this.__rozieWatchInitial_6) { this.__rozieWatchInitial_6 = false; return; } (() => this.refresh())(); }); });
    effect(() => { const __watchVal = (() => this.matchWidth())(); untracked(() => { if (this.__rozieWatchInitial_7) { this.__rozieWatchInitial_7 = false; return; } ((on: any) => {
      if (!on && this.floatingNode) this.floatingNode.style.width = '';
      this.refresh();
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.arrow())(); untracked(() => { if (this.__rozieWatchInitial_8) { this.__rozieWatchInitial_8 = false; return; } (() => {
      queueMicrotask(() => {
        this.arrowNode = this.arrowEl()?.nativeElement;
        this.refresh();
      });
    })(); }); });
    effect(() => { const __watchVal = (() => this.reference())(); untracked(() => { if (this.__rozieWatchInitial_9) { this.__rozieWatchInitial_9 = false; return; } (() => {
      this.liveReference = this.reference();
      if ((this.disabled() || this.__rozieCvaDisabled())) return;
      if (this.stopAutoUpdate) {
        this.startTracking();
      } else if (this.keepMounted() && this.floatingNode) {
        this.position();
      }
    })(); }); });
  }

  ngAfterViewInit() {
    const __disabled = (this.disabled() || this.__rozieCvaDisabled());
    if (!this.idBase()) this.autoId.set('rozie-popover-' + this.nextAutoId());
    // $refs read ONLY here (ROZ123). The floating + arrow elements live behind r-if
    // and may be null until open (or keepMounted); startTracking re-reads via the
    // watch path.
    // $refs read ONLY here (ROZ123). The floating + arrow elements live behind r-if
    // and may be null until open (or keepMounted); startTracking re-reads via the
    // watch path.
    this.anchorNode = this.anchorEl()?.nativeElement;
    this.liveReference = this.reference();
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
  // The current `reference`, mirrored into a top-level let (release-0.8.0 audit
  // A2). The deferred outside-click check below runs after the click's handlers
  // and re-renders; a let is read live on every target (on React it is a ref),
  // where a `$props` read inside that callback could be a stale render closure.
  liveReference: any = null;
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
  // Focus-return (phase 72-06b, D-08 a11y finding; widened by release-0.8.0 audit
  // B5). Applies to every NON-tooltip trigger (`click` and `manual`, which is what a
  // `reference` popover or a composing component uses) and to every way of opening
  // (trigger, handle, controlled `open` write). Deliberately NOT applied to
  // `hover`/`focus` triggers (tooltip-flavored, see `isTooltip()`): those close on
  // pointerleave/blur constantly during normal mouse/keyboard traversal, and
  // forcing a focus() call on every such close would fight the user's own focus
  // movement rather than restore anything lost.
  //
  // Capture once per open cycle (the first of requestOpen / the open watch wins).
  captureReturnFocus = () => {
    if (this.isTooltip() || this.lastFocusedEl) return;
    this.lastFocusedEl = this.deepActiveElement();
  };
  // Composed containment: also walks slot assignment and shadow hosts. On Lit
  // the panel's own content is SLOTTED (a light-DOM child of the popover host,
  // projected into the panel's <slot>), which plain `contains()` never sees.
  composedContains = (container: any, node: any) => {
    let n: any = null;
    n = node;
    while (n) {
      if (n === container) return true;
      n = n.assignedSlot || n.parentNode || n.host || null;
    }
    return false;
  };
  // Restore only when focus would otherwise be LOST: it sits inside the closing
  // panel, or has already fallen back to <body> (the panel unmounted around it, or
  // the user clicked a non-focusable spot). Focus the user moved somewhere else —
  // e.g. a click into another input, which focuses it on mousedown before the
  // outside-click dismissal runs — is left alone, never stolen.
  restoreFocus = () => {
    let el: any = null;
    el = this.lastFocusedEl;
    this.lastFocusedEl = null;
    if (this.isTooltip() || !el || !el.isConnected || typeof el.focus !== 'function') return;
    let active: any = null;
    active = this.deepActiveElement();
    const insidePanel = !!(this.floatingNode && active && this.composedContains(this.floatingNode, active));
    if (insidePanel) {
      el.focus();
      return;
    }
    const lost = !active || active === document.body || active === document.documentElement;
    if (!lost) return;
    // A close that runs INSIDE a blur (e.g. a composing combobox closing from its
    // input's blur on Tab) sees <body> as active only transiently: the browser
    // focuses the Tab destination after the blur listeners return. Judge "lost"
    // again after the focus change settles (a macrotask), so a user-initiated
    // focus move is never undone; focus that really fell to <body> (panel
    // unmounted around it, a click on a non-focusable spot) is still restored.
    setTimeout(() => {
      let now: any = null;
      now = this.deepActiveElement();
      const stillLost = !now || now === document.body || now === document.documentElement;
      if (stillLost && el.isConnected) el.focus();
    }, 0);
  };
  // Drive the two-way model in one place. Named `requestOpen` (NOT `setOpen`)
  // to dodge the React generated `setOpen` setter for the `open` model (ROZ524).
  requestOpen = (next: any) => {
    if (this.open() === next) return;
    if (next) this.captureReturnFocus();
    this.open.set(next), this.__rozieCvaOnChange(next);
    // Restore while the panel is still mounted, so focus inside it is recognized.
    if (!next) this.restoreFocus();
  };
  // Apply the resolved x/y (and arrow offset, when present) onto the floating element.
  applyPosition = (x: any, y: any, middlewareData: any) => {
    if (!this.floatingNode) return;
    // A computePosition() already in flight when positioning was switched off must not
    // write coordinates back after clearInlinePosition() emptied them.
    if (this.disablePositioning()) return;
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
    // The Floating UI reference: the `reference` prop (external Element or virtual
    // element) when set, else the built-in anchor wrapper (260929-lyc DD-3). A
    // function-local null-let so typeNeutralize makes it `any` in every leaf — the
    // union prop type never trips strict leaf tsc against `ReferenceElement`.
    let referenceEl: any = null;
    referenceEl = this.reference() || this.anchorNode;
    if (!referenceEl || !this.floatingNode) return;
    // A referenced Element removed from the document measures as a zero rect at
    // the viewport origin (release-0.8.0 audit B2), e.g. a calendar event element
    // FullCalendar re-rendered. There is nothing left to point at, so close.
    if (referenceEl.nodeType === 1 && !referenceEl.isConnected) {
      if (this.open()) this.requestOpen(false);
      return;
    }
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
    computePosition(referenceEl, this.floatingNode, opts).then((result: any) => {
      this.applyPosition(result.x, result.y, result.middlewareData);
    });
  };
  // Start autoUpdate (idempotent — stop any prior subscription first) and do an
  // initial position. Floating UI's autoUpdate keeps the position fresh on scroll/
  // resize/ancestor-layout changes and returns its own teardown.
  startTracking = () => {
    if (this.disablePositioning()) return;
    // Same reference resolution as position() (DD-3). autoUpdate accepts a virtual
    // element: it unwraps it to its optional `contextElement` for ancestor/resize
    // observation (skipped when absent) and still runs the initial update.
    let referenceEl: any = null;
    referenceEl = this.reference() || this.anchorNode;
    if (!referenceEl || !this.floatingNode) return;
    if (this.stopAutoUpdate) {
      this.stopAutoUpdate();
      this.stopAutoUpdate = null;
    }
    this.stopAutoUpdate = autoUpdate(referenceEl, this.floatingNode, this.position);
  };
  // The measured width cap (`--rozie-popover-available-width`, written by the width-limit
  // size middleware) belongs to a live tracking session: drop it whenever positioning is
  // torn down or goes static, so a panel that stops being measured (closed keepMounted,
  // disablePositioning, disableShift) never keeps a stale max-width cap.
  clearAvailableWidth = () => {
    if (this.floatingNode) this.floatingNode.style.removeProperty(AVAILABLE_WIDTH_PROPERTY);
  };
  // Every inline declaration the positioning code writes on the panel (and the arrow)
  // besides the width-limit property above: `left` / `top` (applyPosition), the inline
  // `position: fixed` (position() with strategy="fixed") and the `matchWidth` width (the
  // size middleware). The `--static` class resets these with CLASS specificity, which an
  // inline declaration beats, so turning `disablePositioning` on while open must remove
  // them or the in-flow panel stays stuck at its old floating coordinates. Only these
  // properties are removed, never the whole style attribute (a consumer's own inline
  // style on the panel is not ours to touch).
  clearInlinePosition = () => {
    if (this.floatingNode) {
      this.floatingNode.style.removeProperty('left');
      this.floatingNode.style.removeProperty('top');
      this.floatingNode.style.removeProperty('position');
      this.floatingNode.style.removeProperty('width');
    }
    if (this.arrowNode) {
      this.arrowNode.style.removeProperty('left');
      this.arrowNode.style.removeProperty('top');
    }
  };
  stopTracking = () => {
    if (this.stopAutoUpdate) {
      this.stopAutoUpdate();
      this.stopAutoUpdate = null;
    }
    this.clearAvailableWidth();
  };
  // nextAutoId(): a page-wide counter shared by every Rozie component instance. It
  // lives on globalThis (read through Reflect, which type-checks in the plain-JS and
  // the TS script alike) so separately bundled copies of a leaf never hand out the
  // same id. The same four lines live in Combobox, Listbox and Popover.
  nextAutoId = () => {
    const n = (Number(Reflect.get(globalThis, '__rozieAutoId')) || 0) + 1;
    Reflect.set(globalThis, '__rozieAutoId', n);
    return n;
  };
  // ─── open/close drives autoUpdate (lazy $watch — never fires on initial value) ──
  //
  // Phase 72-07 finding (canonical-Popover scope, routed here per the plan's own
  // contingency): reading `$refs.floatingEl` SYNCHRONOUSLY inside this $watch
  // callback gets a STALE (pre-toggle) value on Vue/Angular/Lit — Vue's `watch()`
  // defaults to `flush:'pre'` (runs BEFORE the newly-toggled `r-if` patches the
  // DOM), and Angular's signal `effect()` / Lit's `$watch` compilation have an
  // analogous ordering gap relative to when `floatingEl`'s viewChild/ref actually
  // reflects the just-rendered element. The practical effect: `floatingNode`
  // stayed `undefined`, `startTracking()`'s own `if (!anchorNode || !floatingNode)
  // return` guard silently no-opped, and the floating panel never got its
  // floating-ui-computed `left`/`top`/`position` — it rendered at the stylesheet's
  // default `position:absolute;left:0;top:0` relative to whatever positioned
  // ancestor happened to be nearest (the viewport's initial containing block in
  // a standalone demo; a data-table `<th>` in the pinned/sticky-header case),
  // nowhere near the actual anchor. React/Svelte/Solid were unaffected — their
  // own effect/reactive-statement timing already runs after the DOM commit.
  //
  // Fix: defer the ref read + startTracking() one microtask. A microtask
  // boundary is always AFTER the current synchronous DOM-patch pass completes
  // on every target (it's a JS-platform guarantee, not framework-specific), so
  // `$refs.floatingEl` is guaranteed fresh by the time this runs — on every
  // target, including the 3 that were already correct (their own post-render
  // timing means the ref is already fresh even before the extra microtask
  // delay, so the deferred read observes the same value, not a stale one).
  // trackWhenRendered(retries): read the just-rendered panel and start tracking.
  // The single-microtask deferral below assumes the framework's own re-render was
  // queued BEFORE this watch's microtask. On Lit that holds only while the render
  // watcher subscribed to `open` first: ANY re-render before the first open (e.g.
  // the generated id base landing after mount, quick 261002-ekf) re-subscribes it
  // behind this watch, so the microtask ran before the panel existed and
  // startTracking() silently no-opped — an unpositioned panel. When the panel is
  // not rendered yet, retry on the next microtask, which runs after the render
  // that is already queued.
  trackWhenRendered = (retries: any) => {
    if (!this.open() || (this.disabled() || this.__rozieCvaDisabled())) return;
    this.floatingNode = this.floatingEl()?.nativeElement;
    this.arrowNode = this.arrowEl()?.nativeElement;
    if (!this.floatingNode && retries > 0) {
      queueMicrotask(() => this.trackWhenRendered(retries - 1));
      return;
    }
    this.startTracking();
  };
  // ─── reconcile positioning props while open ─────────────────────────────────────
  // Restart tracking rather than repositioning once (release-0.8.0 audit B3):
  // autoUpdate holds the position callback it was started with, which on React is
  // the render-time closure — a one-shot position() with the new props would be
  // reverted by the next scroll/resize update through the old closure.
  // startTracking() re-subscribes with the current callback and positions
  // immediately. Closed or untracked (disablePositioning) → plain position().
  refresh = () => {
    if (!this.open()) return;
    if (this.stopAutoUpdate) this.startTracking();else this.position();
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
  // Dismissal handlers — method references for the <listeners> block. A method-ref
  // `<listener>` handler receives the DOM event on all 6 targets (260929-mn8 DD-8:
  // callable handlers are invoked with the event; inline statements run with
  // `$event` in scope), so dismissOutside can inspect the click.
  //
  // `dismiss` serves Escape and closes unconditionally: an Escape keydown whose
  // target is a focused EXTERNAL trigger (the `reference` element) must still close,
  // so Escape must NOT apply the inside check below.
  dismiss = () => {
    this.requestOpen(false);
  };
  // Click-outside (260929-lyc DD-5). The `.outside(anchorEl, floatingEl)` modifier
  // already excludes the built-in anchor wrapper + the panel; an Element `reference`
  // is ALSO inside, so a click on it is left to the consumer's own toggle (which then
  // closes the panel instead of dismiss-then-reopen). `composedPath()` is checked
  // first — it is load-bearing for shadow-DOM (Lit) consumers, where a document-level
  // listener sees the click retargeted to the outermost host. A virtual element
  // (no `nodeType`) adds no inside region.
  isInsideReference = (path: any, target: any) => {
    let referenceEl: any = null;
    referenceEl = this.liveReference;
    if (!referenceEl || referenceEl.nodeType !== 1) return false;
    if (path && path.includes(referenceEl)) return true;
    return !!(target && referenceEl.contains(target));
  };
  // The decision is made one task LATER (release-0.8.0 audit A2), after the
  // click's own handlers and the re-render they cause, against the reference as
  // it is THEN. So a consumer handler that repoints `reference` at the element
  // just clicked (and keeps `open` true) keeps the panel open and moves it,
  // instead of the dismissal closing it first and the handler reopening it. That
  // close-then-reopen round trip is not just a flicker on Angular: a parent that
  // writes `open` back to `true` in the same tick is not re-pushed to the
  // child's model (Angular only re-binds a CHANGED value), leaving the panel
  // closed while the parent believes it open. The path and target are captured
  // NOW — `composedPath()` is empty after dispatch, and the target may detach.
  dismissOutside = (event: any) => {
    let path: any = null;
    path = event && typeof event.composedPath === 'function' ? event.composedPath() : null;
    let target: any = null;
    target = event ? event.target : null;
    if (this.isInsideReference(path, target)) return;
    setTimeout(() => {
      if (this.isInsideReference(path, target)) return;
      this.requestOpen(false);
    }, 0);
  };
  // ─── role helpers (plain functions; tooltip vs popover-dialog by trigger) ───────
  // Only a `click` trigger claims a popup on the anchor (`aria-haspopup` /
  // `aria-expanded` / `aria-controls`, see the template). `'manual'` never does
  // (D-01/D-02: a composing component driving `open` itself must not have its
  // wrapper claim a popup it does not own), and neither do the tooltip triggers
  // (release-0.8.0 audit B7): a tooltip is described by its panel
  // (`aria-describedby`), it does not expand a popup.
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
  // The `aria-haspopup` value for the consumer's own trigger, handed to the anchor
  // slot as `popupRole`: none for a tooltip (it describes, it does not pop up).
  // The popupRole prop narrowed to a valid `aria-haspopup` token (an unknown value
  // falls back to 'dialog'). Comparing against literals also gives the strict
  // React/Solid/Vue attribute types the ARIA token union they require.
  popupToken = () => {
    const r = this.popupRole();
    return r !== 'menu' && r !== 'listbox' && r !== 'tree' && r !== 'grid' ? 'dialog' : r;
  };
  anchorPopupRole = () => this.isTooltip() ? null : this.popupToken();
  // The anchor wrapper's own `aria-haspopup`: a click trigger only. `undefined`
  // (not `null`) for the other triggers, for strict vue-tsc (see floatingRole).
  anchorHaspopup = () => this.trigger() === 'click' ? this.popupToken() : undefined;
  // The panel id (audit B1), also handed to the anchor slot as `panelId`.
  // idRoot(): the `idBase` prop, else the per-instance id generated in $onMount,
  // else the pre-mount fallback. Generated after mount (not during setup) so a
  // server render and the hydrating client agree.
  idRoot = () => this.idBase() || this.autoId() || 'rozie-popover';
  panelId = () => this.idRoot() + '-panel';
  // ─── imperative handle ($expose) ────────────────────────────────────────────────
  // Verbs: show/hide/toggle/reposition. NOT `update` (reserved Lit lifecycle) → the
  // reposition verb is `reposition`. None collide with the `open` model or its
  // React `setOpen` setter, nor with inherited HTMLElement members.
  show: () => void = () => {
    if (!(this.disabled() || this.__rozieCvaDisabled())) this.requestOpen(true);
  };
  hide: () => void = () => {
    this.requestOpen(false);
  };
  toggle: () => void = () => {
    if (!(this.disabled() || this.__rozieCvaDisabled())) this.requestOpen(!this.open());
  };
  reposition: () => void = () => {
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
