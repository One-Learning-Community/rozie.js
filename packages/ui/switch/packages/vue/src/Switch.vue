<template>

<button ref="controlRef" type="button" :class="['rozie-switch', { 'rozie-switch--checked': isChecked(), 'rozie-switch--disabled': props.disabled }]" role="switch" :tabindex="(controlTabindex()) ?? undefined" :disabled="!!props.disabled" :aria-checked="!!modelValue" :aria-disabled="!!props.disabled" :aria-readonly="!!props.readonly" :aria-label="props.ariaLabel" v-bind="$attrs" @click="onClick()" @keydown="onKeydown($event)">
  <slot :checked="isChecked()" :toggle="toggle">
    <span class="rozie-switch-track">
      <span class="rozie-switch-thumb"></span>
    </span>
  </slot>
</button>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * Disable the control entirely — it becomes non-focusable (`tabindex` is dropped), non-toggleable (click and keyboard are ignored), and `aria-disabled` is set. Also sets the Angular `ControlValueAccessor` disabled state.
     */
    disabled?: boolean;
    /**
     * Make the switch read-only — its state is shown and the control stays focusable, but the user cannot toggle it (click and keyboard are ignored). Reflected as `aria-readonly`.
     */
    readonly?: boolean;
    /**
     * Accessible name applied to the `role="switch"` control (`aria-label`). Provide this (or an external `<label>`) so the switch is announced.
     */
    ariaLabel?: string | null;
  }>(),
  { disabled: false, readonly: false, ariaLabel: null }
);

/**
 * The on/off state of the switch (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a switch **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `true` is the checked/on state; reflected as `aria-checked`.
 * @example
 * <Switch r-model:modelValue="on" ariaLabel="Wi-Fi" />
 */
const modelValue = defineModel<boolean>('modelValue', { default: false });

const emit = defineEmits<{
  change: [...args: any[]];
}>();

defineSlots<{
  default(props: { checked: any; toggle: any }): any;
}>();

const controlRef = ref<HTMLButtonElement>();

// ---- derived view (plain function, uniform ×6) -----------------------------
// The current on/off state as a real boolean. Named isChecked, NOT a bare
// `checked` (which would become a Lit class field colliding with inherited DOM)
// nor `valueOf` (which cascades TS1240/1271 across the Lit class). A plain
// function (read in the template AND inside handlers/verbs) — never $computed,
// whose value-vs-accessor form diverges between React and Solid.
const isChecked = () => modelValue.value === true;
// ---- write funnel (single $emit site) --------------------------------------
// Write the model and emit change. Named commitValue (NOT writeValue) so it does
// not collide with the generated Angular ControlValueAccessor.writeValue (TS2300).
const commitValue = (next: any) => {
  const v = next === true;
  modelValue.value = v;
  emit('change', {
    checked: v
  });
};
// Flip the state, unless disabled / readonly. The public toggle verb + the
// click/keyboard handlers all funnel through here.
const toggle = () => {
  if (props.disabled || props.readonly) return;
  commitValue(!isChecked());
};
// ---- pointer + keyboard handlers -------------------------------------------
const onClick = () => {
  toggle();
};
// Space and Enter toggle the switch (the WAI-ARIA switch keyboard pattern).
// preventDefault on Space so the page does not scroll.
const onKeydown = (e: any) => {
  if (props.disabled || props.readonly) return;
  const key = e ? e.key : '';
  if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
    if (e) e.preventDefault();
    toggle();
  }
};
// ---- focusability helper (plain function, uniform ×6) ----------------------
// tabindex is 0 when interactive, dropped (null → attribute omitted) when
// disabled. Returns number | null; rozieAttr drops the attr on null.
const controlTabindex = () => props.disabled ? null : 0;
// ---- imperative handle -----------------------------------------------------
// focus() — move DOM focus to the control. DELIBERATELY overrides
// HTMLElement.focus on Lit (ROZ137 warn, accepted; the public focus() handle is
// intended). Reads $refs in a post-mount handle call (ROZ123-safe). $refs.control
// types to the generic HTMLElement on the tsdown/vue leaves, so we only touch
// HTMLElement members here (`focus`). toggle() — flip the state (same funnel as
// the UI), a no-op when disabled / readonly.
const focus = () => {
  const el = controlRef.value;
  if (el && el.focus) el.focus();
};

defineExpose({ focus, toggle });
</script>

<style scoped>
.rozie-switch {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  cursor: pointer;
  font: inherit;
  -webkit-tap-highlight-color: transparent;
}
.rozie-switch:focus-visible {
  outline: var(--rozie-switch-focus-ring-width, 2px) solid var(--rozie-switch-focus-ring-color, rgba(0, 102, 204, 0.5));
  outline-offset: var(--rozie-switch-focus-ring-offset, 2px);
  border-radius: var(--rozie-switch-radius, 999px);
}
.rozie-switch--disabled {
  cursor: not-allowed;
  opacity: var(--rozie-switch-disabled-opacity, 0.55);
}
.rozie-switch-track {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  width: var(--rozie-switch-width, 2.75rem);
  height: var(--rozie-switch-height, 1.5rem);
  padding: var(--rozie-switch-track-padding, 0.125rem);
  background: var(--rozie-switch-off-bg, rgba(0, 0, 0, 0.25));
  border-radius: var(--rozie-switch-radius, 999px);
  transition: background-color 0.18s ease;
}
.rozie-switch--checked .rozie-switch-track {
  background: var(--rozie-switch-on-bg, #0066cc);
}
.rozie-switch-thumb {
  box-sizing: border-box;
  width: var(--rozie-switch-thumb-size, 1.25rem);
  height: var(--rozie-switch-thumb-size, 1.25rem);
  background: var(--rozie-switch-thumb-bg, #fff);
  border-radius: 50%;
  box-shadow: var(--rozie-switch-thumb-shadow, 0 1px 2px rgba(0, 0, 0, 0.3));
  transition: transform 0.18s ease;
  transform: translateX(0);
}
.rozie-switch--checked .rozie-switch-thumb {
  transform: translateX(var(--rozie-switch-thumb-travel, calc(2.75rem - 1.5rem)));
}
</style>
