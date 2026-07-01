<template>

<div v-if="open" class="rozie-command-palette" @click="onBackdropClick($event)">
  <div ref="panelRef" class="rozie-command-palette-panel" role="dialog" aria-modal="true" :aria-label="props.ariaLabel" @keydown="onPanelKeydown($event)">
    
    <Combobox ref="comboboxRef" :inline="true" :disable-filter="true" :close-on-select="false" :options="filteredItems()" :option-value="commandValue" :option-disabled="commandDisabled" :placeholder="props.placeholder" :aria-label="props.ariaLabel" :id-base="props.idBase" v-model:value="activeValue" @change="onComboboxChange($event)" @search="onComboboxSearch($event)"><template #option="{ option, index, active, selected, disabled }">
        <slot name="option" :option="option" :index="index" :active="active" :selected="selected" :disabled="disabled">
          <div class="rozie-command-palette-option">
            <span class="rozie-command-palette-option-label">{{ labelText(option) }}</span>
            <span v-if="groupText(option)" class="rozie-command-palette-option-group">{{ groupText(option) }}</span></div>
        </slot>
      </template><template #empty="{ query }">
        <slot name="empty" :query="query">{{ props.emptyText }}</slot>
      </template></Combobox>

    
    <div v-if="$slots.footer" class="rozie-command-palette-footer">
      <slot name="footer"></slot>
    </div></div>
</div>
</template>

<script setup lang="ts">
import Combobox from './Combobox.vue';

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
     * Id base for the combobox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one palette shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
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
  option(props: { option: any; index: any; active: any; selected: any; disabled: any }): any;
  empty(props: { query: any }): any;
  footer(props: {  }): any;
}>();

const activeValue = ref<any>(null);

const panelRef = ref<HTMLElement>();
const comboboxRef = ref<InstanceType<typeof Combobox>>();

import { filterCommands } from './internal/filterCommands';

// ---- derived views (plain functions, uniform ×6) -----------------------
// The filtered command list fed to the vendored <Combobox> as its `:options`.
// command-palette KEEPS its own label+keywords filter (filterCommands, A1) and
// runs <Combobox :filterable="false"> — combobox's built-in filter is label-only
// substring and would drop the keyword matching + source-order grouping. A plain
// function (called from the template binding AND handlers) — never $computed (the
// combobox value-vs-accessor split). Each item is passed through verbatim; combobox
// resolves its value via `optionValue` (below) and its label via `.label`.
// ---- derived views (plain functions, uniform ×6) -----------------------
// The filtered command list fed to the vendored <Combobox> as its `:options`.
// command-palette KEEPS its own label+keywords filter (filterCommands, A1) and
// runs <Combobox :filterable="false"> — combobox's built-in filter is label-only
// substring and would drop the keyword matching + source-order grouping. A plain
// function (called from the template binding AND handlers) — never $computed (the
// combobox value-vs-accessor split). Each item is passed through verbatim; combobox
// resolves its value via `optionValue` (below) and its label via `.label`.
const filteredItems = () => {
  const src = Array.isArray(props.items) ? props.items : [];
  return filterCommands(src, query.value);
};

// The vendored <Combobox> commits the OPTION's value; resolve each command's value
// to its stable `id` (the key passed back on `select`). disabled is resolved off
// the item's own `disabled` flag (combobox's default `.disabled` fallback already
// handles it, but we pass an explicit resolver for clarity + safety on primitives).
// The vendored <Combobox> commits the OPTION's value; resolve each command's value
// to its stable `id` (the key passed back on `select`). disabled is resolved off
// the item's own `disabled` flag (combobox's default `.disabled` fallback already
// handles it, but we pass an explicit resolver for clarity + safety on primitives).
const commandValue = (it: any) => it && it.id !== undefined ? it.id : it;
const commandDisabled = (it: any) => !!(it && it.disabled);

// Default-fill display helpers. The re-projected #option scope param `option`
// threads as `unknown` on the Lit leaf (the cross-target slot-param-type gap), so
// the default fill content reads its label/group through these UNTYPED helpers
// (neutralized to `any`) rather than `option.label` directly — keeps the Lit leaf
// typechecking without a per-target cast.
// Default-fill display helpers. The re-projected #option scope param `option`
// threads as `unknown` on the Lit leaf (the cross-target slot-param-type gap), so
// the default fill content reads its label/group through these UNTYPED helpers
// (neutralized to `any`) rather than `option.label` directly — keeps the Lit leaf
// typechecking without a per-target cast.
const labelText = (o: any) => o && o.label !== undefined ? o.label : '';
const groupText = (o: any) => o && o.group !== undefined ? o.group : '';

// ---- close funnel ------------------------------------------------------
// ---- close funnel ------------------------------------------------------
const closePalette = () => {
  open.value = false;
};

