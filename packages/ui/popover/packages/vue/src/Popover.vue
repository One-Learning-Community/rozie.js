<template>

<div class="rozie-popover" v-bind="$attrs">

  
  <div class="rozie-popover-anchor" ref="anchorElRef" :aria-haspopup="props.trigger === 'click' ? 'dialog' : undefined" :aria-expanded="(props.trigger === 'click' ? !!open : undefined) ?? undefined" :aria-controls="props.trigger === 'click' && open ? panelId() : undefined" :aria-describedby="isTooltip() && open ? panelId() : undefined" @click="props.trigger === 'click' && onAnchorClick()" @pointerenter="props.trigger === 'hover' && onAnchorPointerEnter()" @pointerleave="props.trigger === 'hover' && onAnchorPointerLeave()" @focusin="props.trigger === 'focus' && onAnchorFocus()" @focusout="props.trigger === 'focus' && onAnchorBlur()">
    <slot name="anchor" :open="open" :toggle="toggle" :show="show" :hide="hide" :panelId="panelId()"></slot>
  </div>

  
  <div v-if="(open || props.keepMounted) && !props.disabled" :class="['rozie-popover-floating', { 'rozie-popover-floating--static': props.disablePositioning, 'rozie-popover-floating--bare': props.bare, 'rozie-popover-floating--hidden': !open }]" ref="floatingElRef" :id="panelId()" :role="floatingRole()" :aria-modal="!!(floatingRole() === 'dialog')">
    <div v-if="props.arrow" class="rozie-popover-arrow" ref="arrowElRef"></div><slot></slot>
  </div></div>

</template>

<script lang="ts">
export interface PopoverHandle {
  show: () => void;
  hide: () => void;
  toggle: () => void;
  reposition: () => void;
}
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';
import { useOutsideClick } from '@rozie/runtime-vue';

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

const props = withDefaults(
  defineProps<{
    /**
     * Floating UI placement of the content relative to the anchor — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end` (e.g. `bottom-start`). With `disableFlip` off, the content may flip to the opposite side when it would overflow the viewport. Reconciled at runtime.
     */
    placement?: string;
    /**
     * How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur, or `'manual'` for a composing component that drives `open` itself — every built-in gesture handler no-ops. Drives both the gesture handlers and the ARIA: `'click'` sets `aria-haspopup`/`aria-expanded`/`aria-controls` on the anchor wrapper; `'hover'`/`'focus'` are tooltips (`role="tooltip"` panel, `aria-describedby` on the wrapper, no popup claim); `'manual'` makes no anchor ARIA claim. The wrapper is not focusable, so put the matching attributes on your own focusable trigger too — the `anchor` slot passes `open` and `panelId` for exactly that.
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
     * Id base for the floating panel, whose id is `idBase + '-panel'` — also exposed to the `anchor` slot as `panelId`, so your trigger can set `aria-controls` (click) or `aria-describedby` (tooltip) to it. Set a **distinct** value per instance when more than one popover shares a page. On Lit the panel lives in the element's shadow root, so an id reference from light DOM, including your slotted anchor content, cannot resolve to it; there the anchor wrapper's own attributes, which sit inside the shadow root, carry the reference. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
     */
    idBase?: string;
    /**
     * Position the content against an external reference instead of the built-in anchor wrapper: either a DOM Element another component owns (e.g. a calendar event element) or a Floating UI virtual element — an object with a `getBoundingClientRect()` method and an optional `contextElement` — e.g. to open at a pointer position. The reference is measured and tracked with Floating UI's `autoUpdate` and reconciled at runtime; `null` (the default) keeps the built-in anchor. A click on a referenced Element does not count as an outside click (so a consumer toggle on it closes the panel); with a virtual element only the anchor wrapper and the panel count as inside. You own the trigger ARIA on your own element (`aria-haspopup` / `aria-expanded`, plus `aria-controls` pointing at `idBase + '-panel'`), typically with `trigger='manual'` and a two-way-bound `open`. If a referenced Element is removed from the document while open, the popover closes. Pass a stable value — a new object on every render restarts tracking.
     */
    reference?: Element | Record<string, any> | null;
  }>(),
  { placement: 'bottom', trigger: 'click', offset: 8, disableFlip: false, disableShift: false, arrow: false, disabled: false, modal: false, strategy: 'absolute', bare: false, disablePositioning: false, keepMounted: false, matchWidth: false, disableDismiss: false, idBase: 'rozie-popover', reference: null }
);

