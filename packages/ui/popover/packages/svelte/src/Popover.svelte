<script module lang="ts">
/** An `aria-haspopup` token: what kind of popup a click popover's panel is (the `popupRole` prop). */
export type PopoverPopupRole = 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid';
</script>
<script lang="ts">
import { applyListeners, rozieAttr } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onMount, untrack } from 'svelte';

interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['div'], 'open' | 'placement' | 'trigger' | 'offset' | 'disableFlip' | 'disableShift' | 'arrow' | 'disabled' | 'modal' | 'strategy' | 'bare' | 'disablePositioning' | 'keepMounted' | 'matchWidth' | 'disableDismiss' | 'popupRole' | 'idBase' | 'reference' | 'anchor' | 'children' | 'snippets' | 'onchange'> {
  /**
   * Whether the floating content is open. The sole `model: true` prop, and its change event is the only change signal Popover fires. Bind it two-way — Vue `v-model:open`, React/Solid `open` + `onOpenChange`, Svelte `bind:open`, Angular `[(open)]`, Lit the `open` property + the `open-change` event — and Popover writes the new state back whenever the trigger, a dismissal or the handle toggles it. Left unbound it falls back to an uncontrolled default.
   */
  open?: boolean;
  /**
   * Floating UI placement of the content relative to the anchor — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end` (e.g. `bottom-start`). With `disableFlip` off, the content may flip to the opposite side when it would overflow the viewport. Reconciled at runtime.
   */
  placement?: string;
  /**
   * How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur, or `'manual'` for a composing component that drives `open` itself — every built-in gesture handler no-ops. Drives both the gesture handlers and the ARIA: `'click'` sets `aria-haspopup`/`aria-expanded`/`aria-controls` on the anchor wrapper; `'hover'`/`'focus'` are tooltips (`role="tooltip"` panel, `aria-describedby` on the wrapper, no popup claim); `'manual'` makes no anchor ARIA claim. The wrapper is not focusable, so put the matching attributes on your own focusable trigger too — the `anchor` slot passes `open`, `panelId` and `popupRole` for exactly that. The `aria-haspopup` value is the `popupRole` prop (default `'dialog'`).
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
  /**
   * The kind of popup the panel content is, announced as `aria-haspopup` on the anchor wrapper of a `click` popover: `'dialog'` (the default), `'menu'`, `'listbox'`, `'tree'` or `'grid'`; any other value is treated as `'dialog'`. Set `'menu'` when the panel hosts a menu (your content carries `role="menu"`), so a menu button keeps the click trigger and its focus return. The `anchor` slot passes the same value as `popupRole` (with `open` and `panelId`) so you can put `aria-haspopup` / `aria-expanded` / `aria-controls` on your own focusable trigger. It is `null` for the tooltip triggers (`'hover'` / `'focus'`), which claim no popup; for `'manual'` it is the prop value, for the trigger you own.
   */
  popupRole?: string;
  /**
   * Id base for the floating panel, whose id is `idBase + '-panel'` — also exposed to the `anchor` slot as `panelId`, so your trigger can set `aria-controls` (click) or `aria-describedby` (tooltip) to it. Leave it empty (the default) and each instance generates a unique id base after mount (`rozie-popover-<n>`), so several popovers on one page never share a panel id; set it when you need a stable, predictable id. On Lit the panel lives in the element's shadow root, so an id reference from light DOM, including your slotted anchor content, cannot resolve to it; there the anchor wrapper's own attributes, which sit inside the shadow root, carry the reference. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase?: string;
  /**
   * Position the content against an external reference instead of the built-in anchor wrapper: either a DOM Element another component owns (e.g. a calendar event element) or a Floating UI virtual element — an object with a `getBoundingClientRect()` method and an optional `contextElement` — e.g. to open at a pointer position. The reference is measured and tracked with Floating UI's `autoUpdate` and reconciled at runtime; `null` (the default) keeps the built-in anchor. A click on a referenced Element does not count as an outside click (so a consumer toggle on it closes the panel); with a virtual element only the anchor wrapper and the panel count as inside. You own the trigger ARIA on your own element (`aria-haspopup` / `aria-expanded`, plus `aria-controls` pointing at `idBase + '-panel'`), typically with `trigger='manual'` and a two-way-bound `open`. If a referenced Element is removed from the document while open, the popover closes. Pass a stable value — a new object on every render restarts tracking.
   */
  reference?: (Element | any) | null;
  anchor?: Snippet<[{ open: boolean; toggle: () => void; show: () => void; hide: () => void; panelId: string; popupRole: PopoverPopupRole | null }]>;
  children?: Snippet;
  snippets?: Record<string, any>;
  /**
   * @deprecated Removed in 0.3.0 — use the `open` model change event (React/Solid `onOpenChange`, Svelte `bind:open`).
   */
  onchange?: never;
}

