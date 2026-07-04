<template>

<div class="rozie-popover" v-bind="$attrs">

  
  <div class="rozie-popover-anchor" ref="anchorElRef" aria-haspopup="dialog" :aria-expanded="!!open" :aria-describedby="isTooltip() && open ? 'rozie-popover-floating' : undefined" @click="props.trigger === 'click' && onAnchorClick()" @pointerenter="props.trigger === 'hover' && onAnchorPointerEnter()" @pointerleave="props.trigger === 'hover' && onAnchorPointerLeave()" @focusin="props.trigger === 'focus' && onAnchorFocus()" @focusout="props.trigger === 'focus' && onAnchorBlur()">
    <slot name="anchor" :open="open" :toggle="toggle" :show="show" :hide="hide"></slot>
  </div>

  
  <div v-if="open && !props.disabled" class="rozie-popover-floating" ref="floatingElRef" id="rozie-popover-floating" :role="floatingRole()" :aria-modal="!!(floatingRole() === 'dialog')">
    <div v-if="props.arrow" class="rozie-popover-arrow" ref="arrowElRef"></div><slot></slot>
  </div></div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';
import { useOutsideClick } from '@rozie/runtime-vue';

const props = withDefaults(
  defineProps<{
    /**
     * Floating UI placement of the content relative to the anchor — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end` (e.g. `bottom-start`). With `disableFlip` off, the content may flip to the opposite side when it would overflow the viewport. Reconciled at runtime.
     */
    placement?: string;
    /**
     * How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur. Drives both the gesture handlers and the ARIA role (`'hover'`/`'focus'` → tooltip, `'click'` → popover dialog).
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
     * Floating UI positioning strategy — 'absolute' (default) or 'fixed'. Use 'fixed' to escape a scrollable/overflow-clipping ancestor (e.g. a sticky table header). Reconciled at runtime.
     */
    strategy?: string;
  }>(),
  { placement: 'bottom', trigger: 'click', offset: 8, disableFlip: false, disableShift: false, arrow: false, disabled: false, strategy: 'absolute' }
);

/**
 * Whether the floating content is open. The sole `model: true` prop — two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`) and Popover writes the new state back whenever the trigger or a dismissal toggles it. Left unbound it falls back to an uncontrolled default.
 */
const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  change: [...args: any[]];
}>();

defineSlots<{
  anchor(props: { open: any; toggle: any; show: any; hide: any }): any;
  default(props: {  }): any;
}>();

const anchorElRef = ref<HTMLElement>();
const floatingElRef = ref<HTMLElement>();
const arrowElRef = ref<HTMLElement>();

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
const requestOpen = (next: any) => {
  if (open.value === next) return;
  if (next && props.trigger === 'click') {
    lastFocusedEl = deepActiveElement();
  }
  open.value = next;
  emit('change', next);
  if (!next && props.trigger === 'click' && lastFocusedEl && lastFocusedEl.isConnected && typeof lastFocusedEl.focus === 'function') {
    lastFocusedEl.focus();
  }
  if (!next) {
    lastFocusedEl = null;
  }
};

