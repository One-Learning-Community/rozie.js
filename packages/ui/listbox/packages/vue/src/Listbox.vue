<template>

<div :class="['rozie-listbox', { 'rozie-listbox-open': open$local, 'rozie-listbox-disabled': props.disabled }]" v-bind="$attrs">

  
  <div class="rozie-listbox-control" ref="controlElRef">
    <input v-if="props.combobox" ref="inputElRef" class="rozie-listbox-input" type="text" role="combobox" autocomplete="off" aria-autocomplete="list" :aria-expanded="open$local" :aria-controls="props.id + '-list'" :aria-activedescendant="activeDescendant" :aria-label="props.ariaLabel" :disabled="props.disabled" :placeholder="props.placeholder" :value="query" @input="onInput($event)" @keydown="onControlKeyDown($event)" @focus="open" /><button v-else ref="triggerElRef" type="button" class="rozie-listbox-trigger" role="combobox" aria-haspopup="listbox" :aria-expanded="open$local" :aria-controls="props.id + '-list'" :aria-activedescendant="activeDescendant" :aria-label="props.ariaLabel" :disabled="props.disabled" @click="toggle" @keydown="onControlKeyDown($event)">
      <slot name="selected" :selected="selectedLabel" :value="value">
        <span v-if="selectedLabel" class="rozie-listbox-selected">{{ selectedLabel }}</span><span v-else class="rozie-listbox-placeholder">{{ props.placeholder }}</span></slot>
      <span class="rozie-listbox-arrow" aria-hidden="true">▾</span>
    </button></div>

  
  <div v-if="open$local" ref="listElRef" class="rozie-listbox-list" role="listbox" :id="props.id + '-list'" :aria-label="props.ariaLabel" :aria-multiselectable="props.multiple">
    <div v-for="(opt, index) in visibleOptions()" :key="optionId(index)" :id="optionId(index)" :class="['rozie-listbox-option', { 'is-active': activeIndex === index, 'is-selected': isSelected(opt), 'is-disabled': disabledOf(opt) }]" role="option" :aria-selected="!!isSelected(opt)" :aria-disabled="!!disabledOf(opt)" @click="select(opt)" @mousemove="onOptionPointerMove(index)">
      <slot name="option" :option="opt" :index="index" :active="activeIndex === index" :selected="isSelected(opt)" :disabled="disabledOf(opt)">
        {{ labelOf(opt) }}
      </slot>
    </div>

    <div v-if="visibleOptions().length === 0" class="rozie-listbox-empty" role="presentation">
      <slot name="empty" :query="query">No options</slot>
    </div></div></div>

</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useOutsideClick } from '@rozie/runtime-vue';

const props = withDefaults(
  defineProps<{ options?: any[]; multiple?: boolean; combobox?: boolean; filterable?: boolean; disabled?: boolean; placeholder?: string; closeOnSelect?: boolean; optionLabel?: ((...args: any[]) => any) | null; optionValue?: ((...args: any[]) => any) | null; optionDisabled?: ((...args: any[]) => any) | null; id?: string; ariaLabel?: string | null }>(),
  { options: () => [], multiple: false, combobox: false, filterable: true, disabled: false, placeholder: '', closeOnSelect: true, optionLabel: null, optionValue: null, optionDisabled: null, id: 'rozie-listbox', ariaLabel: null }
);

const value = defineModel<unknown>('value', { default: null });

const emit = defineEmits<{
  'open-change': [...args: any[]];
  change: [...args: any[]];
  search: [...args: any[]];
}>();

defineSlots<{
  selected(props: { selected: any; value: any }): any;
  option(props: { option: any; index: any; active: any; selected: any; disabled: any }): any;
  empty(props: { query: any }): any;
}>();

const open$local = ref(false);
const activeIndex = ref(-1);
const query = ref('');

const controlElRef = ref<HTMLElement>();
const inputElRef = ref<HTMLInputElement>();
const triggerElRef = ref<HTMLButtonElement>();
const listElRef = ref<HTMLElement>();

const selectedLabel = computed(() => {
  const cur = value.value;
  if (props.multiple) {
    // Read the model value into a local before narrowing: `$props.value` lowers
    // to a `value()` accessor on Solid, and Array.isArray() can't narrow two
    // separate calls — narrowing one stable local works on every target.
    const arr = Array.isArray(cur) ? cur : [];
    if (arr.length === 0) return '';
    return props.options.filter((o: any) => arr.includes(valueOf(o))).map(labelOf).join(', ');
  }
  const match = props.options.find((o: any) => valueOf(o) === cur);
  return match === undefined ? '' : labelOf(match);
});
const activeDescendant = computed(() => {
  if (!open$local.value || activeIndex.value < 0) return null;
  return optionId(activeIndex.value);
});