let {
  open = $bindable(false),
  placement = 'bottom',
  trigger = 'click',
  offset = 8,
  disableFlip = false,
  disableShift = false,
  arrow = false,
  disabled = false,
  modal = false,
  strategy = 'absolute',
  bare = false,
  disablePositioning = false,
  keepMounted = false,
  matchWidth = false,
  disableDismiss = false,
  popupRole = 'dialog',
  idBase = '',
  reference = null,
  anchor: __anchorProp,
  children: __childrenProp,
  snippets,
  ...__rozieAttrs
}: Props = $props();

const anchor = $derived(__anchorProp ?? snippets?.anchor);
const children = $derived(__childrenProp ?? snippets?.children);

let autoId = $state('');

let anchorEl = $state<HTMLElement | undefined>(undefined);
let floatingEl = $state<HTMLElement | undefined>(undefined);
let arrowEl = $state<HTMLElement | undefined>(undefined);

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
//   lastFocusedEl (phase 72-06b; widened by release-0.8.0 audit B5) holds whatever
//   had DOM focus at the moment a non-tooltip popover opened — through its trigger,
//   the handle, or a controlled `open` write (natively the clicked trigger element
//   itself, since a mousedown focuses a native `<button>` before its `click` fires)
//   — restored on close only when focus would otherwise be lost (see restoreFocus).
//   Same null-let convention as the others: read/written only in handlers, `any`
//   via typeNeutralize.
let anchorNode: any = null;
let floatingNode: any = null;
let arrowNode: any = null;
let stopAutoUpdate: any = null;
let lastFocusedEl: any = null;
// The current `reference`, mirrored into a top-level let (release-0.8.0 audit
// A2). The deferred outside-click check below runs after the click's handlers
// and re-renders; a let is read live on every target (on React it is a ref),
// where a `$props` read inside that callback could be a stale render closure.
let liveReference: any = null;
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
const deepActiveElement = () => {
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
const captureReturnFocus = () => {
  if (isTooltip() || lastFocusedEl) return;
  lastFocusedEl = deepActiveElement();
};
// Composed containment: also walks slot assignment and shadow hosts. On Lit
// the panel's own content is SLOTTED (a light-DOM child of the popover host,
// projected into the panel's <slot>), which plain `contains()` never sees.
const composedContains = (container: any, node: any) => {
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
const restoreFocus = () => {
  let el: any = null;
  el = lastFocusedEl;
  lastFocusedEl = null;
  if (isTooltip() || !el || !el.isConnected || typeof el.focus !== 'function') return;
  let active: any = null;
  active = deepActiveElement();
  const insidePanel = !!(floatingNode && active && composedContains(floatingNode, active));
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
    now = deepActiveElement();
    const stillLost = !now || now === document.body || now === document.documentElement;
    if (stillLost && el.isConnected) el.focus();
  }, 0);
};
// Drive the two-way model in one place. Named `requestOpen` (NOT `setOpen`)
// to dodge the React generated `setOpen` setter for the `open` model (ROZ524).
const requestOpen = (next: any) => {
  if (open === next) return;
  if (next) captureReturnFocus();
  open = next;
  // Restore while the panel is still mounted, so focus inside it is recognized.
  if (!next) restoreFocus();
};
// Apply the resolved x/y (and arrow offset, when present) onto the floating element.
const applyPosition = (x: any, y: any, middlewareData: any) => {
  if (!floatingNode) return;
  floatingNode.style.left = x + 'px';
  floatingNode.style.top = y + 'px';
  if (arrowNode && middlewareData && middlewareData.arrow) {
    const ax = middlewareData.arrow.x;
    const ay = middlewareData.arrow.y;
    arrowNode.style.left = ax == null ? '' : ax + 'px';
    arrowNode.style.top = ay == null ? '' : ay + 'px';
  }
};
// Recompute the position once. Pure engine call; safe to invoke whenever both
// elements exist and the content is open. `opts` is a null-let (→ `any`) so the
// loosely-typed `<props>` placement (string) + the `unknown[]` middleware array don't
// fail the strict leaf tsc against Floating UI's `Placement` / `Middleware[]` types
// (the cropper `let cfg = null` constructor-args idiom).
const position = () => {
  if (disablePositioning) return;
  // The Floating UI reference: the `reference` prop (external Element or virtual
  // element) when set, else the built-in anchor wrapper (260929-lyc DD-3). A
  // function-local null-let so typeNeutralize makes it `any` in every leaf — the
  // union prop type never trips strict leaf tsc against `ReferenceElement`.
  let referenceEl: any = null;
  referenceEl = reference || anchorNode;
  if (!referenceEl || !floatingNode) return;
  // A referenced Element removed from the document measures as a zero rect at
  // the viewport origin (release-0.8.0 audit B2), e.g. a calendar event element
  // FullCalendar re-rendered. There is nothing left to point at, so close.
  if (referenceEl.nodeType === 1 && !referenceEl.isConnected) {
    if (open) requestOpen(false);
    return;
  }
  const middleware = buildMiddleware({
    offset: offsetMiddleware,
    flip,
    shift,
    arrow: arrowMiddleware,
    size
  }, {
    offset: offset,
    disableFlip: disableFlip,
    disableShift: disableShift,
    arrow: arrow,
    arrowEl: arrowNode,
    matchWidth: !!matchWidth
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
  if (strategy === 'fixed') {
    floatingNode.style.position = 'fixed';
  } else {
    floatingNode.style.position = '';
  }
  let opts: any = null;
  opts = {
    placement: placement,
    strategy: strategy,
    middleware
  };
  computePosition(referenceEl, floatingNode, opts).then((result: any) => {
    applyPosition(result.x, result.y, result.middlewareData);
  });
};
// Start autoUpdate (idempotent — stop any prior subscription first) and do an
// initial position. Floating UI's autoUpdate keeps the position fresh on scroll/
// resize/ancestor-layout changes and returns its own teardown.
const startTracking = () => {
  if (disablePositioning) return;
  // Same reference resolution as position() (DD-3). autoUpdate accepts a virtual
  // element: it unwraps it to its optional `contextElement` for ancestor/resize
  // observation (skipped when absent) and still runs the initial update.
  let referenceEl: any = null;
  referenceEl = reference || anchorNode;
  if (!referenceEl || !floatingNode) return;
  if (stopAutoUpdate) {
    stopAutoUpdate();
    stopAutoUpdate = null;
  }
  stopAutoUpdate = autoUpdate(referenceEl, floatingNode, position);
};
const stopTracking = () => {
  if (stopAutoUpdate) {
    stopAutoUpdate();
    stopAutoUpdate = null;
  }
};
// nextAutoId(): a page-wide counter shared by every Rozie component instance. It
// lives on globalThis (read through Reflect, which type-checks in the plain-JS and
// the TS script alike) so separately bundled copies of a leaf never hand out the
// same id. The same four lines live in Combobox, Listbox and Popover.
const nextAutoId = () => {
  const n = (Number(Reflect.get(globalThis, '__rozieAutoId')) || 0) + 1;
  Reflect.set(globalThis, '__rozieAutoId', n);
  return n;
};
// ─── reconcile positioning props while open ─────────────────────────────────────
// Restart tracking rather than repositioning once (release-0.8.0 audit B3):
// autoUpdate holds the position callback it was started with, which on React is
// the render-time closure — a one-shot position() with the new props would be
// reverted by the next scroll/resize update through the old closure.
// startTracking() re-subscribes with the current callback and positions
// immediately. Closed or untracked (disablePositioning) → plain position().
const refresh = () => {
  if (!open) return;
  if (stopAutoUpdate) startTracking();else position();
};
// ─── trigger gesture handlers (wired conditionally on the anchor by `trigger`) ──
const onAnchorClick = () => {
  if (disabled) return;
  requestOpen(!open);
};
const onAnchorPointerEnter = () => {
  if (disabled) return;
  requestOpen(true);
};
const onAnchorPointerLeave = () => {
  if (disabled) return;
  requestOpen(false);
};
const onAnchorFocus = () => {
  if (disabled) return;
  requestOpen(true);
};
const onAnchorBlur = () => {
  if (disabled) return;
  requestOpen(false);
};
// Dismissal handlers — method references for the <listeners> block. A method-ref
// `<listener>` handler receives the DOM event on all 6 targets (260929-mn8 DD-8:
// callable handlers are invoked with the event; inline statements run with
// `$event` in scope), so dismissOutside can inspect the click.
//
// `dismiss` serves Escape and closes unconditionally: an Escape keydown whose
// target is a focused EXTERNAL trigger (the `reference` element) must still close,
// so Escape must NOT apply the inside check below.
const dismiss = () => {
  requestOpen(false);
};
// Click-outside (260929-lyc DD-5). The `.outside(anchorEl, floatingEl)` modifier
// already excludes the built-in anchor wrapper + the panel; an Element `reference`
// is ALSO inside, so a click on it is left to the consumer's own toggle (which then
// closes the panel instead of dismiss-then-reopen). `composedPath()` is checked
// first — it is load-bearing for shadow-DOM (Lit) consumers, where a document-level
// listener sees the click retargeted to the outermost host. A virtual element
// (no `nodeType`) adds no inside region.
const isInsideReference = (path: any, target: any) => {
  let referenceEl: any = null;
  referenceEl = liveReference;
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
const dismissOutside = (event: any) => {
  let path: any = null;
  path = event && typeof event.composedPath === 'function' ? event.composedPath() : null;
  let target: any = null;
  target = event ? event.target : null;
  if (isInsideReference(path, target)) return;
  setTimeout(() => {
    if (isInsideReference(path, target)) return;
    requestOpen(false);
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
const isTooltip = () => trigger === 'hover' || trigger === 'focus';
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
const floatingRole = () => isTooltip() ? 'tooltip' : modal ? 'dialog' : undefined;
// The `aria-haspopup` value for the consumer's own trigger, handed to the anchor
// slot as `popupRole`: none for a tooltip (it describes, it does not pop up).
// The popupRole prop narrowed to a valid `aria-haspopup` token (an unknown value
// falls back to 'dialog'). Comparing against literals also gives the strict
// React/Solid/Vue attribute types the ARIA token union they require.
const popupToken = () => {
  const r = popupRole;
  return r !== 'menu' && r !== 'listbox' && r !== 'tree' && r !== 'grid' ? 'dialog' : r;
};
const anchorPopupRole = () => isTooltip() ? null : popupToken();
// The anchor wrapper's own `aria-haspopup`: a click trigger only. `undefined`
// (not `null`) for the other triggers, for strict vue-tsc (see floatingRole).
const anchorHaspopup = () => trigger === 'click' ? popupToken() : undefined;
// The panel id (audit B1), also handed to the anchor slot as `panelId`.
// idRoot(): the `idBase` prop, else the per-instance id generated in $onMount,
// else the pre-mount fallback. Generated after mount (not during setup) so a
// server render and the hydrating client agree.
const idRoot = () => idBase || autoId || 'rozie-popover';
const panelId = () => idRoot() + '-panel';
export function show(): void;
// ─── imperative handle ($expose) ────────────────────────────────────────────────
// Verbs: show/hide/toggle/reposition. NOT `update` (reserved Lit lifecycle) → the
// reposition verb is `reposition`. None collide with the `open` model or its
// React `setOpen` setter, nor with inherited HTMLElement members.
export function show() {
  if (!disabled) requestOpen(true);
}
export function hide(): void;
export function hide() {
  requestOpen(false);
}
export function toggle(): void;
export function toggle() {
  if (!disabled) requestOpen(!open);
}
export function reposition(): void;
export function reposition() {
  position();
}

onMount(() => {
  if (!idBase) autoId = 'rozie-popover-' + nextAutoId();
  // $refs read ONLY here (ROZ123). The floating + arrow elements live behind r-if
  // and may be null until open (or keepMounted); startTracking re-reads via the
  // watch path.
  anchorNode = anchorEl;
  liveReference = reference;
  if (open && !disabled) {
    // floatingNode is populated by its r-if having rendered; read it lazily inside
    // the watch/handlers too. Position on next tick when it exists.
    floatingNode = floatingEl;
    arrowNode = arrowEl;
    startTracking();
  } else if (keepMounted && !disabled) {
    // keepMounted (D-03): the panel is mounted-but-hidden. Read the refs and run
    // a ONE-SHOT position() — never startTracking()/autoUpdate, which stays
    // strictly open-gated (D-11) — so the hidden panel already carries real
    // coordinates before the first open instead of painting at 0,0. position()
    // itself no-ops when disablePositioning is set.
    floatingNode = floatingEl;
    arrowNode = arrowEl;
    position();
  }
  return () => {
    stopTracking();
  };
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => open)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((isOpen: any) => {
  if (isOpen && !disabled) {
    // A controlled `open` write (or the handle) never ran requestOpen's capture.
    captureReturnFocus();
    queueMicrotask(() => {
      if (!open || disabled) return;
      floatingNode = floatingEl;
      arrowNode = arrowEl;
      startTracking();
    });
  } else {
    stopTracking();
    // A controlled close (the consumer wrote `open = false`); an internal close
    // already restored in requestOpen, so this is a no-op then.
    restoreFocus();
  }
})(__watchVal); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { (() => placement)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } (() => refresh())(); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { (() => offset)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } (() => refresh())(); }); });
let __rozieWatchInitial_3 = true;
$effect(() => { (() => disableFlip)(); untrack(() => { if (__rozieWatchInitial_3) { __rozieWatchInitial_3 = false; return; } (() => refresh())(); }); });
let __rozieWatchInitial_4 = true;
$effect(() => { (() => disableShift)(); untrack(() => { if (__rozieWatchInitial_4) { __rozieWatchInitial_4 = false; return; } (() => refresh())(); }); });
let __rozieWatchInitial_5 = true;
$effect(() => { (() => strategy)(); untrack(() => { if (__rozieWatchInitial_5) { __rozieWatchInitial_5 = false; return; } (() => refresh())(); }); });
let __rozieWatchInitial_6 = true;
$effect(() => { const __watchVal = (() => matchWidth)(); untrack(() => { if (__rozieWatchInitial_6) { __rozieWatchInitial_6 = false; return; } ((on: any) => {
  if (!on && floatingNode) floatingNode.style.width = '';
  refresh();
})(__watchVal); }); });
let __rozieWatchInitial_7 = true;
$effect(() => { (() => arrow)(); untrack(() => { if (__rozieWatchInitial_7) { __rozieWatchInitial_7 = false; return; } (() => {
  queueMicrotask(() => {
    arrowNode = arrowEl;
    refresh();
  });
})(); }); });
let __rozieWatchInitial_8 = true;
$effect(() => { (() => reference)(); untrack(() => { if (__rozieWatchInitial_8) { __rozieWatchInitial_8 = false; return; } (() => {
  liveReference = reference;
  if (disabled) return;
  if (stopAutoUpdate) {
    startTracking();
  } else if (keepMounted && floatingNode) {
    position();
  }
})(); }); });

$effect(() => {
  if (!(open && !disableDismiss)) return;
  const handler = ($event: KeyboardEvent) => {
    if ($event.key !== 'Escape') return;
    ((dismiss) as (...args: any[]) => any)($event);
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
});

$effect(() => {
  if (!(open && !disableDismiss)) return;
  const handler = ($event: MouseEvent) => {
    const target = $event.target as Node;
    if (anchorEl?.contains(target) || floatingEl?.contains(target)) return;
    ((dismissOutside) as (...args: any[]) => any)($event);
  };
  let attached = false;
  let cancelled = false;
  const timer = setTimeout(() => {
    if (cancelled) return;
    document.addEventListener('click', handler, { capture: true });
    attached = true;
  }, 0);
  return () => {
    cancelled = true;
    clearTimeout(timer);
    if (attached) document.removeEventListener('click', handler, { capture: true });
  };
});
</script>

<div {...__rozieAttrs} class={["rozie-popover", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-c6cf02ea><div class="rozie-popover-anchor" bind:this={anchorEl} aria-haspopup={rozieAttr(anchorHaspopup())} aria-expanded={rozieAttr(trigger === 'click' ? !!open : null)} aria-controls={rozieAttr(trigger === 'click' && open ? panelId() : null)} aria-describedby={rozieAttr(isTooltip() && open ? panelId() : null)} onclick={($event) => { trigger === 'click' && onAnchorClick(); }} onpointerenter={($event) => { trigger === 'hover' && onAnchorPointerEnter(); }} onpointerleave={($event) => { trigger === 'hover' && onAnchorPointerLeave(); }} onfocusin={($event) => { trigger === 'focus' && onAnchorFocus(); }} onfocusout={($event) => { trigger === 'focus' && onAnchorBlur(); }} data-rozie-s-c6cf02ea>{@render anchor?.({ open, toggle, show, hide, panelId: panelId(), popupRole: anchorPopupRole() })}</div>{#if (open || keepMounted) && !disabled}<div class={["rozie-popover-floating", { 'rozie-popover-floating--static': disablePositioning, 'rozie-popover-floating--bare': bare, 'rozie-popover-floating--hidden': !open }]} bind:this={floatingEl} id={rozieAttr(panelId())} role={rozieAttr(floatingRole())} aria-modal={!!(floatingRole() === 'dialog')} data-rozie-s-c6cf02ea>{#if arrow}<div class="rozie-popover-arrow" bind:this={arrowEl} data-rozie-s-c6cf02ea></div>{/if}{@render children?.()}</div>{/if}</div>

<style>
:global {
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
    z-index: var(--rozie-popover-z, var(--rpo-z, 1000));
    width: max-content;
    max-width: var(--rozie-popover-max-width, var(--rpo-max-width, calc(100vw - 16px)));
    background: var(--rozie-popover-bg, var(--rpo-bg, #fff));
    color: var(--rozie-popover-color, var(--rpo-color, inherit));
    border: var(--rozie-popover-border, var(--rpo-border, 1px solid rgba(0, 0, 0, 0.12)));
    border-radius: var(--rozie-popover-radius, var(--rpo-radius, 8px));
    box-shadow: var(--rozie-popover-shadow, var(--rpo-shadow, 0 8px 24px rgba(0, 0, 0, 0.12)));
    padding: var(--rozie-popover-padding, var(--rpo-padding, 8px 12px));
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
    width: var(--rozie-popover-arrow-size, var(--rpo-arrow-size, 8px));
    height: var(--rozie-popover-arrow-size, var(--rpo-arrow-size, 8px));
    background: var(--rozie-popover-bg, var(--rpo-bg, #fff));
    border: var(--rozie-popover-border, var(--rpo-border, 1px solid rgba(0, 0, 0, 0.12)));
    transform: rotate(45deg);
  }
}
</style>
