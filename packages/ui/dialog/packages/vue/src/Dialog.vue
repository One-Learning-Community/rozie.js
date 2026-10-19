<template>

<dialog class="rozie-dialog" :aria-label="(props.ariaLabel) ?? undefined" :aria-labelledby="(props.ariaLabelledby) ?? undefined" v-bind="$attrs" @cancel="onCancel($event)" @close="onNativeClose()" @pointerdown="onPointerDown($event)" @click="onClick($event)">
  
  <div class="rozie-dialog-panel" ref="panelElRef">
    <slot></slot>
  </div>
</dialog>

</template>

<script lang="ts">
/** Why the dialog closed: a scrim click, the Escape key, or a programmatic `hide()`. */
export type DialogCloseReason = 'backdrop' | 'escape' | 'programmatic';
/** The `close` event payload. */
export interface DialogClosePayload {
  reason: DialogCloseReason;
}

export interface DialogHandle {
  show: () => void;
  hide: () => void;
}
</script>

<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { applyScrollLock as applySharedScrollLock } from './internal/scrollLock';

const props = withDefaults(
  defineProps<{
    /**
     * Opt **out** of backdrop-click-to-dismiss. By default a click on the scrim (the `<dialog>` element itself, outside the content panel) closes the dialog with `reason: 'backdrop'`; set this to require an explicit action.
     */
    disableBackdropClose?: boolean;
    /**
     * Opt **out** of Escape-to-dismiss. By default the native `cancel` event (Esc) closes with `reason: 'escape'`; the component `preventDefault()`s it so the close always flows through the `open` model. Set this to keep the dialog open on Escape (e.g. a required confirmation).
     */
    disableEscapeClose?: boolean;
    /**
     * Opt **out** of locking `<html>` scroll while the dialog is open. By default `document.documentElement` `overflow` is set to `hidden` for the duration the dialog is shown; set this to leave background scrolling enabled.
     */
    disableScrollLock?: boolean;
    /**
     * What to focus when the dialog opens: a CSS selector matched inside the dialog content, or an Element. By default the native `showModal()` choice applies: the first element with `autofocus`, otherwise the first focusable element. Use it to start on a specific field (e.g. `initialFocus="input[name=title]"`) without waiting for the dialog to mount. A selector that matches nothing, or an element that is not focusable, leaves the native choice in place.
     * @example
     * <Dialog v-model:open="renameOpen" initialFocus="#label-name" />
     */
    initialFocus?: string | Element | null;
    /**
     * Accessible name for the dialog (`aria-label`) when there is no visible title to point at. Prefer `ariaLabelledby` when a visible heading exists.
     */
    ariaLabel?: string | null;
    /**
     * The `id` of the element that titles the dialog (`aria-labelledby`) — preferred over `ariaLabel` when a visible heading exists inside the dialog. On the Lit element the dialog lives in a shadow root while the heading is slotted light DOM, so the attribute alone cannot reach it; Dialog hands the browser the element directly (`ariaLabelledByElements`) where that is supported (Chrome/Edge 135+, Safari 16.4+) — elsewhere, use `ariaLabel` on Lit.
     */
    ariaLabelledby?: string | null;
  }>(),
  { disableBackdropClose: false, disableEscapeClose: false, disableScrollLock: false, initialFocus: null, ariaLabel: null, ariaLabelledby: null }
);

const __rozieVm = getCurrentInstance()!;
/** Whether the consumer binds a value (not `undefined`) to the two-way prop `name`. */
const __rozieBound = (name: string): boolean => {
  const raw = __rozieVm.vnode.props;
  if (!raw) return false;
  const kebab = name.replace(/\B([A-Z])/g, '-$1').toLowerCase();
  return (name in raw ? raw[name] : raw[kebab]) !== undefined;
};
/**
 * Whether the dialog is shown (two-way `r-model`). The sole `model: true` prop — two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`) and Dialog reconciles the native `<dialog>` to it via `showModal()` / `close()`. Every close path (backdrop, Escape, programmatic `hide()`) writes `open = false` and emits `close`.
 * @example
 * <Dialog v-model:open="confirmOpen" ariaLabelledby="confirm-title" />
 */