// Type-ahead buffer for select-only (non-combobox) listboxes. Module-scope
// `let`s reassigned from handlers → the React emitter hoists them to `useRef`
// so they persist across renders (the setup-once guarantee); no-op elsewhere.
let typeBuffer = '';
let typeTimer: any = null;

// ---- option resolvers --------------------------------------------------
// ---- option resolvers --------------------------------------------------
const labelOf = (opt: any) => {
  if (props.optionLabel !== null) return props.optionLabel(opt);
  if (opt !== null && typeof opt === 'object' && 'label' in opt) return opt.label;
  return String(opt);
};
const valueOf = (opt: any) => {
  if (props.optionValue !== null) return props.optionValue(opt);
  if (opt !== null && typeof opt === 'object' && 'value' in opt) return opt.value;
  return opt;
};
const disabledOf = (opt: any) => {
  if (props.optionDisabled !== null) return !!props.optionDisabled(opt);
  if (opt !== null && typeof opt === 'object' && 'disabled' in opt) return !!opt.disabled;
  return false;
};
const optionId = (index: any) => props.id + '-opt-' + index;

// ---- derived state -----------------------------------------------------
// The visible option list: identity in select-only / non-filtering mode,
// a case-insensitive substring filter when a combobox query is present.
// A plain function (not `$computed`) so it reads uniformly across all six
// targets — a `$computed` is a value on React but an accessor on Solid, so
// aliasing it to a local (`const opts = visibleOptions()`) diverges; calling a
// plain function is identical everywhere.
// ---- derived state -----------------------------------------------------
// The visible option list: identity in select-only / non-filtering mode,
// a case-insensitive substring filter when a combobox query is present.
// A plain function (not `$computed`) so it reads uniformly across all six
// targets — a `$computed` is a value on React but an accessor on Solid, so
// aliasing it to a local (`const opts = visibleOptions()`) diverges; calling a
// plain function is identical everywhere.
const visibleOptions = () => {
  if (!props.combobox || !props.filterable) return props.options;
  const q = query.value.trim().toLowerCase();
  if (q === '') return props.options;
  return props.options.filter((opt: any) => labelOf(opt).toLowerCase().includes(q));
};

// The label shown in the (select-only) trigger when closed. A real `$computed`
// — read bare in the template, never aliased in script, so the per-target
// accessor form stays uniform.
// Is a given option currently selected? Multi compares array membership.
const isSelected = (opt: any) => {
  const v = valueOf(opt);
  const cur = value.value;
  if (props.multiple) return Array.isArray(cur) && cur.includes(v);
  return cur === v;
};

// First enabled visible index, preferring the currently-selected option.
// First enabled visible index, preferring the currently-selected option.
const resolveInitialActive = () => {
  const opts = visibleOptions();
  const sel = opts.findIndex((o: any) => isSelected(o) && !disabledOf(o));
  if (sel !== -1) return sel;
  return opts.findIndex((o: any) => !disabledOf(o));
};

// ---- focus / scroll helpers (post-mount $refs only) --------------------
// Named `focusControl` (not `focus`): a `focus` $expose verb would override the
// inherited HTMLElement.focus method on the Lit custom element.
// ---- focus / scroll helpers (post-mount $refs only) --------------------
// Named `focusControl` (not `focus`): a `focus` $expose verb would override the
// inherited HTMLElement.focus method on the Lit custom element.
const focusControl = () => {
  if (props.combobox) inputElRef.value?.focus();else triggerElRef.value?.focus();
};

// Keep the active option visible inside the scrolling listbox. Reads $refs in
// a post-mount callback only (never eagerly — ROZ123).
// Keep the active option visible inside the scrolling listbox. Reads $refs in
// a post-mount callback only (never eagerly — ROZ123).
const scrollActiveIntoView = () => {
  if (!listElRef.value || activeIndex.value < 0) return;
  const el = listElRef.value!.querySelector('#' + CSS.escape(optionId(activeIndex.value)));
  el?.scrollIntoView({
    block: 'nearest'
  });
};

// ---- open / close ------------------------------------------------------
// Single open-state mutator → the ONLY `$emit('open-change')` site, so the
// React prop-destructure for `onOpenChange` hoists exactly once.
// ---- open / close ------------------------------------------------------
// Single open-state mutator → the ONLY `$emit('open-change')` site, so the
// React prop-destructure for `onOpenChange` hoists exactly once.
const applyExpanded = (next: any) => {
  if (next && props.disabled) return;
  if (open$local.value === next) return;
  open$local.value = next;
  activeIndex.value = next ? resolveInitialActive() : -1;
  emit('open-change', {
    open: next
  });
};
const open = () => applyExpanded(true);
const close = () => applyExpanded(false);
const toggle = () => applyExpanded(!open$local.value);

