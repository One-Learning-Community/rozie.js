<template>

<div v-if="open" class="rozie-command-palette" @click="onBackdropClick($event)">
  <div class="rozie-command-palette-panel" role="dialog" aria-modal="true" :aria-label="props.ariaLabel" @keydown="onKeydown($event)">
    <div class="rozie-command-palette-search">
      <input ref="inputElRef" class="rozie-command-palette-input" type="text" role="combobox" aria-autocomplete="list" :id="inputId()" :aria-expanded="!!open" :aria-controls="listId()" :aria-activedescendant="activeId()" :aria-label="props.ariaLabel" :value="query" :placeholder="props.placeholder" autocomplete="off" @input="onInput($event)" />
    </div>

    <ul v-if="filteredItems().length > 0" class="rozie-command-palette-list" :id="listId()" role="listbox" :aria-label="props.ariaLabel">
      <li v-for="item in filteredItems()" :key="item.id" :class="['rozie-command-palette-option', { 'rozie-command-palette-option--active': item._i === activeIndex, 'rozie-command-palette-option--disabled': item.disabled }]" :id="optId(item._i)" role="option" :aria-selected="item._i === activeIndex" :aria-disabled="!!item.disabled" @mousedown.prevent="selectItem(item)" @mouseenter="activeIndex = item._i">
        <slot name="item" :item="item" :active="item._i === activeIndex">
          <span class="rozie-command-palette-option-label">{{ item.label }}</span>
          <span v-if="item.group" class="rozie-command-palette-option-group">{{ item.group }}</span></slot>
      </li>
    </ul><div v-if="filteredItems().length === 0" class="rozie-command-palette-empty">
      <slot name="empty">{{ props.emptyText }}</slot>
    </div><div v-if="$slots.footer" class="rozie-command-palette-footer">
      <slot name="footer"></slot>
    </div></div>
</div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The command list — `[{ id, label, group?, keywords?, disabled? }]`. `label` is the displayed (and filtered) text; `id` is a stable key passed back on `select`; optional `group` buckets items under a heading; optional `keywords` are extra strings the query also matches; an optional `disabled` flag styles an item and skips it for selection/navigation.
     */
    items?: any[];
    /**
     * Placeholder text shown in the search input while the query is empty.
     */
    placeholder?: string;
    /**
     * Text shown when the query matches no items. Override the whole empty state with the `empty` slot when you need richer markup.
     */
    emptyText?: string;
    /**
     * Whether choosing an item closes the palette. Defaults to `true` (the cmdk convention); set to `false` to keep the palette open after a selection — e.g. for a multi-action menu where the user runs several commands in a row.
     */
    closeOnSelect?: boolean;
    /**
     * Accessible name for the dialog surface (`aria-label` on the `role="dialog"` panel). Override it to match the palette's purpose (e.g. "Search commands").
     */
    ariaLabel?: string;
    /**
     * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
     */
    idBase?: string;
  }>(),
  { items: () => [], placeholder: 'Type a command…', emptyText: 'No results.', closeOnSelect: true, ariaLabel: 'Command palette', idBase: 'rozie-command-palette' }
);

/**
 * Whether the palette overlay is shown (two-way `r-model`). Two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`); every close path (backdrop click, Escape, selecting an item when `closeOnSelect`, the imperative `close()`) writes `open = false`. As one of two `model: true` props the component does not generate an Angular `ControlValueAccessor`.
 * @example
 * <CommandPalette r-model:open="paletteOpen" :items="commands" />
 */
const open = defineModel<boolean>('open', { default: false });
/**
 * The current search text (two-way `r-model`). Two-way bind it to read or pre-seed the query; the component filters `items` by this string over each item `label` plus its `keywords`. Cleared to `""` whenever the palette opens.
 */
const query = defineModel<string>('query', { default: '' });

const emit = defineEmits<{
  select: [...args: any[]];
}>();

defineSlots<{
  item(props: { item: any; active: any }): any;
  empty(props: {  }): any;
  footer(props: {  }): any;
}>();

const activeIndex = ref(0);

const inputElRef = ref<HTMLInputElement>();

import { filterCommands } from './internal/filterCommands';

