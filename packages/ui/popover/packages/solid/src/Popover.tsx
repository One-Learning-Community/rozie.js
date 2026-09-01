import type { JSX } from 'solid-js';
import { Show, children, createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, createOutsideClick, rozieAttr, rozieClass } from '@rozie/runtime-solid';
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

__rozieInjectStyle('Popover-c6cf02ea', `.rozie-popover[data-rozie-s-c6cf02ea] {
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
}`);

interface AnchorSlotCtx { open: any; toggle: any; show: any; hide: any; }

interface PopoverProps {
  /**
   * Whether the floating content is open. The sole `model: true` prop — two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`) and Popover writes the new state back whenever the trigger or a dismissal toggles it. Left unbound it falls back to an uncontrolled default.
   */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Floating UI placement of the content relative to the anchor — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end` (e.g. `bottom-start`). With `disableFlip` off, the content may flip to the opposite side when it would overflow the viewport. Reconciled at runtime.
   */
  placement?: string;
  /**
   * How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur, or `'manual'` for a composing component that drives `open` itself — every built-in gesture handler no-ops and the anchor omits `aria-haspopup`/`aria-expanded` (only a real gesture trigger claims the popup). Drives both the gesture handlers and the ARIA role (`'hover'`/`'focus'` → tooltip, `'click'` → popover dialog, `'manual'` → no anchor ARIA claim).
   */
  trigger?: string;
  /**
   * Distance in pixels between the anchor and the floating content (the Floating UI `offset` middleware). Reconciled at runtime.
   */
  offset?: number;
  /**
   * Disable the Floating UI `flip` middleware. By default the content flips to the opposite side of the anchor when it would overflow the viewport; set this to keep it pinned to `placement` regardless.
   */
  disableFlip?: boolean;
  /**
   * Disable the Floating UI `shift` middleware. By default the content shifts along its axis to stay within the viewport; set this to keep it strictly aligned to the anchor.
   */
  disableShift?: boolean;
  /**
   * Opt in to a positioned arrow element. When set, Popover renders an arrow `<div>` and runs the Floating UI `arrow` middleware against it so it points at the anchor. Style it via the `--rozie-popover-*` arrow CSS custom properties.
   */
  arrow?: boolean;
  /**
   * Disable the control entirely: the trigger no longer opens the content and any open content is suppressed.
   */
  disabled?: boolean;
  /**
   * Opt in to modal dialog semantics for a `click` popover. **Off by default:** a click popover is a non-modal, click-outside-dismissable layer, so its panel is rendered role-neutral (the slot content owns its own ARIA role — e.g. a `role="menu"`) and carries NO `aria-modal`. Set `modal` for a genuinely modal dialog popover: the panel then gets `role="dialog"` + `aria-modal="true"`. **Note:** Popover ships no focus trap (it stays a minimal headless primitive); if you set `modal`, provide your own focus containment so the `aria-modal` claim holds. Ignored for `hover`/`focus` triggers (always tooltip-flavored).
   */
  modal?: boolean;
  /**
   * Floating UI positioning strategy — 'absolute' (default) or 'fixed'. Use 'fixed' to escape a scrollable/overflow-clipping ancestor (e.g. a sticky table header). Reconciled at runtime.
   */
  strategy?: string;
  /**
   * Suppress the floating panel's own chrome (background, border, border-radius, box-shadow, padding) so a composing component can supply its own instead. Off by default — the panel keeps its standard `--rozie-popover-*` chrome tokens.
   */
  bare?: boolean;
  /**
   * Render the floating panel in normal document flow instead of computing a floating position — no `computePosition` call and no `autoUpdate` tracking is ever started. For a composing component that already controls the panel's layout (e.g. an `inline` consumer) rather than a genuinely floating popover.
   */
  disablePositioning?: boolean;
  /**
   * Render the floating panel hidden instead of unmounting it while closed, so a composing component whose panel content owns scroll state (e.g. a virtualizer) keeps its DOM across a close/open cycle. A one-shot position computation runs once at mount so the hidden panel already carries correct coordinates before the first open.
   */
  keepMounted?: boolean;
  /**
   * Match the floating panel's width exactly to the anchor's width, via the Floating UI `size` middleware. Writes the panel's `width` style only — never touches height.
   */
  matchWidth?: boolean;
  /**
   * Suppress Popover's own Escape-key and click-outside dismissal listeners while `true`. For a composing component that drives `open` itself and needs to temporarily veto Popover's independent dismissal — e.g. while a host sub-surface anchored to (but not nested inside) the composed control legitimately holds focus. Off by default; existing `trigger="manual"` consumers relying on real click-outside dismissal are unaffected unless they opt in.
   */
  disableDismiss?: boolean;
  onChange?: (...args: unknown[]) => void;
  anchorSlot?: (ctx: AnchorSlotCtx) => JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: PopoverHandle) => void;
}

export interface PopoverHandle {
  show: (...args: any[]) => any;
  hide: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
  reposition: (...args: any[]) => any;
}

export default function Popover(_props: PopoverProps): JSX.Element {
  const _merged = mergeProps({ placement: 'bottom', trigger: 'click', offset: 8, disableFlip: false, disableShift: false, arrow: false, disabled: false, modal: false, strategy: 'absolute', bare: false, disablePositioning: false, keepMounted: false, matchWidth: false, disableDismiss: false }, _props);
  const [local, attrs] = splitProps(_merged, ['open', 'placement', 'trigger', 'offset', 'disableFlip', 'disableShift', 'arrow', 'disabled', 'modal', 'strategy', 'bare', 'disablePositioning', 'keepMounted', 'matchWidth', 'disableDismiss', 'children', 'ref', 'onChange']);
  const resolved = children(() => local.children);
  onMount(() => { local.ref?.({ show, hide, toggle, reposition }); });

  const [open, setOpen] = createControllableSignal<boolean>(_props as unknown as Record<string, unknown>, 'open', false);
  onMount(() => {
    const _cleanup = (() => {
    // $refs read ONLY here (ROZ123). The floating + arrow elements live behind r-if
    // and may be null until open (or keepMounted); startTracking re-reads via the
    // watch path.
    anchorNode = anchorElRef;
    if (open() && !local.disabled) {
      // floatingNode is populated by its r-if having rendered; read it lazily inside
      // the watch/handlers too. Position on next tick when it exists.
      floatingNode = floatingElRef;
      arrowNode = arrowElRef;
      startTracking();
    } else if (local.keepMounted && !local.disabled) {
      // keepMounted (D-03): the panel is mounted-but-hidden. Read the refs and run
      // a ONE-SHOT position() — never startTracking()/autoUpdate, which stays
      // strictly open-gated (D-11) — so the hidden panel already carries real
      // coordinates before the first open instead of painting at 0,0. position()
      // itself no-ops when disablePositioning is set.
      floatingNode = floatingElRef;
      arrowNode = arrowElRef;
      position();
    }
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    stopTracking();
  });
  });
  createEffect(on(() => (() => open())(), (v) => untrack(() => ((isOpen: any) => {
    if (isOpen && !local.disabled) {
      queueMicrotask(() => {
        if (!open() || local.disabled) return;
        floatingNode = floatingElRef;
        arrowNode = arrowElRef;
        startTracking();
      });
    } else {
      stopTracking();
    }
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.placement)(), (v) => untrack(() => (() => {
    if (open()) position();
  })()), { defer: true }));
  createEffect(on(() => (() => local.offset)(), (v) => untrack(() => (() => {
    if (open()) position();
  })()), { defer: true }));
  createEffect(on(() => (() => local.disableFlip)(), (v) => untrack(() => (() => {
    if (open()) position();
  })()), { defer: true }));
  createEffect(on(() => (() => local.disableShift)(), (v) => untrack(() => (() => {
    if (open()) position();
  })()), { defer: true }));
  createEffect(on(() => (() => local.strategy)(), (v) => untrack(() => (() => {
    if (open()) position();
  })()), { defer: true }));
  let anchorElRef: HTMLElement | null = null;
  let floatingElRef: HTMLElement | null = null;
  let arrowElRef: HTMLElement | null = null;

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
  let anchorNode: any = null;
  let floatingNode: any = null;
  let arrowNode: any = null;
  let stopAutoUpdate: any = null;
  let lastFocusedEl: any = null;

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
  function deepActiveElement() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    return el;
  }

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
  function requestOpen(next: any) {
    if (open() === next) return;
    if (next && local.trigger === 'click') {
      lastFocusedEl = deepActiveElement();
    }
    setOpen(next);
    _props.onChange?.(next);
    if (!next && local.trigger === 'click' && lastFocusedEl && lastFocusedEl.isConnected && typeof lastFocusedEl.focus === 'function') {
      lastFocusedEl.focus();
    }
    if (!next) {
      lastFocusedEl = null;
    }
  }

  // Apply the resolved x/y (and arrow offset, when present) onto the floating element.
  function applyPosition(x: any, y: any, middlewareData: any) {
    if (!floatingNode) return;
    floatingNode.style.left = x + 'px';
    floatingNode.style.top = y + 'px';
    if (arrowNode && middlewareData && middlewareData.arrow) {
      const ax = middlewareData.arrow.x;
      const ay = middlewareData.arrow.y;
      arrowNode.style.left = ax == null ? '' : ax + 'px';
      arrowNode.style.top = ay == null ? '' : ay + 'px';
    }
  }

  // Recompute the position once. Pure engine call; safe to invoke whenever both
  // elements exist and the content is open. `opts` is a null-let (→ `any`) so the
  // loosely-typed `<props>` placement (string) + the `unknown[]` middleware array don't
  // fail the strict leaf tsc against Floating UI's `Placement` / `Middleware[]` types
  // (the cropper `let cfg = null` constructor-args idiom).
  function position() {
    if (local.disablePositioning) return;
    if (!anchorNode || !floatingNode) return;
    const middleware = buildMiddleware({
      offset: offsetMiddleware,
      flip,
      shift,
      arrow: arrowMiddleware,
      size
    }, {
      offset: local.offset,
      disableFlip: local.disableFlip,
      disableShift: local.disableShift,
      arrow: local.arrow,
      arrowEl: arrowNode,
      matchWidth: !!local.matchWidth
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
    if (local.strategy === 'fixed') {
      floatingNode.style.position = 'fixed';
    } else {
      floatingNode.style.position = '';
    }
    let opts: any = null;
    opts = {
      placement: local.placement,
      strategy: local.strategy,
      middleware
    };
    computePosition(anchorNode, floatingNode, opts).then((result: any) => {
      applyPosition(result.x, result.y, result.middlewareData);
    });
  }

  // Start autoUpdate (idempotent — stop any prior subscription first) and do an
  // initial position. Floating UI's autoUpdate keeps the position fresh on scroll/
  // resize/ancestor-layout changes and returns its own teardown.
  function startTracking() {
    if (local.disablePositioning) return;
    if (!anchorNode || !floatingNode) return;
    if (stopAutoUpdate) {
      stopAutoUpdate();
      stopAutoUpdate = null;
    }
    stopAutoUpdate = autoUpdate(anchorNode, floatingNode, position);
  }
  function stopTracking() {
    if (stopAutoUpdate) {
      stopAutoUpdate();
      stopAutoUpdate = null;
    }
  }
  // ─── trigger gesture handlers (wired conditionally on the anchor by `trigger`) ──
  function onAnchorClick() {
    if (local.disabled) return;
    requestOpen(!open());
  }
  function onAnchorPointerEnter() {
    if (local.disabled) return;
    requestOpen(true);
  }
  function onAnchorPointerLeave() {
    if (local.disabled) return;
    requestOpen(false);
  }
  function onAnchorFocus() {
    if (local.disabled) return;
    requestOpen(true);
  }
  function onAnchorBlur() {
    if (local.disabled) return;
    requestOpen(false);
  }

  // Dismissal handler — method reference for the <listeners> block (an inline
  // handler referencing $event leaks into React's useEffect deps → TS2552; every
  // corpus <listener> uses a method-ref + modifiers).
  function dismiss() {
    requestOpen(false);
  }

  // ─── role helpers (plain functions; tooltip vs popover-dialog by trigger) ───────
  // hasGestureTrigger() (D-02): whether `trigger` is one of the three REAL anchor
  // gestures. `'manual'` (and any other unrecognized value) returns false, which
  // gates the anchor's `aria-haspopup`/`aria-expanded` off entirely — a composing
  // component driving `open` itself must not have its wrapper claim a popup it
  // does not own (D-01).
  function hasGestureTrigger() {
    return local.trigger === 'click' || local.trigger === 'hover' || local.trigger === 'focus';
  }
  // hover/focus triggers are tooltip-flavored; click is an interactive popover.
  function isTooltip() {
    return local.trigger === 'hover' || local.trigger === 'focus';
  }
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
  function floatingRole() {
    return isTooltip() ? 'tooltip' : local.modal ? 'dialog' : undefined;
  }

  // ─── imperative handle ($expose) ────────────────────────────────────────────────
  // Verbs: show/hide/toggle/reposition. NOT `update` (reserved Lit lifecycle) → the
  // reposition verb is `reposition`. None collide with the `change` emit, the `open`
  // model, or its React `setOpen` setter, nor with inherited HTMLElement members.
  function show() {
    if (!local.disabled) requestOpen(true);
  }
  function hide() {
    requestOpen(false);
  }
  function toggle() {
    if (!local.disabled) requestOpen(!open());
  }
  function reposition() {
    position();
  }

  createEffect(() => {
    if (!(open() && !local.disableDismiss)) return;
    const _rozieHandler = ($event: KeyboardEvent) => {
      if ($event.key !== 'Escape') return;
      dismiss();
    };
    document.addEventListener('keydown', _rozieHandler);
    onCleanup(() => document.removeEventListener('keydown', _rozieHandler));
  });

  createOutsideClick(
    [() => anchorElRef, () => floatingElRef],
    dismiss,
    () => open() && !local.disableDismiss,
  );

  return (
    <>
    <div {...attrs} class={"rozie-popover" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-c6cf02ea="">

      
      <div aria-haspopup={rozieAttr(hasGestureTrigger() ? 'dialog' : null)} aria-expanded={(hasGestureTrigger() ? !!open() : null) ?? undefined} aria-describedby={rozieAttr(isTooltip() && open() ? 'rozie-popover-floating' : null)} class={"rozie-popover-anchor"} ref={(el) => { anchorElRef = el as HTMLElement; }} onClick={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { local.trigger === 'click' && onAnchorClick(); }} onPointerEnter={($event: PointerEvent & { currentTarget: HTMLDivElement; target: Element }) => { local.trigger === 'hover' && onAnchorPointerEnter(); }} onPointerLeave={($event: PointerEvent & { currentTarget: HTMLDivElement; target: Element }) => { local.trigger === 'hover' && onAnchorPointerLeave(); }} onFocusIn={($event: FocusEvent & { currentTarget: HTMLDivElement; target: Element }) => { local.trigger === 'focus' && onAnchorFocus(); }} onFocusOut={($event: FocusEvent & { currentTarget: HTMLDivElement; target: Element }) => { local.trigger === 'focus' && onAnchorBlur(); }} data-rozie-s-c6cf02ea="">
        {(_props.anchorSlot ?? _props.slots?.['anchor'])?.({ open: open(), toggle, show, hide })}
      </div>

      
      {<Show when={(open() || local.keepMounted) && !local.disabled}><div class={"rozie-popover-floating" + " " + rozieClass({ 'rozie-popover-floating--static': local.disablePositioning, 'rozie-popover-floating--bare': local.bare, 'rozie-popover-floating--hidden': !open() })} ref={(el) => { floatingElRef = el as HTMLElement; }} id="rozie-popover-floating" role={rozieAttr(floatingRole())} aria-modal={!!(floatingRole() === 'dialog')} data-rozie-s-c6cf02ea="">
        {<Show when={local.arrow}><div class={"rozie-popover-arrow"} ref={(el) => { arrowElRef = el as HTMLElement; }} data-rozie-s-c6cf02ea="" /></Show>}{resolved()}
      </div></Show>}</div>
    </>
  );
}