// ---- selection ---------------------------------------------------------
// Combobox's `@change` fires `{ value, option }` on each commit. Re-emit the
// PUBLIC `select` event with the chosen command and (optionally) close. The
// `option` IS the original command item (we feed items straight through as
// combobox options), so read its id/label/group directly.
// ---- selection ---------------------------------------------------------
// Combobox's `@change` fires `{ value, option }` on each commit. Re-emit the
// PUBLIC `select` event with the chosen command and (optionally) close. The
// `option` IS the original command item (we feed items straight through as
// combobox options), so read its id/label/group directly.
const onComboboxChange = (e: any) => {
  const item = e ? e.option : null;
  if (!item || item.disabled) return;
  emit('select', {
    id: item.id,
    label: item.label,
    group: item.group
  });
  // Clear the internal selection so re-selecting the same command re-fires.
  activeValue.value = null;
  if (props.closeOnSelect) closePalette();
};

// Combobox's `@search` fires `{ query }` as the user types in its combobox input.
// Pipe it into command-palette's own two-way `query` model — `filteredItems()`
// then re-filters via filterCommands (keyword-aware). Capture the fresh value
// (never re-read a just-written $data/$model key on React — it is stale).
// Combobox's `@search` fires `{ query }` as the user types in its combobox input.
// Pipe it into command-palette's own two-way `query` model — `filteredItems()`
// then re-filters via filterCommands (keyword-aware). Capture the fresh value
// (never re-read a just-written $data/$model key on React — it is stale).
const onComboboxSearch = (e: any) => {
  query.value = e && e.query !== undefined ? e.query : '';
};

// Backdrop click: a click whose target IS the backdrop (not the panel/children).
// Backdrop click: a click whose target IS the backdrop (not the panel/children).
const onBackdropClick = (e: any) => {
  if (e && e.target === e.currentTarget) closePalette();
};

// ---- open/close reconcile ----------------------------------------------
// Focus the vendored <Combobox>'s search <input> via its exposed `focus` handle
// verb (Combobox.rozie:578 `$expose({ focus, clear })`). Focusing it fires the
// combobox's `@focus="open"` → the popup opens (the screenshot demo seeds the
// palette open, so this runs on mount). `$refs.combobox` is the composed child's
// TYPED handle across all 6 targets (Phase 66 composed-component-ref → handle
// typing), so `focus()` typechecks and resolves to the child's exposed verb —
// including on Lit, where this RETIRES the former `<rozie-combobox>` open-shadow-
// root DOM pierce that only existed because the composed ref used to type as a
// bare HTMLElement.
// $refs read in a post-mount callback only (ROZ123-safe).
// ---- open/close reconcile ----------------------------------------------
// Focus the vendored <Combobox>'s search <input> via its exposed `focus` handle
// verb (Combobox.rozie:578 `$expose({ focus, clear })`). Focusing it fires the
// combobox's `@focus="open"` → the popup opens (the screenshot demo seeds the
// palette open, so this runs on mount). `$refs.combobox` is the composed child's
// TYPED handle across all 6 targets (Phase 66 composed-component-ref → handle
// typing), so `focus()` typechecks and resolves to the child's exposed verb —
// including on Lit, where this RETIRES the former `<rozie-combobox>` open-shadow-
// root DOM pierce that only existed because the composed ref used to type as a
// bare HTMLElement.
// $refs read in a post-mount callback only (ROZ123-safe).
const focusInput = () => {
  comboboxRef.value?.focus();
};

// On open: clear the query + internal selection, then focus the search input.
// Runs from $onMount and the lazy open $watch callback, both post-mount.
// On open: clear the query + internal selection, then focus the search input.
// Runs from $onMount and the lazy open $watch callback, both post-mount.
const onOpen = () => {
  query.value = '';
  activeValue.value = null;
  // Defer a tick so the overlay + <Combobox> are mounted before focusing.
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      focusInput();
    });
  } else {
    focusInput();
  }
};

// ---- lifecycle ---------------------------------------------------------
// Escape closes from anywhere in the panel (the vendored <Combobox> only closes
// its own popup on Escape; the palette overlay close is command-palette's).
const onPanelKeydown = (e: any) => {
  if (e && e.key === 'Escape') {
    e.preventDefault();
    closePalette();
  }
};

// ---- imperative handle -------------------------------------------------
// show()/close()/toggle() drive the `open` model. The OPEN verb is `show` (NOT
// `open`) — an `open` verb collides with the `open` model on React (both collapse
// onto the generated open/setOpen state). focus() focuses the vendored combobox's
// control via its exposed handle (accepted ROZ137 Lit override). All post-mount →
// $refs safe.
// ---- imperative handle -------------------------------------------------
// show()/close()/toggle() drive the `open` model. The OPEN verb is `show` (NOT
// `open`) — an `open` verb collides with the `open` model on React (both collapse
// onto the generated open/setOpen state). focus() focuses the vendored combobox's
// control via its exposed handle (accepted ROZ137 Lit override). All post-mount →
// $refs safe.
const show = () => {
  open.value = true;
};
const close = () => {
  closePalette();
};
const toggle = () => {
  open.value = !open.value;
};
const focus = () => focusInput();

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