// ---- selection ---------------------------------------------------------
// Single `$emit('change')` site (called from both select + clear).
// ---- selection ---------------------------------------------------------
// Single `$emit('change')` site (called from both select + clear).
const fireChange = (value: any, option: any) => emit('change', {
  value,
  option
});
const select = (opt: any) => {
  if (disabledOf(opt)) return;
  const v = valueOf(opt);
  if (props.multiple) {
    const cur = value.value;
    const arr = Array.isArray(cur) ? cur : [];
    // Fresh array on every commit — in-place mutation is dropped by the
    // React/Solid/Lit/Angular change detectors.
    const next = arr.includes(v) ? arr.filter((x: any) => x !== v) : [...arr, v];
    value.value = next;
    fireChange(next, opt);
  } else {
    value.value = v;
    fireChange(v, opt);
    if (props.closeOnSelect) {
      close();
      focusControl();
    }
  }
};
const clear = () => {
  const empty = props.multiple ? [] : null;
  value.value = empty;
  query.value = '';
  fireChange(empty, null);
};

// ---- keyboard navigation over the VISIBLE list -------------------------
// ---- keyboard navigation over the VISIBLE list -------------------------
const nextEnabled = (from: any, dir: any) => {
  const opts = visibleOptions();
  if (opts.length === 0) return -1;
  let i = from;
  for (let step = 0; step < opts.length; step++) {
    i += dir;
    if (i < 0) i = opts.length - 1;else if (i >= opts.length) i = 0;
    if (!disabledOf(opts[i])) return i;
  }
  return from;
};
const move = (dir: any) => {
  if (!open$local.value) {
    open();
    return;
  }
  const start = activeIndex.value < 0 ? dir > 0 ? -1 : 0 : activeIndex.value;
  activeIndex.value = nextEnabled(start, dir);
  scrollActiveIntoView();
};
const moveEdge = (toEnd: any) => {
  if (!open$local.value) open();
  activeIndex.value = toEnd ? nextEnabled(-1, -1) : nextEnabled(-1, 1);
  scrollActiveIntoView();
};
const commitActive = () => {
  const opts = visibleOptions();
  if (activeIndex.value >= 0 && activeIndex.value < opts.length) select(opts[activeIndex.value]);
};

// Type-ahead for select-only listboxes: accumulate keystrokes and jump to the
// first option whose label starts with the buffer.
// Type-ahead for select-only listboxes: accumulate keystrokes and jump to the
// first option whose label starts with the buffer.
const onTypeahead = (ch: any) => {
  if (typeTimer !== null) clearTimeout(typeTimer);
  typeBuffer += ch.toLowerCase();
  typeTimer = setTimeout(() => {
    typeBuffer = '';
  }, 600);
  const opts = visibleOptions();
  const idx = opts.findIndex((o: any) => !disabledOf(o) && labelOf(o).toLowerCase().startsWith(typeBuffer));
  if (idx !== -1) {
    if (!open$local.value) open();
    activeIndex.value = idx;
    scrollActiveIntoView();
  }
};

// Key handler shared by the trigger and the combobox input. The printable-
// character branch is reached only in select-only mode (the combobox input
// types through @input).
// Key handler shared by the trigger and the combobox input. The printable-
// character branch is reached only in select-only mode (the combobox input
// types through @input).
const onControlKeyDown = ($event: any) => {
  const key = $event.key;
  if (key === 'ArrowDown') {
    $event.preventDefault();
    move(1);
  } else if (key === 'ArrowUp') {
    $event.preventDefault();
    move(-1);
  } else if (key === 'Home') {
    $event.preventDefault();
    moveEdge(false);
  } else if (key === 'End') {
    $event.preventDefault();
    moveEdge(true);
  } else if (key === 'Enter') {
    if (open$local.value) {
      $event.preventDefault();
      commitActive();
    }
  } else if (key === 'Escape') {
    if (open$local.value) {
      $event.preventDefault();
      close();
      focusControl();
    }
  } else if (key === ' ' || key === 'Spacebar') {
    // Space toggles / commits in select-only mode; a combobox input needs the
    // literal space, so do nothing there.
    if (!props.combobox) {
      $event.preventDefault();
      if (!open$local.value) open();else commitActive();
    }
  } else if (key === 'Tab') {
    if (open$local.value) close();
  } else if (!props.combobox && key.length === 1 && !$event.metaKey && !$event.ctrlKey && !$event.altKey) {
    onTypeahead(key);
  }
};

// Combobox input handler: keep the popup open while typing, reset the active
// highlight to the first match, and surface the query for remote filtering.
// Combobox input handler: keep the popup open while typing, reset the active
// highlight to the first match, and surface the query for remote filtering.
const fireSearch = (query: any) => emit('search', {
  query
});
const onInput = ($event: any) => {
  // Use the fresh input value throughout — a re-read of `$data.query` right
  // after writing it is STALE on React (setState is async; the closure's
  // `query` is the pre-write value), so emit + filter off `q`, not `$data.query`.
  const q = $event.target.value;
  query.value = q;
  if (!open$local.value) open();
  activeIndex.value = nextEnabled(-1, 1);
  fireSearch(q);
};