/**
 * Whether the floating content is open. The sole `model: true` prop, and its change event is the only change signal Popover fires. Bind it two-way — Vue `v-model:open`, React/Solid `open` + `onOpenChange`, Svelte `bind:open`, Angular `[(open)]`, Lit the `open` property + the `open-change` event — and Popover writes the new state back whenever the trigger, a dismissal or the handle toggles it. Left unbound it falls back to an uncontrolled default.
 */
const open = defineModel<boolean>('open', { default: false });

defineSlots<{
  anchor(props: { open: boolean; toggle: () => void; show: () => void; hide: () => void; panelId: string }): any;
  default(props: {  }): any;
}>();

const anchorElRef = ref<HTMLElement>();
const floatingElRef = ref<HTMLElement>();
const arrowElRef = ref<HTMLElement>();

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
  const lost = !active || active === document.body || active === document.documentElement;
  const insidePanel = !!(floatingNode && active && composedContains(floatingNode, active));
  if (lost || insidePanel) el.focus();
};
// Drive the two-way model in one place. Named `requestOpen` (NOT `setOpen`)
// to dodge the React generated `setOpen` setter for the `open` model (ROZ524).
const requestOpen = (next: any) => {
  if (open.value === next) return;
  if (next) captureReturnFocus();
  open.value = next;
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
  if (props.disablePositioning) return;
  // The Floating UI reference: the `reference` prop (external Element or virtual
  // element) when set, else the built-in anchor wrapper (260929-lyc DD-3). A
  // function-local null-let so typeNeutralize makes it `any` in every leaf — the
  // union prop type never trips strict leaf tsc against `ReferenceElement`.
  let referenceEl: any = null;
  referenceEl = props.reference || anchorNode;
  if (!referenceEl || !floatingNode) return;
  // A referenced Element removed from the document measures as a zero rect at
  // the viewport origin (release-0.8.0 audit B2), e.g. a calendar event element
  // FullCalendar re-rendered. There is nothing left to point at, so close.
  if (referenceEl.nodeType === 1 && !referenceEl.isConnected) {
    if (open.value) requestOpen(false);
    return;
  }
  const middleware = buildMiddleware({
    offset: offsetMiddleware,
    flip,
    shift,
    arrow: arrowMiddleware,
    size
  }, {
    offset: props.offset,
    disableFlip: props.disableFlip,
    disableShift: props.disableShift,
    arrow: props.arrow,
    arrowEl: arrowNode,
    matchWidth: !!props.matchWidth
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
  if (props.strategy === 'fixed') {
    floatingNode.style.position = 'fixed';
  } else {
    floatingNode.style.position = '';
  }
  let opts: any = null;
  opts = {
    placement: props.placement,
    strategy: props.strategy,
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
  if (props.disablePositioning) return;
  // Same reference resolution as position() (DD-3). autoUpdate accepts a virtual
  // element: it unwraps it to its optional `contextElement` for ancestor/resize
  // observation (skipped when absent) and still runs the initial update.
  let referenceEl: any = null;
  referenceEl = props.reference || anchorNode;
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
// ─── reconcile positioning props while open ─────────────────────────────────────
// Restart tracking rather than repositioning once (release-0.8.0 audit B3):
// autoUpdate holds the position callback it was started with, which on React is
// the render-time closure — a one-shot position() with the new props would be
// reverted by the next scroll/resize update through the old closure.
// startTracking() re-subscribes with the current callback and positions
// immediately. Closed or untracked (disablePositioning) → plain position().
const refresh = () => {
  if (!open.value) return;
  if (stopAutoUpdate) startTracking();else position();
};
// ─── trigger gesture handlers (wired conditionally on the anchor by `trigger`) ──
const onAnchorClick = () => {
  if (props.disabled) return;
  requestOpen(!open.value);
};
const onAnchorPointerEnter = () => {
  if (props.disabled) return;
  requestOpen(true);
};
const onAnchorPointerLeave = () => {
  if (props.disabled) return;
  requestOpen(false);
};
const onAnchorFocus = () => {
  if (props.disabled) return;
  requestOpen(true);
};
const onAnchorBlur = () => {
  if (props.disabled) return;
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
const isTooltip = () => props.trigger === 'hover' || props.trigger === 'focus';
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
const floatingRole = () => isTooltip() ? 'tooltip' : props.modal ? 'dialog' : undefined;
// The panel id (audit B1), also handed to the anchor slot as `panelId`.
const panelId = () => props.idBase + '-panel';
// ─── imperative handle ($expose) ────────────────────────────────────────────────
// Verbs: show/hide/toggle/reposition. NOT `update` (reserved Lit lifecycle) → the
// reposition verb is `reposition`. None collide with the `open` model or its
// React `setOpen` setter, nor with inherited HTMLElement members.
function show() {
  if (!props.disabled) requestOpen(true);
}
function hide() {
  requestOpen(false);
}
function toggle() {
  if (!props.disabled) requestOpen(!open.value);
}
function reposition() {
  position();
}

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  // $refs read ONLY here (ROZ123). The floating + arrow elements live behind r-if
  // and may be null until open (or keepMounted); startTracking re-reads via the
  // watch path.
  anchorNode = anchorElRef.value;
  liveReference = props.reference;
  if (open.value && !props.disabled) {
    // floatingNode is populated by its r-if having rendered; read it lazily inside
    // the watch/handlers too. Position on next tick when it exists.
    floatingNode = floatingElRef.value;
    arrowNode = arrowElRef.value;
    startTracking();
  } else if (props.keepMounted && !props.disabled) {
    // keepMounted (D-03): the panel is mounted-but-hidden. Read the refs and run
    // a ONE-SHOT position() — never startTracking()/autoUpdate, which stays
    // strictly open-gated (D-11) — so the hidden panel already carries real
    // coordinates before the first open instead of painting at 0,0. position()
    // itself no-ops when disablePositioning is set.
    floatingNode = floatingElRef.value;
    arrowNode = arrowElRef.value;
    position();
  }
  _cleanup_0 = () => {
    stopTracking();
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => open.value, (isOpen: any) => {
  if (isOpen && !props.disabled) {
    // A controlled `open` write (or the handle) never ran requestOpen's capture.
    captureReturnFocus();
    queueMicrotask(() => {
      if (!open.value || props.disabled) return;
      floatingNode = floatingElRef.value;
      arrowNode = arrowElRef.value;
      startTracking();
    });
  } else {
    stopTracking();
    // A controlled close (the consumer wrote `open = false`); an internal close
    // already restored in requestOpen, so this is a no-op then.
    restoreFocus();
  }
}, { flush: 'post' });
watch(() => props.placement, () => refresh(), { flush: 'post' });
watch(() => props.offset, () => refresh(), { flush: 'post' });
watch(() => props.disableFlip, () => refresh(), { flush: 'post' });
watch(() => props.disableShift, () => refresh(), { flush: 'post' });
watch(() => props.strategy, () => refresh(), { flush: 'post' });
watch(() => props.matchWidth, (on: any) => {
  if (!on && floatingNode) floatingNode.style.width = '';
  refresh();
}, { flush: 'post' });
watch(() => props.arrow, () => {
  queueMicrotask(() => {
    arrowNode = arrowElRef.value;
    refresh();
  });
}, { flush: 'post' });
watch(() => props.reference, () => {
  liveReference = props.reference;
  if (props.disabled) return;
  if (stopAutoUpdate) {
    startTracking();
  } else if (props.keepMounted && floatingNode) {
    position();
  }
}, { flush: 'post' });

defineExpose({ show, hide, toggle, reposition } as PopoverHandle);

watchEffect((onCleanup) => {
  if (!(open.value && !props.disableDismiss)) return;
  const handler = ($event: KeyboardEvent) => {
    if ($event.key !== 'Escape') return;
    ((dismiss) as (...args: any[]) => any)($event);
  };
  document.addEventListener('keydown', handler);
  onCleanup(() => document.removeEventListener('keydown', handler));
});

useOutsideClick(
  [anchorElRef, floatingElRef],
  ($event) => ((dismissOutside) as (...args: any[]) => any)($event),
  () => open.value && !props.disableDismiss,
);
</script>

<style scoped>
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
  max-width: var(--rozie-popover-max-width, var(--rpo-max-width, calc(100vw - 16px)));
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
</style>
