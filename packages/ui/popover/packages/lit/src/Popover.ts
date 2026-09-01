import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, untracked } from '@lit-labs/preact-signals';
import { attachOutsideClickListener, createLitControllableProperty, rozieAttr, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
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

interface RozieAnchorSlotCtx {
  open: any;
  toggle: any;
  show: any;
  hide: any;
}

@customElement('rozie-popover')
export default class Popover extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-popover[data-rozie-s-c6cf02ea] {
  display: contents;
}
.rozie-popover-anchor[data-rozie-s-c6cf02ea] {
  display: inline-block;
}
.rozie-popover-floating[data-rozie-s-c6cf02ea] {
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
.rozie-popover-floating--static[data-rozie-s-c6cf02ea] {
  position: static;
  left: auto;
  top: auto;
  width: auto;
  z-index: auto;
}
.rozie-popover-floating--bare[data-rozie-s-c6cf02ea] {
  background: none;
  border: none;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
}
.rozie-popover-floating--hidden[data-rozie-s-c6cf02ea] {
  display: none;
}
.rozie-popover-arrow[data-rozie-s-c6cf02ea] {
  position: absolute;
  width: var(--rozie-popover-arrow-size, 8px);
  height: var(--rozie-popover-arrow-size, 8px);
  background: var(--rozie-popover-bg, #fff);
  border: var(--rozie-popover-border, 1px solid rgba(0, 0, 0, 0.12));
  transform: rotate(45deg);
}
`;

  /**
   * Whether the floating content is open. The sole `model: true` prop — two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`) and Popover writes the new state back whenever the trigger or a dismissal toggles it. Left unbound it falls back to an uncontrolled default.
   */
  @property({ type: Boolean, attribute: 'open' }) _open_attr: boolean = false;
  private _openControllable = createLitControllableProperty<boolean>({ host: this, eventName: 'open-change', defaultValue: false, initialControlledValue: undefined });
  /**
   * Floating UI placement of the content relative to the anchor — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end` (e.g. `bottom-start`). With `disableFlip` off, the content may flip to the opposite side when it would overflow the viewport. Reconciled at runtime.
   */
  @property({ type: String, reflect: true }) placement: string = 'bottom';
  /**
   * How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur, or `'manual'` for a composing component that drives `open` itself — every built-in gesture handler no-ops and the anchor omits `aria-haspopup`/`aria-expanded` (only a real gesture trigger claims the popup). Drives both the gesture handlers and the ARIA role (`'hover'`/`'focus'` → tooltip, `'click'` → popover dialog, `'manual'` → no anchor ARIA claim).
   */
  @property({ type: String, reflect: true }) trigger: string = 'click';
  /**
   * Distance in pixels between the anchor and the floating content (the Floating UI `offset` middleware). Reconciled at runtime.
   */
  @property({ type: Number, reflect: true }) offset: number = 8;
  /**
   * Disable the Floating UI `flip` middleware. By default the content flips to the opposite side of the anchor when it would overflow the viewport; set this to keep it pinned to `placement` regardless.
   */
  @property({ type: Boolean, reflect: true }) disableFlip: boolean = false;
  /**
   * Disable the Floating UI `shift` middleware. By default the content shifts along its axis to stay within the viewport; set this to keep it strictly aligned to the anchor.
   */
  @property({ type: Boolean, reflect: true }) disableShift: boolean = false;
  /**
   * Opt in to a positioned arrow element. When set, Popover renders an arrow `<div>` and runs the Floating UI `arrow` middleware against it so it points at the anchor. Style it via the `--rozie-popover-*` arrow CSS custom properties.
   */
  @property({ type: Boolean, reflect: true }) arrow: boolean = false;
  /**
   * Disable the control entirely: the trigger no longer opens the content and any open content is suppressed.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Opt in to modal dialog semantics for a `click` popover. **Off by default:** a click popover is a non-modal, click-outside-dismissable layer, so its panel is rendered role-neutral (the slot content owns its own ARIA role — e.g. a `role="menu"`) and carries NO `aria-modal`. Set `modal` for a genuinely modal dialog popover: the panel then gets `role="dialog"` + `aria-modal="true"`. **Note:** Popover ships no focus trap (it stays a minimal headless primitive); if you set `modal`, provide your own focus containment so the `aria-modal` claim holds. Ignored for `hover`/`focus` triggers (always tooltip-flavored).
   */
  @property({ type: Boolean, reflect: true }) modal: boolean = false;
  /**
   * Floating UI positioning strategy — 'absolute' (default) or 'fixed'. Use 'fixed' to escape a scrollable/overflow-clipping ancestor (e.g. a sticky table header). Reconciled at runtime.
   */
  @property({ type: String, reflect: true }) strategy: string = 'absolute';
  /**
   * Suppress the floating panel's own chrome (background, border, border-radius, box-shadow, padding) so a composing component can supply its own instead. Off by default — the panel keeps its standard `--rozie-popover-*` chrome tokens.
   */
  @property({ type: Boolean, reflect: true }) bare: boolean = false;
  /**
   * Render the floating panel in normal document flow instead of computing a floating position — no `computePosition` call and no `autoUpdate` tracking is ever started. For a composing component that already controls the panel's layout (e.g. an `inline` consumer) rather than a genuinely floating popover.
   */
  @property({ type: Boolean, reflect: true }) disablePositioning: boolean = false;
  /**
   * Render the floating panel hidden instead of unmounting it while closed, so a composing component whose panel content owns scroll state (e.g. a virtualizer) keeps its DOM across a close/open cycle. A one-shot position computation runs once at mount so the hidden panel already carries correct coordinates before the first open.
   */
  @property({ type: Boolean, reflect: true }) keepMounted: boolean = false;
  @query('[data-rozie-ref="anchorEl"]') private _refAnchorEl!: HTMLElement;
  @query('[data-rozie-ref="floatingEl"]') private _refFloatingEl!: HTMLElement;
  @query('[data-rozie-ref="arrowEl"]') private _refArrowEl!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieFirstUpdateDone = false;

  @state() private _hasSlotAnchor = false;
  @queryAssignedElements({ slot: 'anchor', flatten: true }) private _slotAnchorElements!: Element[];
  @property({ attribute: false }) anchor?: (scope: { open: any; toggle: any; show: any; hide: any }) => unknown;
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  // Phase 79 Plan 08 (R4) contract for 79-09: the record intake for
  // record-routed slot fills. 79-09's consumer-side emitSlotFiller
  // accumulates an object literal onto the SAME `.rozieSlots=${{ ... }}`
  // open-tag binding; the KEY is the fill's authored (possibly
  // non-identifier) name and the VALUE is a scope-taking render
  // function. `rozieSlots?.[name]` must be checked BEFORE the legacy
  // named function-prop / <slot> fallback (AC-9). Attribute
  // deserialization is disabled — this is a function-valued record,
  // never reflected to/from an HTML attribute.
  @property({ attribute: false }) rozieSlots?: Record<string, (scope: any) => unknown>;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    const _lh0 = ($event: KeyboardEvent) => { if (!(this.open)) return; if ($event.key !== 'Escape') return; ((this.dismiss) as (...args: any[]) => any)($event); };
    document.addEventListener('keydown', _lh0, undefined);
    this._disconnectCleanups.push(() => document.removeEventListener('keydown', _lh0, undefined));

    const _u1 = attachOutsideClickListener([() => this._refAnchorEl, () => this._refFloatingEl], ($event) => {  ((this.dismiss) as (...args: any[]) => any)($event); }, () => (this.open));
    this._disconnectCleanups.push(_u1);

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="anchor"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotAnchor = this._slotAnchorElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot:not([name])');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDefault = this._slotDefaultElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotAnchor = Array.from(this.children).some((el) => el.getAttribute('slot') === 'anchor');
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push((() => {
      this.stopTracking();
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.open)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
      if (isOpen && !this.disabled) {
        queueMicrotask(() => {
          if (!this.open || this.disabled) return;
          this.floatingNode = this._refFloatingEl;
          this.arrowNode = this._refArrowEl;
          this.startTracking();
        });
      } else {
        this.stopTracking();
      }
    })(__watchVal); }); }));

    // $refs read ONLY here (ROZ123). The floating + arrow elements live behind r-if
    // and may be null until open (or keepMounted); startTracking re-reads via the
    // watch path.
    this.anchorNode = this._refAnchorEl;
    if (this.open && !this.disabled) {
      // floatingNode is populated by its r-if having rendered; read it lazily inside
      // the watch/handlers too. Position on next tick when it exists.
      this.floatingNode = this._refFloatingEl;
      this.arrowNode = this._refArrowEl;
      this.startTracking();
    } else if (this.keepMounted && !this.disabled) {
      // keepMounted (D-03): the panel is mounted-but-hidden. Read the refs and run
      // a ONE-SHOT position() — never startTracking()/autoUpdate, which stays
      // strictly open-gated (D-11) — so the hidden panel already carries real
      // coordinates before the first open instead of painting at 0,0. position()
      // itself no-ops when disablePositioning is set.
      this.floatingNode = this._refFloatingEl;
      this.arrowNode = this._refArrowEl;
      this.position();
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('placement'))) { const __watchVal = (() => this.placement)(); (() => {
      if (this.open) this.position();
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('offset'))) { const __watchVal = (() => this.offset)(); (() => {
      if (this.open) this.position();
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('disableFlip'))) { const __watchVal = (() => this.disableFlip)(); (() => {
      if (this.open) this.position();
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('disableShift'))) { const __watchVal = (() => this.disableShift)(); (() => {
      if (this.open) this.position();
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('strategy'))) { const __watchVal = (() => this.strategy)(); (() => {
      if (this.open) this.position();
    })(); }
    this.__rozieFirstUpdateDone = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'open') this._openControllable.notifyAttributeChange(value !== null);
  }

  render() {
    return html`
<div class="rozie-popover" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-c6cf02ea>

  
  <div class="rozie-popover-anchor" aria-haspopup=${rozieAttr(this.hasGestureTrigger() ? 'dialog' : null)} aria-expanded=${rozieAttr(this.hasGestureTrigger() ? !!this.open : null)} aria-describedby=${rozieAttr(this.isTooltip() && this.open ? 'rozie-popover-floating' : null)} @click=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.trigger === 'click' && this.onAnchorClick(); }} @pointerenter=${($event: Event & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.trigger === 'hover' && this.onAnchorPointerEnter(); }} @pointerleave=${($event: Event & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.trigger === 'hover' && this.onAnchorPointerLeave(); }} @focusin=${($event: Event & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.trigger === 'focus' && this.onAnchorFocus(); }} @focusout=${($event: Event & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.trigger === 'focus' && this.onAnchorBlur(); }} data-rozie-ref="anchorEl" data-rozie-s-c6cf02ea>
    ${this.anchor !== undefined ? this.anchor({open: this.open, toggle: this.toggle, show: this.show, hide: this.hide}) : html`<slot name="anchor" data-rozie-params=${(() => { try { return JSON.stringify({open: this.open}); } catch { return '{}'; } })()} @rozie-anchor-toggle=${($event: CustomEvent) => ((this.toggle) as (...args: any[]) => any)($event.detail)} @rozie-anchor-show=${($event: CustomEvent) => ((this.show) as (...args: any[]) => any)($event.detail)} @rozie-anchor-hide=${($event: CustomEvent) => ((this.hide) as (...args: any[]) => any)($event.detail)}></slot>`}
  </div>

  
  ${(this.open || this.keepMounted) && !this.disabled ? html`<div class="${Object.entries({ "rozie-popover-floating": true, 'rozie-popover-floating--static': this.disablePositioning, 'rozie-popover-floating--bare': this.bare, 'rozie-popover-floating--hidden': !this.open }).filter(([, v]) => v).map(([k]) => k).join(' ')}" id="rozie-popover-floating" role=${rozieAttr(this.floatingRole())} aria-modal=${!!(this.floatingRole() === 'dialog')} data-rozie-ref="floatingEl" data-rozie-s-c6cf02ea>
    ${this.arrow ? html`<div class="rozie-popover-arrow" data-rozie-ref="arrowEl" data-rozie-s-c6cf02ea></div>` : nothing}<slot></slot>
  </div>` : nothing}</div>
`;
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
  if (this.open === next) return;
  if (next && this.trigger === 'click') {
    this.lastFocusedEl = this.deepActiveElement();
  }
  this._openControllable.write(next);
  this.dispatchEvent(new CustomEvent("change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  if (!next && this.trigger === 'click' && this.lastFocusedEl && this.lastFocusedEl.isConnected && typeof this.lastFocusedEl.focus === 'function') {
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
  if (this.disablePositioning) return;
  if (!this.anchorNode || !this.floatingNode) return;
  const middleware = buildMiddleware({
    offset: offsetMiddleware,
    flip,
    shift,
    arrow: arrowMiddleware
  }, {
    offset: this.offset,
    disableFlip: this.disableFlip,
    disableShift: this.disableShift,
    arrow: this.arrow,
    arrowEl: this.arrowNode
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
  if (this.strategy === 'fixed') {
    this.floatingNode.style.position = 'fixed';
  } else {
    this.floatingNode.style.position = '';
  }
  let opts: any = null;
  opts = {
    placement: this.placement,
    strategy: this.strategy,
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
  if (this.disablePositioning) return;
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
  if (this.disabled) return;
  this.requestOpen(!this.open);
};

  onAnchorPointerEnter = () => {
  if (this.disabled) return;
  this.requestOpen(true);
};

  onAnchorPointerLeave = () => {
  if (this.disabled) return;
  this.requestOpen(false);
};

  onAnchorFocus = () => {
  if (this.disabled) return;
  this.requestOpen(true);
};

  onAnchorBlur = () => {
  if (this.disabled) return;
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
  hasGestureTrigger = () => this.trigger === 'click' || this.trigger === 'hover' || this.trigger === 'focus';

  // hover/focus triggers are tooltip-flavored; click is an interactive popover.
  isTooltip = () => this.trigger === 'hover' || this.trigger === 'focus';

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
  floatingRole = () => this.isTooltip() ? 'tooltip' : this.modal ? 'dialog' : undefined;

  // ─── imperative handle ($expose) ────────────────────────────────────────────────
  // Verbs: show/hide/toggle/reposition. NOT `update` (reserved Lit lifecycle) → the
  // reposition verb is `reposition`. None collide with the `change` emit, the `open`
  // model, or its React `setOpen` setter, nor with inherited HTMLElement members.
  show() {
    if (!this.disabled) this.requestOpen(true);
  }

  hide() {
    this.requestOpen(false);
  }

  toggle() {
    if (!this.disabled) this.requestOpen(!this.open);
  }

  reposition() {
    this.position();
  }

  get open(): boolean { return this._openControllable.read(); }
  set open(v: boolean) { this._openControllable.notifyPropertyWrite(v); }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   *
   * command-palette-per-level-virtual / portal-through-portal cluster —
   * `data-rozie-ref` is ALWAYS skipped too (a reserved compiler bookkeeping
   * attribute, never a consumer prop) so a parent-assigned `ref=` on this
   * component's own host tag can never clobber this component's OWN
   * internal `data-rozie-ref` ref markers via fallthrough re-application.
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['data-rozie-ref', 'open', 'placement', 'trigger', 'offset', 'disable-flip', 'disableflip', 'disable-shift', 'disableshift', 'arrow', 'disabled', 'modal', 'strategy', 'bare', 'disable-positioning', 'disablepositioning', 'keep-mounted', 'keepmounted']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}