// ---- derived views (plain functions, uniform ×6) -----------------------
// The filtered command list, each carrying its filtered-list index `_i`. A plain
// function (called from the r-for AND handlers) — never $computed.
// ---- derived views (plain functions, uniform ×6) -----------------------
// The filtered command list, each carrying its filtered-list index `_i`. A plain
// function (called from the r-for AND handlers) — never $computed.
const filteredItems = () => {
  const src = Array.isArray(props.items) ? props.items : [];
  const list = filterCommands(src, query.value);
  return list.map((it: any, i: any) => ({
    id: it.id,
    label: it.label,
    group: it.group,
    keywords: it.keywords,
    disabled: !!it.disabled,
    _i: i
  }));
};
const optId = (i: any) => props.idBase + '-opt-' + i;
const listId = () => props.idBase + '-list';
const inputId = () => props.idBase + '-input';

// The active option's id for aria-activedescendant (null when none).
// The active option's id for aria-activedescendant (null when none).
const activeId = () => {
  const list = filteredItems();
  if (activeIndex.value >= 0 && list[activeIndex.value]) return optId(activeIndex.value);
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

// First selectable index (or 0). Used to reset the highlight on open / re-filter.
// First selectable index (or 0). Used to reset the highlight on open / re-filter.
const firstEnabled = (list: any) => {
  for (let i = 0; i < list.length; i++) {
    if (list[i] && !list[i].disabled) return i;
  }
  return 0;
};

// ---- close funnel ------------------------------------------------------
// ---- close funnel ------------------------------------------------------
const closePalette = () => {
  open.value = false;
};

// ---- selection ---------------------------------------------------------
// ---- selection ---------------------------------------------------------
const selectItem = (item: any) => {
  if (!item || item.disabled) return;
  emit('select', {
    id: item.id,
    label: item.label,
    group: item.group
  });
  if (props.closeOnSelect) closePalette();
};

// ---- input + keyboard handlers -----------------------------------------
// ---- input + keyboard handlers -----------------------------------------
const onInput = (e: any) => {
  const q = e && e.target ? e.target.value : '';
  query.value = q;
  // Reset the highlight to the first enabled item of the NEW filtered list.
  const next = filterCommands(Array.isArray(props.items) ? props.items : [], q);
  activeIndex.value = firstEnabled(next);
};
const onKeydown = (e: any) => {
  const key = e ? e.key : '';
  const list = filteredItems();
  const ai = activeIndex.value;
  if (key === 'ArrowDown') {
    if (e) e.preventDefault();
    activeIndex.value = nextEnabled(list, ai, 1);
  } else if (key === 'ArrowUp') {
    if (e) e.preventDefault();
    activeIndex.value = nextEnabled(list, ai, -1);
  } else if (key === 'Home') {
    if (e) e.preventDefault();
    activeIndex.value = nextEnabled(list, -1, 1);
  } else if (key === 'End') {
    if (e) e.preventDefault();
    activeIndex.value = nextEnabled(list, list.length, -1);
  } else if (key === 'Enter') {
    if (ai >= 0 && list[ai]) {
      if (e) e.preventDefault();
      selectItem(list[ai]);
    }
  } else if (key === 'Escape') {
    if (e) e.preventDefault();
    closePalette();
  }
};

// Backdrop click: a click whose target IS the backdrop (not the panel/children).
// Backdrop click: a click whose target IS the backdrop (not the panel/children).
const onBackdropClick = (e: any) => {
  if (e && e.target === e.currentTarget) closePalette();
};

// ---- open/close reconcile ----------------------------------------------
// On open: clear the query, reset the highlight, focus the input (post-mount →
// $refs safe). Reading $refs here is ROZ123-safe (this runs from $onMount and
// the lazy $watch callback, both post-mount).
// ---- open/close reconcile ----------------------------------------------
// On open: clear the query, reset the highlight, focus the input (post-mount →
// $refs safe). Reading $refs here is ROZ123-safe (this runs from $onMount and
// the lazy $watch callback, both post-mount).
const onOpen = () => {
  query.value = '';
  activeIndex.value = firstEnabled(filterCommands(Array.isArray(props.items) ? props.items : [], ''));
  const el = inputElRef.value;
  if (el && el.focus) {
    // Defer a tick so the overlay is mounted before focusing.
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        const again = inputElRef.value;
        if (again && again.focus) again.focus();
      });
    } else {
      el.focus();
    }
  }
};

