<template>

<dialog class="rozie-dialog" :aria-label="props.ariaLabel" :aria-labelledby="props.ariaLabelledby" v-bind="$attrs" @cancel="onCancel($event)" @click="onClick($event)">
  
  <div class="rozie-dialog-panel" ref="panelElRef">
    <slot></slot>
  </div>
</dialog>

</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

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
     * Accessible name for the dialog (`aria-label`) when there is no visible title to point at. Prefer `ariaLabelledby` when a visible heading exists.
     */
    ariaLabel?: string | null;
    /**
     * The `id` of the element that titles the dialog (`aria-labelledby`) — preferred over `ariaLabel` when a visible heading exists inside the dialog.
     */
    ariaLabelledby?: string | null;
  }>(),
  { disableBackdropClose: false, disableEscapeClose: false, disableScrollLock: false, ariaLabel: null, ariaLabelledby: null }
);

/**
 * Whether the dialog is shown (two-way `r-model`). The sole `model: true` prop — two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`) and Dialog reconciles the native `<dialog>` to it via `showModal()` / `close()`. Every close path (backdrop, Escape, programmatic `hide()`) writes `open = false` and emits `close`.
 * @example
 * <Dialog r-model:open="confirmOpen" ariaLabelledby="confirm-title" />
 */
const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  close: [...args: any[]];
}>();

defineSlots<{
  default(props: {  }): any;
}>();

const panelElRef = ref<HTMLElement>();

// ---- native reconcile ---------------------------------------------------
// Lock/unlock <html> scroll (no-op when disabled or pre-DOM).
const applyScrollLock = (lock: any) => {
  if (props.disableScrollLock) return;
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root) root.style.overflow = lock ? 'hidden' : '';
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
  if (isOpen) {
    if (!el.open) el.showModal();
    applyScrollLock(true);
  } else {
    if (el.open) el.close();
    applyScrollLock(false);
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
// A click whose target IS the <dialog> element (not its panel/children) is a
// backdrop click — the ::backdrop is part of the dialog box. We compare the
// real `e.target` (reliable even under Solid's event delegation) to the dialog
// element resolved via the panel ref's parent.
const onClick = (e: any) => {
  if (props.disableBackdropClose) return;
  const panel = panelElRef.value;
  const el = panel && panel.parentElement;
  if (e && el && e.target === el) closeWith('backdrop');
};

// ---- lifecycle ---------------------------------------------------------
// ---- imperative handle -------------------------------------------------
// show()/hide() — named to avoid the `open` model + `@close` event collisions.
const show = () => {
  open.value = true;
};
const hide = () => {
  closeWith('programmatic');
};

onMounted(() => {
  sync(open.value);
});

watch(() => open.value, (isOpen: any) => {
  sync(isOpen);
});

defineExpose({ show, hide });
</script>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .rozie-dialog {
    transition: opacity var(--rozie-dialog-transition, 0.15s ease), transform var(--rozie-dialog-transition, 0.15s ease), overlay 0.15s ease allow-discrete, display 0.15s ease allow-discrete;
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
    transition: opacity var(--rozie-dialog-transition, 0.15s ease), overlay 0.15s ease allow-discrete, display 0.15s ease allow-discrete;
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
  width: var(--rozie-dialog-width, auto);
  max-width: var(--rozie-dialog-max-width, min(32rem, calc(100vw - 2rem)));
  max-height: var(--rozie-dialog-max-height, calc(100vh - 2rem));
  border: var(--rozie-dialog-border, none);
  border-radius: var(--rozie-dialog-radius, 0.75rem);
  background: var(--rozie-dialog-bg, #fff);
  color: var(--rozie-dialog-color, inherit);
  box-shadow: var(--rozie-dialog-shadow, 0 10px 38px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.25));
  overflow: auto;
}
.rozie-dialog::backdrop {
  background: var(--rozie-dialog-backdrop-bg, rgba(0, 0, 0, 0.5));
  backdrop-filter: var(--rozie-dialog-backdrop-filter, none);
}
.rozie-dialog-panel {
  padding: var(--rozie-dialog-padding, 1.5rem);
  font: var(--rozie-dialog-font, inherit);
}
</style>