const __rozieModel_open = defineModel<boolean>('open', { default: false });
const open = computed<boolean>({
  get: () => __rozieModel_open.value,
  set: (v) => { if (__rozieBound('open')) __rozieVm.emit('update:open', v); else __rozieModel_open.value = v; },
});

const emit = defineEmits<{
  close: [payload: DialogClosePayload];
}>();

defineSlots<{
  default(props: {  }): any;
}>();

const panelElRef = ref<HTMLElement>();

// ---- native reconcile ---------------------------------------------------
// The <dialog> element, cached by sync() so $onUnmount can reach it without
// reading $refs during teardown.
let dialogEl: HTMLDialogElement | null = null;
// Whether THIS instance currently holds one count of the shared scroll lock.
let holdsLock = false;
// The element focused when the dialog opened, for the unmount-while-open
// focus return (a normal close gets the native return from close()).
let returnFocusTo: HTMLElement | null = null;
// Whether the press that is about to produce a `click` began INSIDE the panel.
// A press that starts on content (selecting text, a drag) and is released over
// the scrim yields a `click` whose target is the common ancestor, the <dialog>
// itself; without this it would be mistaken for a backdrop click.
let pressStartedInside = false;
// Lock/unlock <html> scroll for this instance. The actual lock/unlock is
// REF-COUNTED (./internal/scrollLock) across every Dialog instance sharing this
// leaf's module, because a naive per-instance toggle unlocks scrolling the
// moment ANY dialog closes, even while an OUTER dialog is still open. This
// wrapper releases only a count this instance took: a dialog that mounts closed
// (or closes twice) must not release a count another open dialog holds. The
// opt-out is read when locking only, so toggling it while open still releases.
const setScrollLock = (lock: any) => {
  if (lock === holdsLock) return;
  if (lock && props.disableScrollLock) return;
  holdsLock = lock;
  applySharedScrollLock(lock);
};
// The element that really has focus. `document.activeElement` stops at the
// outermost shadow host (on Lit the trigger lives inside a component's shadow
// root, so it reports that component), so walk each shadowRoot.activeElement.
const deepActiveElement = () => {
  let active: any = typeof document === 'undefined' ? null : document.activeElement;
  while (active && active.shadowRoot && active.shadowRoot.activeElement) active = active.shadowRoot.activeElement;
  return active;
};
// Focus `initialFocus` after showModal() has made its native choice. A selector
// is matched inside the panel and, on Lit, inside the light-DOM content
// assigned to the panel's <slot> (which panel.querySelector cannot see).
const focusInitial = (panel: any) => {
  const target: any = props.initialFocus;
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
// `aria-labelledby` is an IDREF, and an IDREF never crosses a shadow-root
// boundary. Where the <dialog> lives inside an element's shadow root (the Lit
// target) the heading it names is slotted LIGHT DOM, so the attribute resolves to
// nothing and the dialog has no accessible name. Element reflection can point
// across the boundary (to an element in an ancestor tree), so when the id is not
// reachable from the dialog's own root, hand the browser the element directly.
// A no-op outside a shadow root, and where the browser lacks the property.
const bridgeLabelledBy = (el: any) => {
  const id = props.ariaLabelledby;
  const root: any = el.getRootNode();
  if (!id || !root || !root.host || typeof root.getElementById !== 'function') return;
  if (root.getElementById(id) || !('ariaLabelledByElements' in el)) return;
  const outer: any = root.host.getRootNode();
  const heading = outer && typeof outer.getElementById === 'function' ? outer.getElementById(id) : null;
  if (heading) el.ariaLabelledByElements = [heading];
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
const sync = (isOpen: any) => {
  const panel = panelElRef.value;
  const el = (panel && panel.parentElement) as HTMLDialogElement | null;
  if (!el) return;
  dialogEl = el;
  if (isOpen) {
    if (!el.open) {
      const active = deepActiveElement();
      returnFocusTo = active instanceof HTMLElement ? active : null;
      bridgeLabelledBy(el);
      el.showModal();
      focusInitial(panel);
    }
    setScrollLock(true);
  } else {
    if (el.open) el.close();
    returnFocusTo = null;
    setScrollLock(false);
  }
};
// ---- close funnel (single $emit site) ----------------------------------
const closeWith = (reason: any) => {
  open.value = false;
  emit('close', {
    reason
  });
};
// ---- handlers ----------------------------------------------------------
// Native Esc fires `cancel` on the <dialog>. preventDefault so WE drive the
// close through the model (keeping `open` in sync); honor the opt-out.
const onCancel = (e: any) => {
  if (e) e.preventDefault();
  if (props.disableEscapeClose) return;
  closeWith('escape');
};
// Remember whether a press began on the panel's content (anywhere but the
// <dialog> box itself), so the `click` that follows can tell a real scrim click
// from the end of a drag that merely finished over the scrim.
const onPointerDown = (e: any) => {
  const panel = panelElRef.value;
  const el = panel && panel.parentElement;
  pressStartedInside = !!(e && el && e.target !== el);
};
// A click whose target IS the <dialog> element (not its panel/children) is a
// backdrop click — the ::backdrop is part of the dialog box. We compare the
// real `e.target` (reliable even under Solid's event delegation) to the dialog
// element resolved via the panel ref's parent. A click whose press started
// inside the panel is not one (see `pressStartedInside`).
const onClick = (e: any) => {
  const startedInside = pressStartedInside;
  pressStartedInside = false;
  if (props.disableBackdropClose || startedInside) return;
  const panel = panelElRef.value;
  const el = panel && panel.parentElement;
  if (e && el && e.target === el) closeWith('backdrop');
};
// The native `close` event: fired by `el.close()` from our own reconcile (by then
// the model is already false, and the dialog may even have been re-opened), but
// also by closes WE did not drive — a `<form method="dialog">` submit, a stray
// `dialog.close()`. For those the model is still true over a closed dialog and
// would stay stuck (writing `open = true` again changes nothing), so fold them
// into the close funnel. Not during teardown: $onUnmount closes the dialog
// itself after clearing `dialogEl`.
const onNativeClose = () => {
  const el = dialogEl;
  if (!el || el.open || !open.value) return;
  closeWith('programmatic');
};

// ---- lifecycle ---------------------------------------------------------
// ---- imperative handle -------------------------------------------------
// show()/hide() — named to avoid the `open` model + `@close` event collisions.
// hide() on a dialog that is not open is a no-op: there is nothing to dismiss, so
// it must not emit a `close` for a dismissal that never happened.
const show = () => {
  open.value = true;
};
const hide = () => {
  if (!open.value) return;
  closeWith('programmatic');
};

onMounted(() => {
  sync(open.value);
});
onBeforeUnmount(() => {
  setScrollLock(false);
  pressStartedInside = false;
  const el = dialogEl;
  const back = returnFocusTo;
  dialogEl = null;
  returnFocusTo = null;
  if (!el || !el.open) return;
  if (el.isConnected) el.close();
  if (!back) return;
  setTimeout(() => {
    // Lost: on <body>, or stranded on a shadow host whose root holds no focus
    // and which is not focusable itself (the dialog's removed subtree was
    // inside it).
    const active = deepActiveElement();
    const lost = !active || active === document.body || !!active.shadowRoot && active.tabIndex < 0;
    if (back.isConnected && lost) back.focus();
  }, 0);
});

watch(() => open.value, (isOpen: any) => {
  sync(isOpen);
}, { flush: 'post' });

defineExpose({ show, hide } as DialogHandle);
</script>

<style scoped>
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
</style>