// ---- lifecycle ---------------------------------------------------------
// ---- imperative handle -------------------------------------------------
// show()/close()/toggle() drive the `open` model. The OPEN verb is `show` (NOT
// `open`) — an `open` verb collides with the `open` model on React (both collapse
// onto the generated open/setOpen state). focus() focuses the input (accepted
// ROZ137 Lit override). All post-mount → $refs safe.
const show = () => {
  open.value = true;
};
const close = () => {
  closePalette();
};
const toggle = () => {
  open.value = !open.value;
};
const focus = () => inputElRef.value?.focus();

onMounted(() => {
  if (open.value) onOpen();
});

watch(() => open.value, (isOpen: any) => {
  if (isOpen) onOpen();
});

defineExpose({ show, close, toggle, focus });
</script>

<style scoped>
.rozie-command-palette {
  position: fixed;
  inset: 0;
  z-index: var(--rozie-command-palette-z, 1000);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--rozie-command-palette-overlay-padding, 12vh 1rem 1rem);
  background: var(--rozie-command-palette-backdrop-bg, rgba(0, 0, 0, 0.5));
  backdrop-filter: var(--rozie-command-palette-backdrop-filter, none);
}
.rozie-command-palette-panel {
  display: flex;
  flex-direction: column;
  width: var(--rozie-command-palette-width, min(40rem, 100%));
  max-height: var(--rozie-command-palette-max-height, 70vh);
  overflow: hidden;
  font: var(--rozie-command-palette-font, inherit);
  color: var(--rozie-command-palette-color, inherit);
  background: var(--rozie-command-palette-bg, #fff);
  border: var(--rozie-command-palette-border, none);
  border-radius: var(--rozie-command-palette-radius, 0.75rem);
  box-shadow: var(--rozie-command-palette-shadow, 0 10px 38px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.25));
}
.rozie-command-palette-search {
  padding: var(--rozie-command-palette-search-padding, 0.75rem);
  border-bottom: var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1));
}
.rozie-command-palette-input {
  box-sizing: border-box;
  width: 100%;
  padding: var(--rozie-command-palette-input-padding, 0.5rem 0.75rem);
  font: inherit;
  font-size: var(--rozie-command-palette-input-font-size, 1.05rem);
  color: inherit;
  background: var(--rozie-command-palette-input-bg, transparent);
  border: var(--rozie-command-palette-input-border, none);
  border-radius: var(--rozie-command-palette-input-radius, 0.5rem);
  outline: none;
}
.rozie-command-palette-list {
  margin: 0;
  padding: var(--rozie-command-palette-list-padding, 0.5rem);
  list-style: none;
  overflow-y: auto;
}
.rozie-command-palette-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-command-palette-option-gap, 0.75rem);
  padding: var(--rozie-command-palette-option-padding, 0.5rem 0.625rem);
  border-radius: var(--rozie-command-palette-option-radius, 0.5rem);
  cursor: pointer;
  color: var(--rozie-command-palette-option-color, inherit);
}
.rozie-command-palette-option--active {
  background: var(--rozie-command-palette-option-active-bg, rgba(0, 102, 204, 0.12));
  color: var(--rozie-command-palette-option-active-color, inherit);
}
.rozie-command-palette-option--disabled {
  cursor: not-allowed;
  opacity: var(--rozie-command-palette-option-disabled-opacity, 0.45);
}
.rozie-command-palette-option-group {
  font-size: var(--rozie-command-palette-group-font-size, 0.75rem);
  color: var(--rozie-command-palette-group-color, rgba(0, 0, 0, 0.5));
  text-transform: var(--rozie-command-palette-group-transform, uppercase);
  letter-spacing: 0.04em;
}
.rozie-command-palette-empty {
  padding: var(--rozie-command-palette-empty-padding, 1.5rem);
  text-align: center;
  color: var(--rozie-command-palette-empty-color, rgba(0, 0, 0, 0.5));
}
.rozie-command-palette-footer {
  padding: var(--rozie-command-palette-footer-padding, 0.5rem 0.75rem);
  border-top: var(--rozie-command-palette-border-width, 1px) solid var(--rozie-command-palette-divider-color, rgba(0, 0, 0, 0.1));
  font-size: var(--rozie-command-palette-footer-font-size, 0.8125rem);
  color: var(--rozie-command-palette-footer-color, rgba(0, 0, 0, 0.55));
}
</style>