// Pointer hover sets the virtual highlight (matches native <select> feel).
// Pointer hover sets the virtual highlight (matches native <select> feel).
const onOptionPointerMove = (index: any) => {
  if (activeIndex.value !== index) activeIndex.value = index;
};

onBeforeUnmount(() => {
  if (typeTimer !== null) clearTimeout(typeTimer);
});

defineExpose({ open, close, toggle, clear, focusControl });

useOutsideClick(
  [controlElRef, listElRef],
  () => close(),
  () => open$local.value,
);
</script>

<style scoped>
.rozie-listbox {
  position: relative;
  display: inline-block;
  min-width: var(--rozie-listbox-min-width, 12rem);
  font: var(--rozie-listbox-font, inherit);
}
.rozie-listbox-control { display: block; }
.rozie-listbox-input,
.rozie-listbox-trigger {
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-listbox-gap, 0.5rem);
  padding: var(--rozie-listbox-control-padding, 0.5rem 0.75rem);
  font: inherit;
  text-align: left;
  background: var(--rozie-listbox-bg, #fff);
  color: var(--rozie-listbox-fg, #1a1a1a);
  border: var(--rozie-listbox-border-width, 1px) solid var(--rozie-listbox-border, rgba(0, 0, 0, 0.2));
  border-radius: var(--rozie-listbox-radius, 6px);
  cursor: pointer;
}
.rozie-listbox-input { cursor: text; }
.rozie-listbox-input:focus-visible,
.rozie-listbox-input:focus,
.rozie-listbox-trigger:focus-visible,
.rozie-listbox-trigger:focus {
  outline: var(--rozie-listbox-ring-width, 2px) solid var(--rozie-listbox-ring, var(--rozie-listbox-accent, #0066cc));
  outline-offset: var(--rozie-listbox-ring-offset, 1px);
}
.rozie-listbox-disabled { opacity: var(--rozie-listbox-disabled-opacity, 0.6); pointer-events: none; }
.rozie-listbox-placeholder { color: var(--rozie-listbox-placeholder, rgba(0, 0, 0, 0.45)); }
.rozie-listbox-arrow {
  font-size: 0.75em;
  color: var(--rozie-listbox-arrow-color, currentColor);
  opacity: var(--rozie-listbox-arrow-opacity, 0.7);
}
.rozie-listbox-list {
  position: absolute;
  z-index: var(--rozie-listbox-z, 1000);
  top: calc(100% + var(--rozie-listbox-popup-offset, 4px));
  left: 0;
  right: 0;
  margin: 0;
  padding: var(--rozie-listbox-popup-padding, 0.25rem);
  max-height: var(--rozie-listbox-max-height, 16rem);
  overflow-y: auto;
  list-style: none;
  background: var(--rozie-listbox-popup-bg, var(--rozie-listbox-bg, #fff));
  color: var(--rozie-listbox-fg, #1a1a1a);
  border: var(--rozie-listbox-border-width, 1px) solid var(--rozie-listbox-popup-border, var(--rozie-listbox-border, rgba(0, 0, 0, 0.15)));
  border-radius: var(--rozie-listbox-popup-radius, var(--rozie-listbox-radius, 6px));
  box-shadow: var(--rozie-listbox-shadow, 0 6px 24px rgba(0, 0, 0, 0.12));
}
.rozie-listbox-option {
  padding: var(--rozie-listbox-option-padding, 0.4rem 0.6rem);
  border-radius: var(--rozie-listbox-option-radius, 4px);
  color: var(--rozie-listbox-option-fg, inherit);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-listbox-gap, 0.5rem);
}
.rozie-listbox-option.is-active {
  background: var(--rozie-listbox-active-bg, rgba(0, 102, 204, 0.12));
  color: var(--rozie-listbox-active-fg, inherit);
}
.rozie-listbox-option.is-selected {
  background: var(--rozie-listbox-selected-bg, transparent);
  color: var(--rozie-listbox-selected-fg, inherit);
  font-weight: var(--rozie-listbox-selected-weight, 600);
}
.rozie-listbox-option.is-selected::after {
  content: var(--rozie-listbox-check, '✓');
  color: var(--rozie-listbox-check-color, var(--rozie-listbox-accent, #0066cc));
}
.rozie-listbox-option.is-disabled { opacity: var(--rozie-listbox-disabled-opacity, 0.45); cursor: not-allowed; }
.rozie-listbox-empty { padding: var(--rozie-listbox-option-padding, 0.5rem 0.6rem); color: var(--rozie-listbox-empty-fg, rgba(0, 0, 0, 0.5)); }
</style>
