<template>

<div :class="['rozie-combobox', { 'rozie-combobox--open': isOpen, 'rozie-combobox--disabled': props.disabled }]" v-bind="$attrs">
  <input ref="inputElRef" class="rozie-combobox-input" type="text" role="combobox" aria-autocomplete="list" :aria-expanded="!!isOpen" :aria-controls="listId()" :aria-activedescendant="activeId()" :aria-label="props.ariaLabel" :value="query" :placeholder="props.placeholder" :disabled="!!props.disabled" autocomplete="off" @input="onInput($event)" @focus="onFocus($event)" @blur="onBlur()" @keydown="onKeydown($event)" />

  <ul v-if="isOpen && filteredOptions().length > 0" class="rozie-combobox-list" :id="listId()" role="listbox">
    <li v-for="opt in filteredOptions()" :key="opt.value" :class="['rozie-combobox-option', { 'rozie-combobox-option--active': opt._i === activeIndex, 'rozie-combobox-option--selected': opt.value === value, 'rozie-combobox-option--disabled': opt.disabled }]" :id="optId(opt._i)" role="option" :aria-selected="opt.value === value" :aria-disabled="!!opt.disabled" @mousedown.prevent="selectOption(opt)" @mouseenter="activeIndex = opt._i">
      <slot name="option" :option="opt" :active="opt._i === activeIndex" :selected="opt.value === value">{{ opt.label }}</slot>
    </li>
  </ul></div>

</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The option list — `[{ value, label, disabled? }]`. `label` is the displayed text (and what client filtering matches against), `value` is what `r-model:value` reads and writes, and an optional `disabled` flag makes an option non-selectable.
     */
    options?: any[];
    /**
     * Placeholder text shown in the input while it is empty.
     */
    placeholder?: string;
    /**
     * Disable the control — the input becomes non-interactive and the popup cannot be opened. Also sets the Angular `ControlValueAccessor` disabled state.
     */
    disabled?: boolean;
    /**
     * Opt **out** of built-in client filtering (async / server-side mode): render `options` exactly as supplied and rely on the `search` event to refetch. By default the component filters `options` by `label`, case-insensitively, against the typed query.
     */
    disableFilter?: boolean;
    /**
     * Accessible name for the input (`aria-label`), used when there is no visible `<label for>` pointing at it. Provide this (or an external label) so the combobox is announced.
     */
    ariaLabel?: string | null;
    /**
     * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one combobox shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
     */
    idBase?: string;
  }>(),
  { options: () => [], placeholder: '', disabled: false, disableFilter: false, ariaLabel: null, idBase: 'rozie-combobox' }
);

/**
 * The selected option's value (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a combobox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `null` when nothing is selected.
 * @example
 * <Combobox r-model:value="country" :options="countries" />
 */
const value = defineModel<unknown>('value', { default: null });

const emit = defineEmits<{
  change: [...args: any[]];
  search: [...args: any[]];
}>();

defineSlots<{
  option(props: { option: any; active: any; selected: any }): any;
}>();

const query = ref('');
const isOpen = ref(false);
const activeIndex = ref(-1);

const inputElRef = ref<HTMLInputElement>();

// ---- derived view (plain functions, uniform ×6) ------------------------
// The filtered option list, each carrying its filtered-list index `_i`. A plain
// function (called in the r-for AND handlers) — never $computed.
const filteredOptions = () => {
  const opts = Array.isArray(props.options) ? props.options : [];
  let list = opts;
  if (!props.disableFilter) {
    const q = query.value.toLowerCase();
    if (q) list = opts.filter((o: any) => String(o.label).toLowerCase().indexOf(q) !== -1);
  }
  return list.map((o: any, i: any) => ({
    value: o.value,
    label: o.label,
    disabled: !!o.disabled,
    _i: i
  }));
};
const optId = (i: any) => props.idBase + '-opt-' + i;
const listId = () => props.idBase + '-list';

// The active option's id for aria-activedescendant (null when none).
// The active option's id for aria-activedescendant (null when none).
const activeId = () => {
  const list = filteredOptions();
  if (isOpen.value && activeIndex.value >= 0 && list[activeIndex.value]) return optId(activeIndex.value);
  return null;
};

// Next selectable index in `dir` (+1/-1), skipping disabled, clamped to ends.
// Next selectable index in `dir` (+1/-1), skipping disabled, clamped to ends.
const nextEnabled = (list: any, from: any, dir: any) => {
  let i = from;
  for (let step = 0; step < list.length; step++) {
    i = i + dir;
    if (i < 0) i = 0;
    if (i >= list.length) i = list.length - 1;
    if (list[i] && !list[i].disabled) return i;
    if (dir < 0 && i === 0 || dir > 0 && i === list.length - 1) break;
  }
  return from;
};

// ---- selection (writes the model + syncs query) ------------------------
// ---- selection (writes the model + syncs query) ------------------------
const selectOption = (opt: any) => {
  if (!opt || opt.disabled) return;
  value.value = opt.value;
  query.value = String(opt.label);
  isOpen.value = false;
  activeIndex.value = -1;
  emit('change', {
    value: opt.value
  });
};

// Reflect the externally-selected value into the input text.
// Reflect the externally-selected value into the input text.
const syncQueryToValue = () => {
  const opts = Array.isArray(props.options) ? props.options : [];
  const opt = opts.find((o: any) => o.value === value.value);
  query.value = opt ? String(opt.label) : '';
};