// Apply the resolved x/y (and arrow offset, when present) onto the floating element.
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
// Recompute the position once. Pure engine call; safe to invoke whenever both
// elements exist and the content is open. `opts` is a null-let (→ `any`) so the
// loosely-typed `<props>` placement (string) + the `unknown[]` middleware array don't
// fail the strict leaf tsc against Floating UI's `Placement` / `Middleware[]` types
// (the cropper `let cfg = null` constructor-args idiom).
const position = () => {
  if (!anchorNode || !floatingNode) return;
  const middleware = buildMiddleware({
    offset: offsetMiddleware,
    flip,
    shift,
    arrow: arrowMiddleware
  }, {
    offset: props.offset,
    disableFlip: props.disableFlip,
    disableShift: props.disableShift,
    arrow: props.arrow,
    arrowEl: arrowNode
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
  computePosition(anchorNode, floatingNode, opts).then((result: any) => {
    applyPosition(result.x, result.y, result.middlewareData);
  });
};

// Start autoUpdate (idempotent — stop any prior subscription first) and do an
// initial position. Floating UI's autoUpdate keeps the position fresh on scroll/
// resize/ancestor-layout changes and returns its own teardown.
// Start autoUpdate (idempotent — stop any prior subscription first) and do an
// initial position. Floating UI's autoUpdate keeps the position fresh on scroll/
// resize/ancestor-layout changes and returns its own teardown.
const startTracking = () => {
  if (!anchorNode || !floatingNode) return;
  if (stopAutoUpdate) {
    stopAutoUpdate();
    stopAutoUpdate = null;
  }
  stopAutoUpdate = autoUpdate(anchorNode, floatingNode, position);
};
const stopTracking = () => {
  if (stopAutoUpdate) {
    stopAutoUpdate();
    stopAutoUpdate = null;
  }
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

// Dismissal handler — method reference for the <listeners> block (an inline
// handler referencing $event leaks into React's useEffect deps → TS2552; every
// corpus <listener> uses a method-ref + modifiers).
// Dismissal handler — method reference for the <listeners> block (an inline
// handler referencing $event leaks into React's useEffect deps → TS2552; every
// corpus <listener> uses a method-ref + modifiers).
const dismiss = () => {
  requestOpen(false);
};

// ─── role helpers (plain functions; tooltip vs popover-dialog by trigger) ───────
// hover/focus triggers are tooltip-flavored; click is an interactive popover.
// ─── role helpers (plain functions; tooltip vs popover-dialog by trigger) ───────
// hover/focus triggers are tooltip-flavored; click is an interactive popover.
const isTooltip = () => props.trigger === 'hover' || props.trigger === 'focus';
const floatingRole = () => isTooltip() ? 'tooltip' : 'dialog';

// ─── imperative handle ($expose) ────────────────────────────────────────────────
// Verbs: show/hide/toggle/reposition. NOT `update` (reserved Lit lifecycle) → the
// reposition verb is `reposition`. None collide with the `change` emit, the `open`
// model, or its React `setOpen` setter, nor with inherited HTMLElement members.
// ─── imperative handle ($expose) ────────────────────────────────────────────────
// Verbs: show/hide/toggle/reposition. NOT `update` (reserved Lit lifecycle) → the
// reposition verb is `reposition`. None collide with the `change` emit, the `open`
// model, or its React `setOpen` setter, nor with inherited HTMLElement members.
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
  // and may be null until open; startTracking re-reads via the watch path.
  anchorNode = anchorElRef.value;
  if (open.value && !props.disabled) {
    // floatingNode is populated by its r-if having rendered; read it lazily inside
    // the watch/handlers too. Position on next tick when it exists.
    floatingNode = floatingElRef.value;
    arrowNode = arrowElRef.value;
    startTracking();
  }
  _cleanup_0 = () => {
    stopTracking();
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => open.value, (isOpen: any) => {
  if (isOpen && !props.disabled) {
    queueMicrotask(() => {
      if (!open.value || props.disabled) return;
      floatingNode = floatingElRef.value;
      arrowNode = arrowElRef.value;
      startTracking();
    });
  } else {
    stopTracking();
  }
});
watch(() => props.placement, () => {
  if (open.value) position();
});
watch(() => props.offset, () => {
  if (open.value) position();
});
watch(() => props.disableFlip, () => {
  if (open.value) position();
});
watch(() => props.disableShift, () => {
  if (open.value) position();
});
watch(() => props.strategy, () => {
  if (open.value) position();
});

defineExpose({ show, hide, toggle, reposition });

watchEffect((onCleanup) => {
  if (!(open.value)) return;
  const handler = ($event: KeyboardEvent) => {
    if ($event.key !== 'Escape') return;
    dismiss();
  };
  document.addEventListener('keydown', handler);
  onCleanup(() => document.removeEventListener('keydown', handler));
});

useOutsideClick(
  [anchorElRef, floatingElRef],
  () => dismiss(),
  () => open.value,
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
</style>