// ---- input + keyboard handlers -----------------------------------------
// ---- input + keyboard handlers -----------------------------------------
const onInput = (e: any) => {
  const q = e && e.target ? e.target.value : '';
  query.value = q;
  isOpen.value = true;
  activeIndex.value = 0;
  emit('search', {
    query: q
  });
};
const onFocus = (e: any) => {
  isOpen.value = true;
  if (e && e.target && e.target.select) e.target.select();
};

// @blur closes the popup. Option selection uses @mousedown.prevent, which keeps
// focus on the input, so a click on an option does NOT blur-close before select.
// @blur closes the popup. Option selection uses @mousedown.prevent, which keeps
// focus on the input, so a click on an option does NOT blur-close before select.
const onBlur = () => {
  isOpen.value = false;
};
const onKeydown = (e: any) => {
  const key = e ? e.key : '';
  const list = filteredOptions();
  // Capture the reactive reads into locals BEFORE any write so React never binds
  // a pre-write value (ROZ138; the read-then-write-same-key idiom). Each branch
  // is mutually exclusive, but a flow-insensitive analysis can't see that.
  const wasOpen = isOpen.value;
  const ai = activeIndex.value;
  if (key === 'ArrowDown') {
    if (e) e.preventDefault();
    if (!wasOpen) {
      isOpen.value = true;
      activeIndex.value = 0;
      return;
    }
    activeIndex.value = nextEnabled(list, ai, 1);
  } else if (key === 'ArrowUp') {
    if (e) e.preventDefault();
    if (!wasOpen) {
      isOpen.value = true;
      return;
    }
    activeIndex.value = nextEnabled(list, ai, -1);
  } else if (key === 'Enter') {
    if (wasOpen && ai >= 0 && list[ai]) {
      if (e) e.preventDefault();
      selectOption(list[ai]);
    }
  } else if (key === 'Escape') {
    if (wasOpen) {
      if (e) e.preventDefault();
      isOpen.value = false;
    }
  } else if (key === 'Home') {
    if (wasOpen) {
      if (e) e.preventDefault();
      activeIndex.value = nextEnabled(list, -1, 1);
    }
  } else if (key === 'End') {
    if (wasOpen) {
      if (e) e.preventDefault();
      activeIndex.value = nextEnabled(list, list.length, -1);
    }
  }
};

// ---- lifecycle + imperative handle -------------------------------------
// focus() — focus the input (accepted ROZ137 Lit override). clear() — reset the
// selection + query. Both post-mount → $refs safe.
const focus = () => inputElRef.value?.focus();
const clear = () => {
  value.value = null;
  query.value = '';
  activeIndex.value = -1;
  emit('change', {
    value: null
  });
};

onMounted(() => {
  syncQueryToValue();
});

watch(() => value.value, () => {
  syncQueryToValue();
});

defineExpose({ focus, clear });
</script>

<style scoped>
.rozie-combobox {
  position: relative;
  display: inline-block;
  width: var(--rozie-combobox-width, 16rem);
  font: var(--rozie-combobox-font, inherit);
}
.rozie-combobox-input {
  box-sizing: border-box;
  width: 100%;
  padding: var(--rozie-combobox-input-padding, 0.5rem 0.75rem);
  font: inherit;
  color: var(--rozie-combobox-color, inherit);
  background: var(--rozie-combobox-bg, #fff);
  border: var(--rozie-combobox-border-width, 1px) solid var(--rozie-combobox-border-color, rgba(0, 0, 0, 0.25));
  border-radius: var(--rozie-combobox-radius, 0.5rem);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.rozie-combobox-input:focus {
  border-color: var(--rozie-combobox-accent, #0066cc);
  box-shadow: 0 0 0 var(--rozie-combobox-focus-ring-width, 3px) var(--rozie-combobox-focus-ring-color, rgba(0, 102, 204, 0.25));
}
.rozie-combobox--disabled .rozie-combobox-input {
  cursor: not-allowed;
  opacity: var(--rozie-combobox-disabled-opacity, 0.55);
  background: var(--rozie-combobox-disabled-bg, rgba(0, 0, 0, 0.04));
}
.rozie-combobox-list {
  position: absolute;
  z-index: var(--rozie-combobox-list-z, 50);
  top: calc(100% + var(--rozie-combobox-list-gap, 0.25rem));
  left: 0;
  right: 0;
  margin: 0;
  padding: var(--rozie-combobox-list-padding, 0.25rem);
  list-style: none;
  max-height: var(--rozie-combobox-list-max-height, 16rem);
  overflow-y: auto;
  background: var(--rozie-combobox-list-bg, #fff);
  border: var(--rozie-combobox-border-width, 1px) solid var(--rozie-combobox-list-border-color, rgba(0, 0, 0, 0.15));
  border-radius: var(--rozie-combobox-radius, 0.5rem);
  box-shadow: var(--rozie-combobox-list-shadow, 0 10px 24px rgba(0, 0, 0, 0.16));
}
.rozie-combobox-option {
  padding: var(--rozie-combobox-option-padding, 0.4rem 0.6rem);
  border-radius: var(--rozie-combobox-option-radius, 0.375rem);
  cursor: pointer;
  color: var(--rozie-combobox-option-color, inherit);
}
.rozie-combobox-option--active {
  background: var(--rozie-combobox-option-active-bg, rgba(0, 102, 204, 0.12));
}
.rozie-combobox-option--selected {
  font-weight: var(--rozie-combobox-option-selected-weight, 600);
  color: var(--rozie-combobox-option-selected-color, var(--rozie-combobox-accent, #0066cc));
}
.rozie-combobox-option--disabled {
  cursor: not-allowed;
  opacity: var(--rozie-combobox-option-disabled-opacity, 0.45);
}
</style>
