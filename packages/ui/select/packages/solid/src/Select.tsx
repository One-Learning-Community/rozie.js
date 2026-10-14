import type { JSX } from 'solid-js';
import { Show, createEffect, createMemo, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { __rozieInjectStyle, createControllableSignal, createOutsideClick, parseInlineStyle, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
import Popover from '@rozie-ui/popover-solid';
// ---- option grouping (src/internal/groupOptions.ts) ---------------------
// The pure stable-partition helper is a RUNTIME import (not a `.rzts` partial):
// codegen's `copyInternal` vendors it into each leaf at `./internal/groupOptions`.
// It is a byte copy of @rozie-ui/headless-core/src/internal/groupOptions.ts.
import { groupOptions } from './internal/groupOptions';

// ── VALUE IDENTITY ─────────────────────────────────────────────────────────
// Whether a model value selects an option is decided by src/internal/valueMatch.ts (a
// pure, unit-tested helper vendored into every leaf — the groupOptions.ts pattern),
// IDENTITY FIRST: a model value selects the options whose value is identical to it, and
// only when no option is identical do plain objects fall back to equal contents. The
// fallback is what makes an object value read back through a reactive proxy (Vue's ref
// / reactive, Svelte's $state) show as selected at all; see that file for the rule and
// its one limit.
//
// NOTHING HERE IS CACHED. Every answer is computed from `$props.value` and
// `$props.options` as they are when asked, so a model or an option list the consumer
// changed in place is shown as it is now. For primitive values that costs what the
// spine's code cost (`===` / `includes` per option). For object values the list rows
// get their state from ONE selection test per render (flatRows() / groupedRows(),
// O(options + model)), which is built by that call and dropped with it; the scan over
// the options (hasIdenticalOption) only runs for a model value and an option value
// that are different objects with equal contents.
//
// The spine's `isSelected`, `selectedLabel` and `select` compare with `===` /
// `includes`, so Select owns these three (they are not imported; nothing Select still
// imports from the spine reaches them).
import { identical, selects, selectedIn, selectionTest, toggleIn, distinctValues, uniqueKeys, keyBase } from './internal/valueMatch';

// A selection test held for the length of ONE open() call, so the initial-highlight
// search (`resolveInitialActive`, which asks isSelected() of option after option) is
// O(options + model) for object values too. Set and cleared synchronously around that
// call (try / finally) — it never outlives it — and only used for the very model array
// (same reference, same length) it was made from.

// virtual-core: the framework-agnostic windowing state machine (the data-table
// precedent — NO per-framework adapter). The static import is emitted unconditionally
// (a peer dep); every RUNTIME reference sits behind `if ($props.virtual)` / a
// `virtualizer` guard so the non-virtual emitted path executes none of it
// (byte-identical-off).
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

// Windowing instance state (the `let table` precedent — React hoists reassigned
// module-`let`s to useRef; do NOT const). NULL until $onMount, and ONLY constructed
// when $props.virtual. gridScrollEl is the captured .rozie-select-list scroll div the
// virtualizer observes; remeasurePending dedupes the deferred sweep.

/** An entry of the `groups` prop. */
export interface SelectGroup {
  id: string;
  label: string;
}

__rozieInjectStyle('Select-6e3ebfa6', `.rozie-select[data-rozie-s-6e3ebfa6] {
  position: relative;
  display: inline-block;
  width: var(--rozie-select-width, var(--rsl-width, 16rem));
  font: var(--rozie-select-font, inherit);
  /* The popup's stacking order is the composed popover's now; keep the select's own
     \`--rozie-select-z\` token steering it (custom properties inherit into the panel). */
  --rozie-popover-z: var(--rozie-select-z, var(--rsl-z, 1000));
}
.rozie-select-control[data-rozie-s-6e3ebfa6] {
  box-sizing: border-box;
  /* NOT \`width: 100%\`: the control renders inside the popover's anchor wrapper
     (\`display: inline-block\`, shrink-to-fit), so a percentage width is circular. It reads
     the SAME \`--rozie-select-width\` token the root does (the Combobox sizing rule), so the
     rendered width is the token's. \`block\` and \`inline\` stretch it to the container. */
  width: var(--rozie-select-width, var(--rsl-width, 16rem));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-select-gap, var(--rsl-gap, 0.5rem));
  padding: var(--rozie-select-control-padding, var(--rsl-control-padding, 0.5rem 0.75rem));
  font: inherit;
  text-align: left;
  background: var(--rozie-select-bg, var(--rsl-bg, #fff));
  color: var(--rozie-select-color, var(--rsl-color, inherit));
  border: var(--rozie-select-border-width, var(--rsl-border-width, 1px)) solid var(--rozie-select-border-color, var(--rsl-border-color, rgba(0, 0, 0, 0.25)));
  border-radius: var(--rozie-select-radius, var(--rsl-radius, 0.5rem));
  cursor: pointer;
}
.rozie-select-control[data-rozie-s-6e3ebfa6]:focus-within {
  /* the focus border is decoupled from the ring colour, as in Combobox: a consumer can
     neutralise the border without touching the accent the check mark derives from */
  border-color: var(--rozie-select-focus-border-color, var(--rozie-select-accent, var(--rsl-accent, #0066cc)));
  box-shadow: 0 0 0 var(--rozie-select-focus-ring-width, var(--rsl-focus-ring-width, 3px)) var(--rozie-select-focus-ring-color, var(--rsl-focus-ring-color, rgba(0, 102, 204, 0.25)));
}
.rozie-select-control[data-rozie-s-6e3ebfa6] { flex-wrap: wrap; transition: border-color 0.15s, box-shadow 0.15s; }
.rozie-select-control[data-rozie-s-6e3ebfa6]:has(.rozie-select-chip[data-rozie-s-6e3ebfa6]) { gap: var(--rozie-select-chip-gap, var(--rsl-chip-gap, 0.4rem)); }
.rozie-select--native[data-rozie-s-6e3ebfa6] .rozie-select-control[data-rozie-s-6e3ebfa6] { position: relative; }
.rozie-select-native[data-rozie-s-6e3ebfa6] {
  position: absolute; inset: 0; width: 100%; height: 100%;
  opacity: 0; margin: 0; border: 0; padding: 0; cursor: pointer;
  font-size: 16px; /* iOS zooms the page for form controls under 16px */
  appearance: none;
}
.rozie-select-native[data-rozie-s-6e3ebfa6]:disabled { cursor: default; }
.rozie-select--native[data-rozie-s-6e3ebfa6] .rozie-select-clear[data-rozie-s-6e3ebfa6] { position: relative; z-index: 1; }
.rozie-select-chip[data-rozie-s-6e3ebfa6] {
  display: inline-flex; align-items: center; max-width: 100%;
  gap: 0.3rem;
  padding: var(--rozie-select-chip-padding, var(--rsl-chip-padding, 0.15rem 0.5rem));
  border-radius: var(--rozie-select-chip-radius, var(--rsl-chip-radius, 0.375rem));
  background: var(--rozie-select-chip-bg, var(--rsl-chip-bg, rgba(0, 102, 204, 0.12)));
  color: var(--rozie-select-chip-color, inherit);
  font-size: var(--rozie-select-chip-size, var(--rsl-chip-size, 0.85rem));
}
.rozie-select-chip__label[data-rozie-s-6e3ebfa6] { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rozie-select-chip__remove[data-rozie-s-6e3ebfa6] {
  display: inline-flex; align-items: center; justify-content: center;
  width: var(--rozie-select-chip-remove-size, var(--rsl-chip-remove-size, 1.1rem));
  height: var(--rozie-select-chip-remove-size, var(--rsl-chip-remove-size, 1.1rem));
  border: 0; background: transparent; padding: 0; cursor: pointer; line-height: 1;
  font: inherit; border-radius: 50%;
  color: var(--rozie-select-chip-remove-color, var(--rsl-chip-remove-color, currentColor));
}
.rozie-select-trigger[data-rozie-s-6e3ebfa6] { flex: 1 1 auto; min-width: 0; min-height: 1.5em; outline: none; background: none; border: 0; padding: 0; text-align: start; }
.rozie-select-control[data-rozie-s-6e3ebfa6]:has(.rozie-select-chip[data-rozie-s-6e3ebfa6]) { justify-content: flex-start; }
.rozie-select-control[data-rozie-s-6e3ebfa6]:has(.rozie-select-chip[data-rozie-s-6e3ebfa6]) .rozie-select-trigger[data-rozie-s-6e3ebfa6] { flex-basis: 3rem; }
.rozie-select-disabled[data-rozie-s-6e3ebfa6] .rozie-select-control[data-rozie-s-6e3ebfa6] { cursor: default; background: var(--rozie-select-disabled-bg, var(--rsl-disabled-bg, rgba(0, 0, 0, 0.04))); }
.rozie-select-disabled[data-rozie-s-6e3ebfa6] { opacity: var(--rozie-select-disabled-opacity, var(--rsl-disabled-opacity, 0.55)); pointer-events: none; }
.rozie-select-placeholder[data-rozie-s-6e3ebfa6] { color: var(--rozie-select-placeholder, var(--rsl-placeholder, #757575)); }
.rozie-select-clear[data-rozie-s-6e3ebfa6] {
  flex: none; border: 0; background: none; padding: 0; cursor: pointer; line-height: 1;
  color: var(--rozie-select-clear-color, var(--rsl-clear-color, currentColor));
  font-size: var(--rozie-select-clear-size, var(--rsl-clear-size, 1rem));
  opacity: var(--rozie-select-arrow-opacity, var(--rsl-arrow-opacity, 0.7));
}
.rozie-select-clear[data-rozie-s-6e3ebfa6]:hover { opacity: 1; }
.rozie-select-arrow[data-rozie-s-6e3ebfa6] {
  font-size: 0.75em;
  color: var(--rozie-select-arrow-color, var(--rsl-arrow-color, currentColor));
  opacity: var(--rozie-select-arrow-opacity, var(--rsl-arrow-opacity, 0.7));
}
.rozie-select-list[data-rozie-s-6e3ebfa6] {
  margin: 0;
  padding: var(--rozie-select-list-padding, var(--rsl-list-padding, 0.25rem));
  max-height: var(--rozie-select-list-max-height, var(--rsl-list-max-height, 16rem));
  overflow-y: auto;
  list-style: none;
  background: var(--rozie-select-list-bg, var(--rozie-select-bg, var(--rsl-list-bg, #fff)));
  color: var(--rozie-select-color, var(--rsl-color, inherit));
  border: var(--rozie-select-border-width, var(--rsl-border-width, 1px)) solid var(--rozie-select-list-border-color, var(--rozie-select-border-color, var(--rsl-list-border-color, rgba(0, 0, 0, 0.15))));
  border-radius: var(--rozie-select-popup-radius, var(--rozie-select-radius, var(--rsl-popup-radius, var(--rsl-radius, 0.5rem))));
  box-shadow: var(--rozie-select-list-shadow, var(--rsl-list-shadow, 0 10px 24px rgba(0, 0, 0, 0.16)));
}
.rozie-select-inline[data-rozie-s-6e3ebfa6] {
  display: block;
  width: 100%;
}
.rozie-select-inline[data-rozie-s-6e3ebfa6] .rozie-select-list[data-rozie-s-6e3ebfa6] {
  margin-top: var(--rozie-select-list-gap, var(--rsl-list-gap, 0.25rem));
  border: none;
  border-radius: 0;
  box-shadow: none;
}
.rozie-select-inline[data-rozie-s-6e3ebfa6],
.rozie-select--block[data-rozie-s-6e3ebfa6] {
  container-type: inline-size;
}
.rozie-select-inline[data-rozie-s-6e3ebfa6] .rozie-select-control[data-rozie-s-6e3ebfa6],
.rozie-select--block[data-rozie-s-6e3ebfa6] .rozie-select-control[data-rozie-s-6e3ebfa6] {
  width: 100cqw;
}
.rozie-select--block[data-rozie-s-6e3ebfa6] {
  display: block;
  width: 100%;
}
.rozie-select-option[data-rozie-s-6e3ebfa6] {
  padding: var(--rozie-select-option-padding, var(--rsl-option-padding, 0.4rem 0.6rem));
  border-radius: var(--rozie-select-option-radius, var(--rsl-option-radius, 0.375rem));
  color: var(--rozie-select-option-color, inherit);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-select-gap, var(--rsl-gap, 0.5rem));
}
.rozie-select-option.is-active[data-rozie-s-6e3ebfa6] {
  background: var(--rozie-select-option-active-bg, var(--rsl-option-active-bg, rgba(0, 102, 204, 0.12)));
  color: var(--rozie-select-active-fg, var(--rsl-active-fg, inherit));
}
.rozie-select-option.is-selected[data-rozie-s-6e3ebfa6] {
  background: var(--rozie-select-selected-bg, var(--rsl-selected-bg, transparent));
  color: var(--rozie-select-selected-fg, var(--rsl-selected-fg, inherit));
  font-weight: var(--rozie-select-option-selected-weight, var(--rsl-option-selected-weight, 600));
}
.rozie-select-option.is-selected[data-rozie-s-6e3ebfa6]::after {
  content: var(--rozie-select-check, var(--rsl-check, '✓'));
  color: var(--rozie-select-check-color, var(--rozie-select-accent, var(--rsl-check-color, var(--rsl-accent, #0066cc))));
}
.rozie-select-option.is-disabled[data-rozie-s-6e3ebfa6] { opacity: var(--rozie-select-option-disabled-opacity, var(--rsl-option-disabled-opacity, 0.45)); cursor: not-allowed; }
.rozie-select-group-heading[data-rozie-s-6e3ebfa6] {
  /* section separation: default 0 = unchanged; a consumer-set value separates the leading
     ungrouped block from the first group heading */
  margin-top: var(--rozie-select-group-heading-margin-top, var(--rsl-group-heading-margin-top, 0));
  padding: var(--rozie-select-group-heading-padding, var(--rsl-group-heading-padding, 0.35rem 0.6rem 0.15rem));
  font-size: var(--rozie-select-group-heading-size, var(--rsl-group-heading-size, 0.75rem));
  font-weight: var(--rozie-select-group-heading-weight, var(--rsl-group-heading-weight, 600));
  text-transform: var(--rozie-select-group-heading-transform, var(--rsl-group-heading-transform, uppercase));
  letter-spacing: var(--rozie-select-group-heading-letter-spacing, var(--rsl-group-heading-letter-spacing, 0.03em));
  color: var(--rozie-select-group-heading-color, var(--rsl-group-heading-color, rgba(0, 0, 0, 0.5)));
}
.rozie-select-empty[data-rozie-s-6e3ebfa6] { padding: var(--rozie-select-empty-padding, var(--rsl-empty-padding, 0.5rem 0.6rem)); color: var(--rozie-select-empty-color, var(--rsl-empty-color, rgba(0, 0, 0, 0.5))); }
.rozie-select-spacer[data-rozie-s-6e3ebfa6] { margin: 0; padding: 0; border: 0; flex: none; }
.rozie-select-list--virtual[data-rozie-s-6e3ebfa6] { overflow-anchor: none; }`);

interface ChipSlotCtx { option: any; remove: () => void; index: number; }

interface SelectedSlotCtx { selected: any; value: any; }

interface OptionSlotCtx { option: any; index: any; active: any; selected: any; disabled: any; }

interface EmptySlotCtx { query: any; }

interface GroupHeadingSlotCtx { group: SelectGroup; }

interface SelectProps extends Omit<import('solid-js').ComponentProps<'div'>, 'options' | 'value' | 'defaultValue' | 'onValueChange' | 'multiple' | 'inline' | 'disabled' | 'placeholder' | 'closeOnSelect' | 'optionLabel' | 'optionValue' | 'optionDisabled' | 'idBase' | 'hideEmpty' | 'selectOnTab' | 'clearable' | 'clearLabel' | 'nativePicker' | 'placement' | 'offset' | 'disableFlip' | 'disableShift' | 'block' | 'groups' | 'ariaLabel' | 'virtual' | 'estimateRowHeight' | 'maxHeight' | 'onOpenChange' | 'onChange' | 'chipSlot' | 'selectedSlot' | 'optionSlot' | 'emptySlot' | 'groupHeadingSlot' | 'slots' | 'ref' | 'children' | 'innerHTML' | 'innerText' | 'textContent'> {
  /**
   * The option set. Each entry is either a primitive (`string`/`number`) or an object; objects resolve their label, value, and disabled state via the `option*` resolver props, falling back to `.label` / `.value` / `.disabled`. An option is selected when its value is identical to the model value. Only when no option is identical does a value match by content, and only a plain object or an array: equal own properties, compared up to 32 levels deep and at most 2,000 object-pair comparisons per value pair, beyond which the two values count as different. That is how a plain-object value read back through reactive state (Vue `ref` / `reactive`, Svelte `$state`) still shows as selected. Every other object matches by identity only — a class instance, a `Map`, a `Set`, and a plain object created in another realm (an iframe). On Vue that means a class-instance or `Map` value held in reactive state never shows as selected. Two options whose plain-object values have equal contents cannot be told apart on Vue and Svelte. Mapping options to a primitive with `optionValue` is the robust choice. The list may grow or shrink in place (`push`, `splice`); to change an option, pass a new array.
   */
  options?: any[];
  /**
   * The selected value (two-way `r-model`) — a scalar in single-select, an array of values in multi-select. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Select **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). How a value is matched to an option is described under `options`.
   * @example
   * <Select value={fruit()} onValueChange={setFruit} options={fruits} />
   */
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (value: (unknown) | null) => void;
  /**
   * Enable multi-select: `value` becomes an array, selecting an option toggles its membership, and the popup stays open after each commit. Selected values render as removable chips inside the control (a value missing from `options` keeps a chip labelled by its raw value), and Backspace removes the last chip while the popup is closed. A value the array holds more than once shows a single chip; removing that chip, or picking its option again, removes every occurrence. Backspace removes the last chip shown.
   */
  multiple?: boolean;
  /**
   * Render the results list in normal flow (static) rather than as a floating popup. Use when embedding the select inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
   */
  inline?: boolean;
  /**
   * Disable the control entirely. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  /**
   * Placeholder text shown in the empty control.
   */
  placeholder?: string;
  /**
   * Close the popup after a single-select commit. Defaults `true`; multi-select keeps the popup open regardless of this setting.
   */
  closeOnSelect?: boolean;
  /**
   * Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property.
   */
  optionLabel?: ((...args: any[]) => any) | null;
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property. Returning a primitive (an id) is the robust way to use object options; see `options` for how values are matched.
   */
  optionValue?: ((...args: any[]) => any) | null;
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  optionDisabled?: ((...args: any[]) => any) | null;
  /**
   * Id base for the popup and option elements — `aria-activedescendant` needs real ids. Option ids are `idBase + "-opt-" + i`, the popup id is `idBase + "-list"`. Leave it empty (the default) and each instance generates a unique id base after mount (`rozie-select-<n>`). Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase?: string;
  /**
   * Show nothing instead of the empty state: when there are no options the popup is not shown, the control reports `aria-expanded="false"`, and Escape is left to the host.
   */
  hideEmpty?: boolean;
  /**
   * Tab picks the highlighted option while the popup is open and an option is highlighted, then moves focus normally. Default `false` (Tab only closes the popup).
   */
  selectOnTab?: boolean;
  /**
   * Show a clear button in the control whenever there is a value, and let Delete clear it from the keyboard while the popup is closed. In single-select Backspace clears too; in multi-select Delete clears every value while Backspace removes only the last chip.
   */
  clearable?: boolean;
  /**
   * Accessible name of the clear button (`aria-label`). Localise it.
   */
  clearLabel?: string;
  /**
   * Single-select only. On touch devices (primary pointer coarse), open the operating system's own picker instead of the custom popup. Custom `option`, `groupHeading` and `empty` slot content does not appear in the OS picker. The picker lists the `placeholder` as its first entry: with `clearable` choosing it clears the value; without `clearable` it is disabled once there is a value. Has no effect with a mouse, with `multiple`, with `virtual`, or with `inline`.
   */
  nativePicker?: boolean;
  /**
   * Floating UI placement of the popup relative to the control, forwarded to the composed `@rozie-ui/popover` leaf — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end`. Default `"bottom-start"` keeps the popup flush with the control's left edge. Ignored when `inline` is set.
   */
  placement?: string;
  /**
   * Gap in pixels between the control and the popup, forwarded to the composed `@rozie-ui/popover` leaf. Default `4`. Ignored when `inline` is set (the in-flow gap is the `--rozie-select-list-gap` token).
   */
  offset?: number;
  /**
   * Disable the popup's Floating UI `flip` middleware (forwarded to the composed `@rozie-ui/popover` leaf). By default the popup flips above the control when it would overflow the viewport below; set this to keep it pinned to `placement` regardless. Ignored when `inline` is set.
   */
  disableFlip?: boolean;
  /**
   * Disable the popup's Floating UI `shift` middleware (forwarded to the composed `@rozie-ui/popover` leaf). By default the popup shifts to stay within the viewport; set this to keep it strictly aligned to the control. Ignored when `inline` is set.
   */
  disableShift?: boolean;
  /**
   * Fill the container: the root becomes `display: block; width: 100%`, the control stretches to that width, and the width-matched popup follows. Adds the `rozie-select--block` modifier class on the root. Default `false` keeps the fixed-width control (`--rozie-select-width`, `16rem` by default).
   */
  block?: boolean;
  /**
   * Ordered section list `[{ id, label }]` setting group order and heading text. Options are partitioned by their optional `group` string; groups present on options but absent here follow in first-appearance order. Empty (the default) renders a flat list. Ignored when `virtual` is on.
   */
  groups?: any[];
  /**
   * Accessible name for the control (`aria-label`). This is how you name the select: the focusable control is a `role="combobox"` element, not a form input, so a `<label for>` cannot point at it. Set it to the text of your visible label.
   */
  ariaLabel?: (string) | null;
  /**
   * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling list (leading/trailing spacers preserve the total scroll height). Default `false` renders every option. Set `maxHeight` to bound the scrolling list; windowing works in the floating popup and with `inline` alike. Grouping is not applied while `virtual` is on.
   */
  virtual?: boolean;
  /**
   * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  estimateRowHeight?: number;
  /**
   * A CSS length string bounding the list scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-select-list-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
   */
  maxHeight?: string;
  onOpenChange?: (...args: any[]) => void;
  onChange?: (...args: any[]) => void;
  chipSlot?: (ctx: ChipSlotCtx) => JSX.Element;
  selectedSlot?: (ctx: SelectedSlotCtx) => JSX.Element;
  optionSlot?: (ctx: OptionSlotCtx) => JSX.Element;
  emptySlot?: (ctx: EmptySlotCtx) => JSX.Element;
  groupHeadingSlot?: (ctx: GroupHeadingSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: SelectHandle) => void;
}

export interface SelectHandle {
  open: (...args: any[]) => any;
  close: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  focusControl: (...args: any[]) => any;
}

export default function Select(_props: SelectProps): JSX.Element {
  const _merged = mergeProps({ options: (() => [])() as any[], multiple: false, inline: false, disabled: false, placeholder: '', closeOnSelect: true, optionLabel: null, optionValue: null, optionDisabled: null, idBase: '', hideEmpty: false, selectOnTab: false, clearable: false, clearLabel: 'Clear', nativePicker: false, placement: 'bottom-start', offset: 4, disableFlip: false, disableShift: false, block: false, groups: (() => [])() as any[], ariaLabel: null, virtual: false, estimateRowHeight: 36, maxHeight: '' }, _props);
  const [local, attrs] = splitProps(_merged, ['options', 'value', 'multiple', 'inline', 'disabled', 'placeholder', 'closeOnSelect', 'optionLabel', 'optionValue', 'optionDisabled', 'idBase', 'hideEmpty', 'selectOnTab', 'clearable', 'clearLabel', 'nativePicker', 'placement', 'offset', 'disableFlip', 'disableShift', 'block', 'groups', 'ariaLabel', 'virtual', 'estimateRowHeight', 'maxHeight', 'ref', 'onOpenChange', 'onChange', 'chipSlot', 'selectedSlot', 'optionSlot', 'emptySlot', 'groupHeadingSlot', 'slots']);
  onMount(() => { local.ref?.({ open, close, toggle, clear, focusControl }); });

  const [value, setValue] = createControllableSignal<unknown>(_props as unknown as Record<string, unknown>, 'value', null);
  const [autoId, setAutoId] = createSignal('');
  const [open$local, setOpen$local] = createSignal(false);
  const [coarse, setCoarse] = createSignal(false);
  const [panelOpen, setPanelOpen] = createSignal(false);
  const [panelEcho, setPanelEcho] = createSignal(false);
  const [session, setSession] = createSignal(0);
  const [panelSession, setPanelSession] = createSignal(0);
  const [resync, setResync] = createSignal(0);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [query, setQuery] = createSignal('');
  const [rows, setRows] = createSignal<any[]>([]);
  const [windowVer, setWindowVer] = createSignal(0);
  const [editVer, setEditVer] = createSignal(0);
  const activeDescendant = createMemo(() => {
    if (!open$local() || activeIndex() < 0) return null;
    return optionId(activeIndex());
  });
  createEffect(on(() => (() => (open$local() ? 'o' : '-') + (local.hideEmpty ? 'h' : 's') + (local.options ? local.options.length : 0))(), (v) => untrack(() => (() => {
    syncPanel();
  })()), { defer: true }));
  createEffect(on(() => (() => session())(), (v) => untrack(() => (() => {
    syncPanel();
  })()), { defer: true }));
  createEffect(on(() => (() => !!local.disabled)(), (v) => untrack(() => (() => {
    if (local.disabled) close();
  })()), { defer: true }));
  createEffect(on(() => (() => panelOpen())(), (v) => untrack(() => (() => {
    takePanelWrite();
  })()), { defer: true }));
  createEffect(on(() => (() => panelEcho())(), (v) => untrack(() => (() => {
    if (!panelOpen() && panelEcho()) takePanelWrite();
  })()), { defer: true }));
  createEffect(on(() => (() => resync())(), (v) => untrack(() => (() => {
    syncPanel();
  })()), { defer: true }));
  createEffect(on(() => (() => local.options)(), (v) => untrack(() => (() => {
    refeedWindow();
  })()), { defer: true }));
  createEffect(on(() => (() => local.options ? local.options.length : 0)(), (v) => untrack(() => (() => {
    refeedWindow();
  })()), { defer: true }));
  createEffect(on(() => (() => activeIndex())(), (v) => untrack(() => (() => {
    liveActive = activeIndex();
  })()), { defer: true }));
  createEffect(on(() => (() => local.options ? local.options.length : 0)(), (v) => untrack(() => (() => {
    if (activeIndex() >= visibleOptions().length) setActiveIndex(visibleOptions().length > 0 ? nextEnabled(-1, 1) : -1);
  })()), { defer: true }));
  createEffect(on(() => (() => (coarse() ? 'c' : '-') + (local.nativePicker ? 'n' : '-') + (local.virtual ? 'v' : '-') + (local.inline ? 'i' : '-') + (local.multiple ? 'm' : '-'))(), (v) => untrack(() => (() => {
    yieldToNative();
  })()), { defer: true }));
  createEffect(on(() => (() => value())(), (v) => untrack(() => (() => {
    scheduleNativeSync();
  })()), { defer: true }));
  createEffect(on(() => (() => local.options)(), (v) => untrack(() => (() => {
    scheduleNativeSync();
  })()), { defer: true }));
  createEffect(on(() => (() => local.options ? local.options.length : 0)(), (v) => untrack(() => (() => {
    scheduleNativeSync();
  })()), { defer: true }));
  createEffect(on(() => (() => local.groups)(), (v) => untrack(() => (() => {
    scheduleNativeSync();
  })()), { defer: true }));
  onMount(() => {
    // A remount of the SAME instance (React StrictMode mounts, unmounts and mounts again
    // synchronously). Frames the first mount queued are still queued: the unmount set
    // `disposed`, this line clears it again before any of them has run, so they do run —
    // against this remounted instance. That is harmless (the re-measure sweep, the kick
    // and the reveal are idempotent and read live state). What must not carry over is the
    // re-measure latch: the unmount already cleared it, and it is cleared here as well so
    // that a mount never starts with a sweep believed to be in flight.
    disposed = false;
    remeasurePending = false;
    if (!local.idBase) setAutoId('rozie-select-' + nextAutoId());
    // The coarse-pointer probe must never throw out of $onMount (the windowing setup
    // below runs for every Select), and older engines only have addListener().
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        coarseQuery = window.matchMedia('(pointer: coarse)');
        setCoarse(!!coarseQuery.matches);
        // Only records the new state: this closure is the mount-time one, so the reaction
        // (closing the custom popup, the first paint of the native element) lives in the
        // `$data.coarse` watcher below.
        coarseListener = (e: any) => {
          setCoarse(!!e.matches);
        };
        if (typeof coarseQuery.addEventListener === 'function') coarseQuery.addEventListener('change', coarseListener);else if (typeof coarseQuery.addListener === 'function') coarseQuery.addListener(coarseListener);
      }
    } catch (err: any) {
      coarseQuery = null;
    }
    syncRows();
    if (local.virtual) {
      // The list renders at mount when virtual, so the .rozie-select-list scroll container
      // exists here. Capture it via $el.querySelector (the data-table gridScrollEl precedent,
      // proven ×6 incl Lit shadow + Solid) — $refs on a conditionally-rendered node is null on
      // Solid/Lit, which leaves the virtualizer with no scroll element.
      gridScrollEl = __rozieRootRef! ? __rozieRootRef!.querySelector('.rozie-select-list') : null;
      virtualizer = new Virtualizer(virtualizerOptions());
      virtualizerCleanup = virtualizer._didMount();
      setWindowVer(windowVer() + 1);
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => kickWindow(8));else setTimeout(() => kickWindow(8), 0);
    }
  });
  createEffect(() => {
    if (local.virtual && virtualizer && virtualizer.options.count !== windowSource().length) refeedWindow();
    // The native element's selection is DOM state: after any render that may have added
    // or removed <option>s, write the model into it again (a no-op when it already shows it).
    if (nativeActive()) syncNative();
  });
  onCleanup(() => {
    // Every animation-frame chain still queued (reveal, settle, re-measure, kick) sees
    // this and does nothing.
    disposed = true;
    remeasurePending = false;
    if (resyncTimer !== null) clearTimeout(resyncTimer);
    if (typeTimer !== null) clearTimeout(typeTimer);
    if (nativeSyncTimer !== null) clearTimeout(nativeSyncTimer);
    if (coarseQuery && coarseListener) {
      if (typeof coarseQuery.removeEventListener === 'function') coarseQuery.removeEventListener('change', coarseListener);else if (typeof coarseQuery.removeListener === 'function') coarseQuery.removeListener(coarseListener);
    }
    // Tear down the virtualizer's scroll-element ResizeObserver (no-op when virtual off).
    if (virtualizerCleanup) virtualizerCleanup();
    virtualizerCleanup = null;
    virtualizer = null;
  });
  let controlElRef: HTMLElement | null = null;
  let triggerElRef: HTMLElement | null = null;
  let listElRef: HTMLElement | null = null;
  let __rozieRootRef: HTMLElement | null = null;

  // Type-ahead buffer for the select-only trigger. Module-scope
  // `let`s reassigned from handlers → the React emitter hoists them to `useRef`
  // so they persist across renders (the setup-once guarantee); no-op elsewhere.
  // They STAY in this host (not the shared spine) per the A==B rule: reassigned
  // module-`let`s + sigils live in the host; the partial only closes over them.
  let typeBuffer = '';
  let typeTimer: any = null;
  // The `(pointer: coarse)` MediaQueryList and its `change` listener (see $onMount), and
  // the pending native-element sync timer (see queueNativeSync()). Reassigned
  // module-`let`s, initialised null per the timer-handle convention.
  let coarseQuery: any = null;
  let coarseListener: any = null;
  let nativeSyncTimer: any = null;
  // The pending panel re-sync (see queueResync()); null per the timer-handle convention.
  let resyncTimer: any = null;

  // ---- shared list spine (P2: @rozie-ui/headless-core/listCore.rzts) ------
  // The option resolvers, close/clear, and the activeDescendant derivation come from
  // the shared list spine. It is a compile-time `.rzts` script-partial: it dissolves
  // into this leaf via inlineScriptPartials() before IR lowering (zero runtime dep).
  // The spine closes over this host's pieces by convention: idRoot() (below).
  // Host-local instead of imported:
  //  - navigation, type-ahead and open/toggle — see HOST-LOCAL NAVIGATION below; they
  //    use the reassigned module-`let`s typeBuffer/typeTimer (above) and
  //    scrollActiveIntoView (below);
  //  - everything that compares a model value with an option value (`isSelected`,
  //    `selectedLabel`, `select`) — see VALUE IDENTITY below.
  // ══ Shared headless LIST SPINE (Phase 64, D-06) — the target-agnostic list-core bridge ══
  // Lifted verbatim from Listbox.rozie's <script> (the monolithic pure-Rozie list logic). This
  // partial holds ONLY the PURE list spine — option resolvers, the client-side filter, enabled-index
  // navigation, the arrow/home/end/enter/escape/space/tab keyboard reducer, type-ahead, single+multi
  // selection, open/close state, and activeDescendant derivation. It is a compile-time `.rzts`
  // script-partial: it dissolves into each consumer's compiled leaf via inlineScriptPartials() before
  // IR lowering — leaving zero runtime dependency (the 64-01-proven cross-package bare-specifier path).
  //
  // ── PARAMETERIZATION (D-06) ──────────────────────────────────────────────────────────────────
  // The spine is parameterized BY HOST CONVENTION (the same implicit by-convention mixin contract
  // windowing.rzts uses) along two axes:
  //   - focus-model: `activedescendant` | `roving`. Both list families default to `activedescendant`
  //     (what they use today): the highlighted option is tracked virtually via `activeDescendant`
  //     (an option id) while DOM focus stays on the control. `roving` (real per-option tabindex
  //     focus) is SUPPORTED-BUT-UNUSED — no focus rewrite is forced here; a roving host would supply
  //     its own focus mover. The `activeDescendant` / `optionId` derivation below IS the
  //     activedescendant model.
  //   - input-mode: `select-only` (Listbox — a button trigger + type-ahead) | `filter-input`
  //     (Combobox — a text <input> that filters by the typed query). The mode is by HOST CONVENTION,
  //     NOT a discriminant prop (P3 retired the Listbox `combobox`/`filterable` props): a select-only
  //     host never writes `$data.query`, so `visibleOptions` is the identity path for it and the
  //     printable-char branch of the reducer feeds type-ahead; a filter-input host writes `$data.query`
  //     from its <input>, so `visibleOptions` substring-filters and `onInput` drives the query.
  //
  // ── HOST CONTRACT (symbols the consuming host MUST define before importing) ────────────────────
  //   - the reassigned module-`let`s `typeBuffer` / `typeTimer` — type-ahead scratch state. They are
  //     reassigned from handlers → the React emitter hoists them to `useRef` (the setup-once
  //     guarantee), so per the A==B playbook rule they STAY IN THE HOST; this partial only closes
  //     over them (in `onTypeahead`).
  //   - `idRoot()` — the host's id base (Listbox: the `id` prop, else the per-instance id it
  //     generates in $onMount); `optionId` below derives every option id from it.
  //   - `focusControl()` / `scrollActiveIntoView()` — impure ref-reading functions (they touch the
  //     control / list ref elements, which are post-mount-only per ROZ123), so they are per-consumer
  //     HOST functions; this partial only closes over them (it reads NO refs itself).
  //   - the option set + form surface (`$props.options` / `$props.value` (model) / `$props.multiple` /
  //     `$props.optionLabel` / `$props.optionValue` / `$props.optionDisabled` /
  //     `$props.closeOnSelect` / `$props.disabled`) and the reactive state (`$data.open` /
  //     `$data.activeIndex` / `$data.query`). Input-mode is by convention (the host's <input> writing
  //     `$data.query`), NOT a discriminant prop.

  // ---- option resolvers --------------------------------------------------
  function labelOf(opt: any) {
    if (local.optionLabel !== null) return local.optionLabel(opt);
    if (opt !== null && typeof opt === 'object' && 'label' in opt) return opt.label;
    return String(opt);
  }
  function valueOf(opt: any) {
    if (local.optionValue !== null) return local.optionValue(opt);
    if (opt !== null && typeof opt === 'object' && 'value' in opt) return opt.value;
    return opt;
  }
  function disabledOf(opt: any) {
    if (local.optionDisabled !== null) return !!local.optionDisabled(opt);
    if (opt !== null && typeof opt === 'object' && 'disabled' in opt) return !!opt.disabled;
    return false;
  }
  // `idRoot()` is a HOST function (the host's id base: its id prop, else a generated
  // per-instance id) so the option ids follow the host's auto-id fallback.
  function optionId(index: any) {
    return idRoot() + '-opt-' + index;
  }
  function close() {
    if (!open$local()) return;
    setOpen$local(false);
    setActiveIndex(-1);
    _props.onOpenChange?.({
      open: false
    });
  }
  function clear() {
    const empty = local.multiple ? [] : null;
    setValue(empty);
    setQuery('');
    _props.onChange?.({
      value: empty,
      option: null
    });
  }

  // Pointer hover sets the virtual highlight (matches native <select> feel).
  function onOptionPointerMove(index: any) {
    if (activeIndex() !== index) setActiveIndex(index);
  }
  // A selection test held for the length of ONE open() call, so the initial-highlight
  // search (`resolveInitialActive`, which asks isSelected() of option after option) is
  // O(options + model) for object values too. Set and cleared synchronously around that
  // call (try / finally) — it never outlives it — and only used for the very model array
  // (same reference, same length) it was made from.
  let scopedSelection: any = null;

  // Is some option's value identical to this model value?
  function hasIdenticalOption(m: any) {
    const opts = Array.isArray(local.options) ? local.options : [];
    return opts.some((o: any) => identical(valueOf(o), m));
  }

  // Is a given option currently selected? Compares VALUES, never the option object: an
  // option handed in from reactive state (a windowed row on Vue or Svelte) is a proxy of
  // the consumer's object and is identical to nothing.
  function isSelected(opt: any) {
    const v = valueOf(opt);
    const cur = value();
    if (local.multiple) return Array.isArray(cur) && selectedInModel(cur, v);
    return selects(cur, v, hasIdenticalOption);
  }
  // One option against a multi-select model. Inside open() (see `scopedSelection`) the
  // answer comes from that call's own selection test; otherwise it is the plain per-option
  // comparison — for a primitive value the spine's `includes`.
  function selectedInModel(cur: any, v: any) {
    if (scopedSelection !== null && scopedSelection.model === cur && scopedSelection.length === cur.length) return scopedSelection.test(v);
    return selectedIn(cur, v, hasIdenticalOption);
  }
  // A "selected?" test for one pass over the options (the rows of one render): built
  // here, used by that pass, dropped with it. O(options + model) for the pass, where one
  // isSelected() per row would be O(options × model) for object values.
  function selectionFor() {
    const cur = value();
    if (!local.multiple) return (v: any) => selects(cur, v, hasIdenticalOption);
    if (!Array.isArray(cur)) return (v: any) => false;
    const opts = Array.isArray(local.options) ? local.options : [];
    return selectionTest(cur, () => opts.map((o: any) => valueOf(o)));
  }
  // The flat list's rows, each with its selected state, from one selection test.
  function flatRows() {
    const opts = visibleOptions();
    const test = selectionFor();
    return opts.map((opt: any, index: any) => ({
      opt,
      index,
      selected: test(valueOf(opt))
    }));
  }
  // The grouped list's blocks, each row with its selected state, from one selection test.
  function groupedRows() {
    const test = selectionFor();
    return groupBlocks().map((blk: any) => ({
      key: blk.key,
      group: blk.group,
      items: blk.items.map((row: any) => ({
        opt: row.opt,
        index: row.index,
        selected: test(valueOf(row.opt))
      }))
    }));
  }

  // The label shown in the trigger (single-select; a multi-select shows chips instead).
  // A plain function, called in the template — not a `$computed` (the spine's is one).
  function selectedLabel() {
    if (local.multiple) return '';
    const cur = value();
    const opts = Array.isArray(local.options) ? local.options : [];
    const match = opts.find((o: any) => selects(cur, valueOf(o), hasIdenticalOption));
    return match === undefined ? '' : labelOf(match);
  }

  // Commit an option. Single-select replaces the value; multi-select toggles membership —
  // picking a selected option takes out the model value(s) that select it, every
  // occurrence (a model may hold a value more than once; see chipRows()).
  function select(opt: any) {
    if (disabledOf(opt)) return;
    const v = valueOf(opt);
    if (local.multiple) {
      const cur = value();
      const arr = Array.isArray(cur) ? cur : [];
      // Fresh array on every commit — in-place mutation is dropped by the
      // React/Solid/Lit/Angular change detectors.
      const next = toggleIn(arr, v, hasIdenticalOption);
      setValue(next);
      _props.onChange?.({
        value: next,
        option: opt
      });
    } else {
      setValue(v);
      _props.onChange?.({
        value: v,
        option: opt
      });
      if (local.closeOnSelect) {
        close();
        focusControl();
      }
    }
  }
  function groupOfOption(opt: any) {
    return opt !== null && typeof opt === 'object' && 'group' in opt && opt.group != null ? String(opt.group) : null;
  }
  // Grouping is active only for a non-empty `groups` list, and never while windowing.
  function isGrouped() {
    return !local.virtual && Array.isArray(local.groups) && local.groups.length > 0;
  }
  // The option set partitioned ONCE per input change: `ordered` is the visual order
  // (identity when ungrouped), `blocks` the grouped render's sections. Memoised, so every
  // call in one render returns the SAME objects — stable indices, stable block identity.
  // `groups` is part of the key only while grouping is in effect (see groupsKey()).
  // Each block carries its render key and each item its index in visibleOptions(). The
  // ungrouped block's key cannot be produced by a group id: named blocks are all `grp-…`.
  function groupsKey() {
    return isGrouped() ? local.groups : null;
  }
  // The option list's length, as a memo key next to its reference: an option list the
  // consumer GREW or SHRANK in place (push / splice on a reactive array) is a new option
  // set although the reference is the same. An option REPLACED in place at the same
  // length is not seen by these memos — to change an option, pass a new array (stated in
  // the `options` prop description).
  function optionCount() {
    return Array.isArray(local.options) ? local.options.length : 0;
  }
  const groupingCache = {
    keys: null as any[] | null,
    val: null as any
  };
  function grouping() {
    const __rozieMemoKey = [local.options, optionCount(), groupsKey(), local.virtual];
    const __rozieMemoPrev = groupingCache.keys;
    if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
      return groupingCache.val;
    }
    const __rozieMemoVal = (() => {
      if (!isGrouped()) return {
        ordered: local.options,
        blocks: []
      };
      const res = groupOptions(local.options, local.groups, groupOfOption);
      let i = 0;
      return {
        ordered: res.ordered,
        blocks: res.blocks.map((b: any) => ({
          key: b.group ? 'grp-' + b.group.id : 'ungrouped',
          group: b.group,
          items: b.items.map((opt: any) => ({
            opt,
            index: i++
          }))
        }))
      };
    })();
    groupingCache.keys = __rozieMemoKey;
    groupingCache.val = __rozieMemoVal;
    return __rozieMemoVal;
  }
  function orderedOptions() {
    return grouping().ordered;
  }
  // Blocks for the grouped render (empty when ungrouped).
  function groupBlocks() {
    return grouping().blocks;
  }

  // ── native mobile picker (`nativePicker`) ──────────────────────────────────
  // Active only for the opt-in prop on a coarse primary pointer, in SINGLE-select, and
  // never together with `virtual` or `inline`. (`multiple` is excluded on purpose: a
  // native <select multiple> is an in-place list box on desktop-class touch devices, where
  // a tap on the invisible overlay would pick whatever row is under the finger.) While
  // active the native <select> IS the control: the custom trigger is aria-hidden and out
  // of the tab order, and the host entry points (onControlClick / onTriggerKeyDown) never
  // open the custom popup.
  function nativeActive() {
    return !!local.nativePicker && coarse() && !local.multiple && !local.virtual && !local.inline;
  }
  // The <option> rows in visual order, computed once per option/group change: `loose` are
  // the ungrouped options (direct children, first), `grouped` one entry per <optgroup>.
  // Each row carries its index in visibleOptions().
  const nativeRowsCache = {
    keys: null as any[] | null,
    val: null as any
  };
  function nativeRows() {
    const __rozieMemoKey = [local.options, optionCount(), groupsKey(), local.virtual];
    const __rozieMemoPrev = nativeRowsCache.keys;
    if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
      return nativeRowsCache.val;
    }
    const __rozieMemoVal = (() => {
      const blocks = isGrouped() ? groupBlocks() : [{
        group: null,
        items: visibleOptions().map((opt: any, index: any) => ({
          opt,
          index
        }))
      }];
      return {
        loose: blocks.filter((b: any) => !b.group).flatMap((b: any) => b.items),
        grouped: blocks.filter((b: any) => b.group)
      };
    })();
    nativeRowsCache.keys = __rozieMemoKey;
    nativeRowsCache.val = __rozieMemoVal;
    return __rozieMemoVal;
  }
  // Option values can be any type and the native element only carries strings, so each
  // <option> carries its INDEX in visibleOptions() and a commit resolves back to the option.
  function nativeSingleValue() {
    const i = visibleOptions().findIndex((o: any) => isSelected(o));
    return i === -1 ? '' : String(i);
  }
  // The placeholder entry cannot be chosen once there is a value, unless `clearable`.
  function nativePlaceholderDisabled() {
    return hasValue() && !local.clearable;
  }

  // The rendered native element, or null. Looked up from the root (a ref on a
  // conditionally rendered node is null on Solid and Lit), by tag name so it is typed.
  function nativeEl() {
    if (!__rozieRootRef!) return null;
    for (const el of __rozieRootRef!.querySelectorAll('select') as any) {
      if (el.classList.contains('rozie-select-native')) return el;
    }
    return null;
  }
  // Write the model into the native element. Imperative on purpose: a <select>'s
  // selection is DOM state, and a choice that is not accepted (the placeholder entry, or
  // a consumer that keeps the old value) changes nothing reactive — a declarative `:value`
  // would not be re-applied, and the element would keep showing the refused option.
  function syncNative() {
    const el = nativeEl();
    if (!el) return;
    const v = nativeSingleValue();
    if (el.value !== v) el.value = v;
  }
  // One pending sync at a time, and always the LATEST caller's: on React the queued
  // callback closes over the render it was queued from, so a newer request replaces an
  // older one instead of being dropped in its favour.
  function queueNativeSync() {
    if (nativeSyncTimer !== null) clearTimeout(nativeSyncTimer);
    nativeSyncTimer = setTimeout(() => {
      nativeSyncTimer = null;
      syncNative();
    }, 0);
  }
  // Now, and once more after the framework has rendered: on some targets the watchers
  // below run before the <select> / <option> elements are committed.
  function armNativeSync() {
    syncNative();
    queueNativeSync();
  }
  // The watchers' entry point: while the native picker is not active they do nothing —
  // no DOM query, no timer. (Not a statement about the whole component: $onMount arms one
  // sync on its own whenever `nativePicker` is set on a coarse pointer, before
  // nativeActive() can be read there.)
  function scheduleNativeSync() {
    if (nativeActive()) armNativeSync();
  }
  function onNativeChange($event: any) {
    const v = $event.target.value;
    if (v === '') {
      // The placeholder entry: clears when `clearable`, otherwise it is not a choice.
      if (local.clearable && hasValue()) clear();
    } else {
      const opt = visibleOptions()[Number(v)];
      if (opt !== undefined) select(opt);
    }
    // Whatever the consumer did with the commit (accepted, refused, normalised), the
    // element must end up showing the model. Queued, not immediate: the model write has
    // not come back as a prop yet, and when it does not come back at all (a refusal) no
    // watcher runs.
    queueNativeSync();
  }
  // The native picker takes over: an open custom popup closes through the normal close()
  // path (one `open-change`), and the native element picks up the model.
  function yieldToNative() {
    if (!nativeActive()) return;
    close();
    armNativeSync();
  }

  // ══ HOST-LOCAL NAVIGATION (begin) ═════════════════════════════════════════
  // These ten functions are defined here instead of imported from listCore.rzts.
  // The spine's navigation is bound to the spine's own `visibleOptions()`, and the
  // partial inliner does not allow shadowing one function of a partial (ROZ139).
  // Select needs navigation over the grouped VISUAL order, so it owns
  // `visibleOptions` and every spine function that reaches it. The nine below
  // `visibleOptions` are VERBATIM copies of listCore.rzts, kept in sync by
  // tests/spine-copies.test.ts — change them in the spine first, then here.
  // One of them is declared under another name: the spine's `open` is `openCore` here
  // (same body, byte for byte). The name `open` belongs to the gated host function right
  // after this block, which every other copy reaches when it calls `open()`.
  // Combobox likewise keeps its navigation host-local.

  // The option list every index refers to, in visual order. Select-only: there is
  // no query filter (nothing writes `$data.query`).
  function visibleOptions() {
    return orderedOptions();
  }
  function resolveInitialActive() {
    const opts = visibleOptions();
    const sel = opts.findIndex((o: any) => isSelected(o) && !disabledOf(o));
    if (sel !== -1) return sel;
    return opts.findIndex((o: any) => !disabledOf(o));
  }
  function openCore() {
    if (local.disabled) return;
    if (open$local()) return;
    setOpen$local(true);
    setActiveIndex(resolveInitialActive());
    _props.onOpenChange?.({
      open: true
    });
  }
  function toggle() {
    if (open$local()) close();else open();
  }
  function nextEnabled(from: any, dir: any) {
    const opts = visibleOptions();
    if (opts.length === 0) return -1;
    let i = from;
    for (let step = 0; step < opts.length; step++) {
      i += dir;
      if (i < 0) i = opts.length - 1;else if (i >= opts.length) i = 0;
      if (!disabledOf(opts[i])) return i;
    }
    return from;
  }
  function move(dir: any) {
    if (!open$local()) {
      open();
      return;
    }
    const start = activeIndex() < 0 ? dir > 0 ? -1 : 0 : activeIndex();
    setActiveIndex(nextEnabled(start, dir));
    scrollActiveIntoView();
  }
  function moveEdge(toEnd: any) {
    if (!open$local()) open();
    setActiveIndex(toEnd ? nextEnabled(-1, -1) : nextEnabled(-1, 1));
    scrollActiveIntoView();
  }
  function commitActive() {
    const opts = visibleOptions();
    if (activeIndex() >= 0 && activeIndex() < opts.length) select(opts[activeIndex()]);
  }
  function onTypeahead(ch: any) {
    if (typeTimer !== null) clearTimeout(typeTimer);
    typeBuffer += ch.toLowerCase();
    typeTimer = setTimeout(() => {
      typeBuffer = '';
    }, 600);
    const opts = visibleOptions();
    const idx = opts.findIndex((o: any) => !disabledOf(o) && labelOf(o).toLowerCase().startsWith(typeBuffer));
    if (idx !== -1) {
      if (!open$local()) open();
      setActiveIndex(idx);
      scrollActiveIntoView();
    }
  }
  function onControlKeyDown($event: any) {
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
      if (open$local()) {
        $event.preventDefault();
        commitActive();
      }
    } else if (key === 'Escape') {
      if (open$local()) {
        $event.preventDefault();
        close();
        focusControl();
      }
    } else if (key === ' ' || key === 'Spacebar') {
      // Space toggles / commits in a select-only host (a button trigger). A
      // filter-input host types the literal space into its <input> and does NOT
      // route Space through this reducer, so this branch is select-only by use.
      $event.preventDefault();
      if (!open$local()) open();else commitActive();
    } else if (key === 'Tab') {
      if (open$local()) close();
    } else if (key.length === 1 && !$event.metaKey && !$event.ctrlKey && !$event.altKey) {
      onTypeahead(key);
    }
  }
  // ══ HOST-LOCAL NAVIGATION (end) ═══════════════════════════════════════════

  // The gate in front of the spine's `open` (`openCore` above). The exposed `open` verb
  // and every internal caller (`toggle`, `move`, `moveEdge`, type-ahead, Space) go
  // through it, so the custom popup can never open while the native picker is active.
  // It carries the public name because the spine copies above call `open()`, and those
  // calls must reach the gate too.
  // It also asks for the highlighted option to be scrolled into view once the list is
  // there: opening starts the highlight on the SELECTED option, which in a long list can
  // be far below the fold, and in a windowed one is not even rendered — the trigger's
  // `aria-activedescendant` would name an id that does not exist until the first key.
  // And it counts the open: `$data.session` is what tells a dismissal of THIS popup from
  // one left over from the popup before it (see syncPanel()).
  // And a windowed list is re-fed here when its row count is not the option count: the
  // rows are only read while the popup is open, and every open passes through this gate,
  // so an `options` array grown or shrunk in place is caught on every target — including
  // Solid, where no watcher and no post-render hook sees such a change.
  function open() {
    if (nativeActive()) return;
    if (local.virtual && virtualizer && virtualizer.options.count !== optionCount()) refeedWindow();
    if (!local.disabled && !open$local()) setSession(session() + 1);
    const cur = value();
    if (local.multiple && Array.isArray(cur)) scopedSelection = {
      model: cur,
      length: cur.length,
      test: selectionFor()
    };
    try {
      openCore();
    } finally {
      scopedSelection = null;
    }
    scrollActiveIntoView();
  }

  // ---- shared windowing math (Phase 64 P4: @rozie-ui/headless-core/windowing.rzts) ----
  // The PURE windowing math (the windowed slice + spacer geometry) is the SAME
  // virtual-core bridge data-table consumes. It is a compile-time `.rzts` partial:
  // the imported symbols DISSOLVE into this leaf via inlineScriptPartials() before
  // IR lowering (zero runtime dep). The math closes over this host's pieces BY
  // CONVENTION (D-04/D-05): windowSource(), the virtualizer instance + gridScrollEl +
  // the virtual-core fns, scheduleRemeasure(), $data.windowVer/$data.editVer, and the
  // no-op pin hook pinnedEditIndex()/pinnedMeasurement() defined below. The impure
  // DOM/refs pieces stay HERE per-consumer (ROZ123). NB the pin hooks are defined in
  // THIS host (not the shared partial) so data-table's A==B byte-identity is untouched.
  // ══ Generic vertical windowing math (Phase 64, D-04) — the target-agnostic virtual-core bridge ══
  // Lifted verbatim from the DataTable virtualization.rzts (the Phase 53/63 B13 baseline). This partial
  // holds ONLY the PURE windowing math; every DOM/refs/virtualizer-instance impurity stays per-consumer
  // in the host (ROZ123). It is a compile-time `.rzts` script-partial: it dissolves into each consumer's
  // compiled leaf via inlineScriptPartials() before IR lowering — leaving zero runtime dependency.
  //
  // HOST CONTRACT (symbols the consuming host MUST define before importing — the same implicit
  // by-convention mixin contract the DataTable host's other partials already use for `$data.windowVer`):
  //   - windowSource(): T[]   — the full list to window (the KEY generalization; the DataTable host
  //                             returns its pre-pagination row model, listbox/combobox return the
  //                             filtered options). This partial MUST NOT reach into the host data engine
  //                             directly — rows arrive ONLY through windowSource().
  //   - $props.estimateRowHeight — per-item size estimate (kept aliased for DataTable back-compat).
  //   - $data.windowVer / $data.editVer — window/edit-version reactivity bumps.
  //   - gridScrollEl              — the scroll-container element handle.
  //   - virtualizer               — the host virtual-core instance (built in $onMount from the ref).
  //   - observeElementRect / observeElementOffset / elementScroll / measureElement — virtual-core fns.
  //   - scheduleRemeasure()       — the host's rAF/microtask remeasure defer.
  //   - pinnedEditIndex() / pinnedMeasurement(pin) — the D-05 OPTIONAL pin-extension hook (host-provided,
  //                             defaulting to no-op): the DataTable host passes its edit-pinning hooks;
  //                             listbox passes nothing. Routing pinning through this host hook (NOT
  //                             inlining it) keeps DataTable's B13 edit-pinning behavior byte-identical.
  //   - rowsWindowed(): boolean  — is the ROW axis windowed. REQUIRED, no default — replaces every bare
  //                             truthiness read of the host's windowing prop (D-05); `windowedRows()` /
  //                             `padTop()` / `padBottom()` / `rowIsOutsideWindow()` below call it by
  //                             convention exactly as they already call `pinnedEditIndex()`.
  //   - colsWindowed(): boolean  — is the COLUMN axis windowed. REQUIRED, no default. `false` for every
  //                             host until it defines the real column-axis mechanism (87-04+).
  //   - columnCount(): number    — the leaf-column count the column virtualizer windows over. REQUIRED,
  //                             no default.
  //   - columnSize(i: number): number — the authoritative width of absolute leaf column `i`, sourced
  //                             from table-core's `getSize()` under D-06. REQUIRED, no default.
  //   - forcedColumns(): number[] — the D-10 OPTIONAL column-axis mirror of `pinnedEditIndex()`: the
  //                             DataTable host unions pinned + active-cell + editing column indices into
  //                             the column-window slice; listbox/combobox pass an empty array (host-
  //                             provided, defaulting to `[]`).
  //   - colVirtualizer           — the host's SECOND virtual-core instance, windowing the COLUMN axis
  //                             (see the AXIS MECHANISM note below). Host-provided, defaulting to `null`.
  //   - autoMeasureOn(): boolean — the D-18 REQUIRED content-driven-estimate gate (Phase 87 87-07):
  //                             data-table's real body reads `$props.autoMeasure === true`; listbox/
  //                             combobox/command-palette return `false` so the accumulator branch
  //                             estimateRowSize() gates on is dead code for them (D-20).
  //   - afterRowRemeasure        — OPTIONAL host-owned mutable `let` (defaults to a no-op / undefined),
  //                             assigned to refineRowEstimate() (below) by the host. The DataTable
  //                             host's remeasureWindow() (virtualization.rzts) calls it AFTER its
  //                             measureElement sweep so the fold + hysteresis re-feed run on every
  //                             window commit. Routed through a mutable `let` rather than a direct
  //                             call FROM virtualization.rzts INTO this file: a relative-partial CONST
  //                             calling a bare-specifier-partial CONST is the exact forward-reference
  //                             TDZ class remeasureColumnWindow()'s own DataTable.rozie comment
  //                             documents for columnVirtualizerOptions() (inlineScriptPartials()
  //                             groups the relative partial BEFORE the bare-specifier partial in the
  //                             merged per-target output, regardless of source import order). A
  //                             mutable `let` hoists to `useRef` on React and is excluded from a
  //                             useCallback's dependency array, sidestepping the hazard entirely — the
  //                             SAME mechanism `refreshRowModel` already relies on.
  //
  // AXIS MECHANISM (OQ1 / Assumption A1 — resolved from the installed source in 87-02;
  // LANDED in 87-04: `columnVirtualizerOptions()` below IS the second, horizontal instance this
  // note originally only documented). `horizontal` is a PER-INSTANCE field of `VirtualizerOptions`
  // (`node_modules/@tanstack/virtual-core/dist/esm/index.d.ts:67`, installed version 3.17.1 per
  // `package.json`), and every axis-sensitive internal read consults `instance.options.horizontal` —
  // `measureElement`'s inlineSize/blockSize + offsetWidth/offsetHeight branch
  // (`dist/esm/index.js:137,150`), `observeElementOffset`'s scrollLeft/scrollTop branch
  // (`dist/esm/index.js:118-121`), `getMaxScrollOffset`'s scrollWidth/scrollHeight branch
  // (`dist/esm/index.js:907-915`), and `scrollWithAdjustments`'s left/top branch
  // (`dist/esm/index.js:152-161`). So ONE `Virtualizer` instance windows exactly ONE axis: the column
  // axis needs its own SECOND, independent `Virtualizer` instance constructed with `horizontal: true`,
  // sharing the SAME `getScrollElement()` (the `rdt-scroll` wrapper) the row instance already uses.
  // Two options the row axis does not set that the column instance will need: `isRtl?: boolean`
  // (data-table ships an RTL grid path) and `overscan?: number` (D-07 gives the column axis its own
  // hardcoded constant, separate from the row axis's `overscan: 8` below).
  //
  // isRtl WIRING (gap-closure 87-09, LANDED — see `ensureColRtlWatch()`/`isColRtl()` below,
  // immediately ahead of `columnVirtualizerOptions()`): data-table has no construction-time RTL
  // signal (no `dir`/`rtl` prop), and `dir` can be set on `gridScrollEl` at ANY point relative to
  // mount. `isRtl` is therefore computed LIVE via `getComputedStyle`, not baked in once.

  // getItemKey reads the LIVE source (never a frozen mount-render $data.rows closure — the F6
  // React stale-closure lesson) so virtual-core's measurement cache keys by stable full-model row
  // id across recycling, aligned with the windowed <tr> :key="row.id" (Pitfall 3 / req-10).
  function virtualItemKey(i: any) {
    const src = windowSource();
    return src && src[i] ? src[i].id : undefined;
  }

  // ══ Phase 87 87-07 (D-15/D-18) — content-driven auto-measure: the shared engine's FIRST
  // mutable top-level state. Hoisted to `useRef` PER-INSTANCE by the React emitter's
  // hoistModuleLet — the SAME mechanism already load-bearing for `table`, `virtualizer`,
  // `remeasurePending`, and `gridScrollEl` in the DataTable host (Task 1's confirmed
  // precedent), so two DataTable instances on one page never share an accumulator
  // (T-87-07-04). measuredRowTotal/measuredRowCount together give the running MEAN of every
  // row folded in so far; lastFedRowEstimate is the estimate value most recently pushed into
  // virtual-core (the hysteresis comparison baseline). ══
  let measuredRowTotal = 0;
  let measuredRowCount = 0;

  // ══ Gap-closure 87-10 — windowVerBumpPending / bumpWindowVer(): coalesce EVERY $data.windowVer
  // write behind a SINGLE microtask-deferred increment, regardless of how many callers request
  // one within the same synchronous JS task. ══
  //
  // ROOT CAUSE (framework-agnostic; the Solid-specific symptom this closes only EXPOSES it) —
  // confirmed by instrumenting the installed @tanstack/virtual-core@3.17.1 source directly
  // (dist/esm/index.js), not by reasoning abstractly: virtual-core's resizeItem() calls
  // `this.notify(false)` — synchronously invoking `virtualizerOptions().onChange` below — EVERY
  // TIME a measured row's real size differs from its cached one (`delta !== 0`), independent of
  // framework (dist/esm/index.js:836-874). remeasureWindow()'s CR-01 sweep
  // (packages/ui/data-table/src/virtualization.rzts) measures EVERY currently-rendered `<tr>` in
  // ONE for-loop BEFORE calling afterRowRemeasure() (refineRowEstimate() below) — so a single
  // synchronous JS task (e.g. the very first measurement pass, which transitions N never-before-
  // measured rows from the flat seed to their real heights) can fire onChange, and therefore an
  // UNCOALESCED `$data.windowVer = $data.windowVer + 1`, MANY times in a row — well BEFORE
  // refineRowEstimate()'s own fold-then-re-feed (which runs only AFTER that loop finishes) has
  // folded those same measurements into the running mean or re-fed the converged estimate into
  // virtual-core via setOptions(). A live trace of this exact sequence (instrumented resizeItem/
  // getMeasurements calls, DataTableColumnVirtualDemo, autoMeasure on) showed Vue batching 3
  // resizeItem calls before its ONE downstream re-render reads getMeasurements() — already
  // reflecting the fully-folded, re-fed state — versus Solid re-running its padTop()/padBottom()
  // effects SYNCHRONOUSLY and IMMEDIATELY on EVERY individual windowVer write (11 interleaved
  // resize-then-immediate-recompute pairs, each recompute happening mid-sweep, before
  // refineRowEstimate() had run even once). React/Vue/Svelte/Angular/Lit all batch their own
  // reactivity to at least a microtask boundary, so their downstream reads land AFTER the whole
  // synchronous burst (measurement sweep + fold + re-feed) completes — accidentally correct, not
  // correct by construction. Solid does not auto-batch a signal write made from outside a
  // Solid-owned event/effect context, so it is the one target where the mid-burst TORN read is
  // externally observable. Because `setOptions()` + `_willUpdate()` alone do NOT invalidate
  // virtual-core's own `getMeasurements()` memo (keyed on itemSizeCacheVersion /
  // getMeasurementOptions() — never on the estimateSize FUNCTION reference itself; confirmed from
  // the same installed source, dist/esm/index.js:585-587,624), Solid's LAST such mid-sweep
  // recompute is also the LAST time getMeasurements() is ever invoked for that sweep once no
  // further row happens to differ from its cache — so the DOM stays frozen on that stale,
  // pre-fold/pre-re-feed snapshot indefinitely, even though the accumulator itself has already
  // converged correctly (T-87-07's own confirmed finding).
  //
  // FIX: coalesce every requester of a windowVer bump — virtual-core's own onChange AND
  // refineRowEstimate()'s explicit re-feed bump — behind ONE microtask-deferred write, the SAME
  // idiom scheduleRemeasure() already uses in virtualization.rzts. This makes the render happen
  // EXACTLY ONCE, strictly AFTER the entire synchronous burst (including refineRowEstimate()'s
  // fold + re-feed) on EVERY target, by construction rather than by incidental host-framework
  // batching. Scoped to the ROW axis only: colVirtualizer never calls resizeItem() at all (D-06 —
  // column widths come from table-core's getSize() oracle, never measured from the DOM), so
  // columnVirtualizerOptions()'s onChange cannot hit this burst class and is left untouched.
  let windowVerBumpPending = false;
  function bumpWindowVer(): void {
    if (windowVerBumpPending) return;
    windowVerBumpPending = true;
    const flush = () => {
      windowVerBumpPending = false;
      setWindowVer(windowVer() + 1);
    };
    // Mirrors scheduleRemeasure()'s own defensive queueMicrotask-with-setTimeout-fallback
    // (virtualization.rzts) for environments where queueMicrotask is unavailable.
    if (typeof queueMicrotask !== 'undefined') queueMicrotask(flush);else setTimeout(flush, 0);
  }

  // estimateRowSize(i) (D-15/D-17): the estimateSize() resolver. MUST check !autoMeasureOn()
  // FIRST so the off path touches zero accumulator state and returns $props.estimateRowHeight
  // verbatim (D-17's byte-behavioral no-op). The zero-measurements case (first paint,
  // regardless of autoMeasure) still returns the seed — the very first render has nothing
  // measured yet either way (D-15).
  function estimateRowSize(i: number): number {
    if (!autoMeasureOn()) return local.estimateRowHeight;
    if (measuredRowCount === 0) return local.estimateRowHeight;
    return Math.round(measuredRowTotal / measuredRowCount);
  }

  // The FULL virtualizer options. virtual-core's setOptions REPLACES options with
  // `{ ...defaults, ...opts }` (it does NOT merge with prior options — verified in the 3.17.1
  // source), so the re-feed MUST pass the complete set, exactly like every TanStack adapter.
  // Returned `any` (the currentState() precedent) so the strict bundled-leaf tsc does not choke
  // on virtual-core's generic option inference. onChange's windowVer write is routed through
  // bumpWindowVer() (87-10) rather than a raw `$data.x = $data.x + 1` — resizeItem() can call
  // this onChange MANY times in a single synchronous sweep (once per row whose real measured
  // size differs from its cache, e.g. every never-before-measured row in the FIRST window),
  // and coalescing those into one microtask-deferred write is what keeps every target's render
  // landing strictly AFTER the whole sweep (see bumpWindowVer()'s own comment for the confirmed
  // Solid-specific rendering gap this closes). The React emitter still lowers the underlying
  // `$data.windowVer = $data.windowVer + 1` to functional setState — correct even deferred to a
  // microtask, exactly as it was correct from a mount closure before.
  function virtualizerOptions(): any {
    return {
      count: windowSource().length,
      getScrollElement: () => gridScrollEl,
      estimateSize: (i: any) => estimateRowSize(i),
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      measureElement,
      overscan: 8,
      getItemKey: virtualItemKey,
      onChange: () => {
        bumpWindowVer();
        // CR-01: re-observe the freshly-committed window so RECYCLED rows get measured.
        // virtual-core only observe()s a node you explicitly hand to measureElement (it does
        // NOT auto-discover rendered rows — measureElement is the SOLE caller of
        // observer.observe, virtual-core@3.17.1 dist/esm/index.js:794-817). Rows that recycle
        // into view on scroll are brand-new DOM nodes; without re-sweeping they keep the
        // estimateRowHeight seed forever and the spacer math drifts (req-2). Deferred one frame
        // so the new <tr> set is in the DOM before we measure. Safe from an infinite
        // measure→onChange→measure loop: measureElement is idempotent on an already-observed
        // node (the `prevNode !== node` guard), and resizeItem only re-fires onChange when the
        // measured height actually DIFFERS from the cached one (delta !== 0) — an unchanged
        // re-measure is a no-op.
        scheduleRemeasure();
      }
    };
  }

  // pinMeasurement(pin): the D-05 pin-hook read, RE-TYPED at the windowing layer so the
  // shared math is strict-clean across every host. The host-provided pinnedMeasurement() has
  // two shapes: the DataTable host returns a real virtual-core measurement; the listbox/combobox
  // no-op host returns bare `null` (inferred `(pin) => null`). Calling it directly makes
  // `const pm = pinnedMeasurement(pin)` flow-narrow to `null`, so the downstream `pm && pm.start`
  // guard collapses the object branch to `never` (TS2339, Class 3). Reading the hook through this
  // thin wrapper with an EXPLICIT return type (a return-type annotation is NOT flow-narrowed)
  // gives the measurement a real object-or-null shape, so `pm && pm.start` keeps the object branch.
  // Typing-only: the runtime value (a measurement or null) is unchanged.
  function pinMeasurement(pin: number): {
    start: number;
    size: number;
    index: number;
    end: number;
  } | null {
    return pinnedMeasurement(pin);
  }

  // windowedRows(): the rendered slice. Off / pre-mount → the full $data.rows mapped to
  // { vi:null, row } (the r-else path never calls this, but the guard keeps it total). On → read
  // $data.windowVer to SUBSCRIBE (the rowIndexOf tick discipline) then map each VirtualItem to its
  // full-model row. NB the local is `rowList` (NOT `rows` — React lowers $data.rows to a bare
  // `rows` binding → TS2448 self-shadow, line ~1149 lesson).
  function windowedRows() {
    // SUBSCRIBE FIRST (fine-grained targets): touch the reactive windowVer at the TOP — BEFORE any
    // early return — so Solid's <For>/Svelte's {#each} accessor subscribes to it on its FIRST eval,
    // which happens at initial render while `virtualizer` is still null (it is built in $onMount,
    // after the first render). `virtualizer` is a non-reactive `let`, so if the windowVer read sat
    // BELOW the `!virtualizer` guard the accessor would early-return [] without ever reading the
    // signal → it would NEVER re-run when onChange later bumps windowVer, and the window would stay
    // blank forever (the Solid/Svelte fine-grained bug). Coarse targets re-render wholesale so the
    // placement is a no-op for them. The post-construction windowVer bump in $onMount fires the
    // first re-run that picks up the now-non-null virtualizer.
    // ALSO subscribe to editVer here so the slice re-derives when an editor opens/closes (the
    // pin/unpin transition), mirroring the probe's windowVer bump on pin (Solid/Svelte fine-grained).
    void windowVer();
    void editVer();
    if (!virtualizer) {
      // Rows OFF (Phase 87 D-04: this now includes the colsWindowed()-only path, since the
      // wrapper template is entered whenever isWindowed(), not just rowsWindowed() — the row
      // virtualizer is never constructed when only the column axis is windowed, D-04) → the FULL
      // set, with a SYNTHETIC `vi.index` set to each row's array position (matching rowIndexOf's
      // own `$data.rows.indexOf(row)` semantics exactly, since $data.rows IS windowSource()'s
      // output here). Every windowed body binding reads wr.vi.index (data-row, aria-rowindex,
      // colIndexOf, isEditing, the fill handle) — a bare `null` there is a hard crash the moment
      // this branch is reached with the wrapper mounted, which colsWindowed()-only now does.
      // Row-virtual ON but the virtualizer is not yet constructed (pre-$onMount first paint) →
      // render NOTHING so the template never dereferences a not-yet-real `vi`; the rows appear on
      // the first onChange after _didMount.
      if (!rowsWindowed()) {
        const rowList = rows() || [];
        return rowList.map((r: any, i: any) => ({
          vi: {
            index: i
          },
          row: r
        }));
      }
      return [];
    }
    const items = virtualizer.getVirtualItems();
    const rowList = rows() || [];
    // WR-01: drop any virtual item whose index outruns the current full-model rows (a brief
    // shrink window where the virtualizer count is stale relative to $data.rows on the async
    // onChange→windowVer path). The template keys on wr.row.id, so a row:undefined entry would
    // throw "Cannot read properties of undefined"; filter it here so the template never sees it.
    const out = items.map((vi: any) => ({
      vi,
      row: rowList[vi.index]
    })).filter((wr: any) => wr.row);
    // ── D-02 pin-row union (req-9): if an editor is open on a row that is NOT in the current
    // window, UNION it into the slice (keyed on row.id so Lit repeat / Solid For never recycle it
    // into another full-model row), LEADING the slice when it sits above the window and TRAILING
    // it when below — so DOM order matches visual/aria order. The spacer subtraction (padTop/
    // padBottom) keeps the total exactly getTotalSize(). This is the 51-01-proven mechanism wired
    // into the real windowing.
    const pin = pinnedEditIndex();
    if (pin >= 0 && rowList[pin]) {
      let inWindow = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].index === pin) {
          inWindow = true;
          break;
        }
      }
      if (!inWindow) {
        const pm = pinMeasurement(pin);
        const firstStart = items.length ? items[0].start : 0;
        const above = pm ? pm.start < firstStart : pin < (items.length ? items[0].index : pin);
        const pinnedEntry = {
          vi: pm != null ? pm : {
            index: pin
          },
          row: rowList[pin],
          pinned: true
        };
        if (above) out.unshift(pinnedEntry);else out.push(pinnedEntry);
      }
    }
    return out;
  }

  // Spacer-<tr> heights (D-03): the leading spacer occupies items[0].start; the trailing spacer
  // the gap between the last rendered item's end and getTotalSize(). Both windowVer-gated reads
  // (the `$data.windowVer` touch re-derives them as the window/measurements change). 0 when off.
  function padTop() {
    // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
    // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
    // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
    void windowVer();
    void editVer();
    if (!rowsWindowed() || !virtualizer) return 0;
    const items = virtualizer.getVirtualItems();
    let pad = items.length ? items[0].start : 0;
    // D-02 spacer subtraction: when the pinned editing row sits ABOVE the window it is rendered
    // in-flow as the slice's LEADING <tr> (its measured height is now a real <tr>), so subtract
    // that height from the leading spacer to keep padTop + Σ rendered <tr> + padBottom = total.
    const pin = pinnedEditIndex();
    if (pin >= 0) {
      const pm = pinMeasurement(pin);
      const inWindow = pmIndexInWindow(items, pin);
      if (pm && !inWindow && pm.start < pad) pad = pad - pm.size;
    }
    return pad < 0 ? 0 : pad;
  }
  function padBottom() {
    // subscribe-first, see windowedRows() (IN-04): touch windowVer + editVer before the early
    // return so the fine-grained spacer :style binding subscribes on its first eval + re-derives
    // on pin/unpin.
    void windowVer();
    void editVer();
    if (!rowsWindowed() || !virtualizer) return 0;
    const items = virtualizer.getVirtualItems();
    if (!items.length) return 0;
    let pad = virtualizer.getTotalSize() - items[items.length - 1].end;
    // D-02 spacer subtraction: when the pinned editing row sits BELOW the window it is rendered
    // in-flow as the slice's TRAILING <tr>, so subtract its height from the trailing spacer.
    const pin = pinnedEditIndex();
    if (pin >= 0) {
      const pm = pinMeasurement(pin);
      const inWindow = pmIndexInWindow(items, pin);
      // WR-01: decide "below the window" by INDEX, not by start-OFFSET. On variable-height rows
      // measurement drift can leave pm.start at-or-past items[0].start while the pinned row's
      // index is actually ABOVE the window, mis-subtracting its height from the trailing spacer.
      // The pinned full-model index vs the last rendered item's index is drift-proof. Fall back to
      // the offset comparison only if the measurement lacks an index (defensive).
      const lastItemIdx = items[items.length - 1].index;
      const below = pm && pm.index != null ? pm.index > lastItemIdx : pm && pm.start >= items[0].start;
      if (pm && !inWindow && below) {
        // below the window → it trailed the slice; subtract its height from the trailing spacer.
        if (pm.end > items[items.length - 1].end) pad = pad - pm.size;
      }
    }
    return pad < 0 ? 0 : pad;
  }
  // pmIndexInWindow: is full-model index `idx` present in the rendered virtual window?
  function pmIndexInWindow(items: any, idx: any) {
    for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
    return false;
  }
  // rowIsOutsideWindow(r): is the full-model row index r absent from the currently rendered
  // window? Used by the scroll-then-focus seam (req-5 — scroll a far row in before focusing).
  function rowIsOutsideWindow(r: any) {
    if (!rowsWindowed() || !virtualizer) return false;
    const items = virtualizer.getVirtualItems();
    for (const it of items as any) if (it.index === r) return false;
    return true;
  }
  // Windowing instance state (the `let table` precedent — React hoists reassigned
  // module-`let`s to useRef; do NOT const). NULL until $onMount, and ONLY constructed
  // when $props.virtual. gridScrollEl is the captured .rozie-select-list scroll div the
  // virtualizer observes; remeasurePending dedupes the deferred sweep.
  let virtualizer: any = null;
  let virtualizerCleanup: any = null;
  let gridScrollEl: any = null;
  let remeasurePending = false;
  // Scroll-end pin state (see recordScrollEnd()): whether the USER left the view at the end,
  // the option count at that moment, and the last scrollTop already accounted for.
  let scrollEndPinned = false;
  let scrollEndPinnedCount = -1;
  let scrollEndPinnedTop = -1;
  // The deferred scroll-into-view (see scrollActiveIntoView()): its generation — every
  // new request and every scroll the USER makes takes the next number, and a callback
  // holding an older one does nothing — and `$data.activeIndex` as last committed, kept by
  // a watcher so a callback queued from an older render still reads the current index.
  let revealGen = 0;
  let liveActive = -1;
  // How long one reveal may keep looking for its outcome (the highlighted option rendered
  // and in view). Not a schedule: a reveal ends on that outcome, or when it is superseded
  // or cancelled, normally within a few frames. This only stops a reveal whose outcome can
  // never come (say, a popup that is never shown) from looking forever. The same bound
  // virtual-core gives its own scroll reconciliation.
  const REVEAL_PATIENCE_MS = 5000;
  // Set in $onUnmount: every deferred callback (the reveal, its settle, the re-measure
  // passes, the first-paint kick) checks it and does nothing on an unmounted select.
  let disposed = false;

  // windowSource(): the windowing.rzts host-contract row source — the option set in
  // visual order. CR-02: the shared windowing contract requires each row to carry a STABLE
  // `.id` (windowing.rzts virtualItemKey reads src[i].id, and the windowed template keys on
  // wr.row.id), so each option is wrapped into an id-bearing row: `_opt` the original option
  // (read via rowOption(wr) in the windowed template), `_i` its index. Kept === $data.rows so
  // the math's rowList[vi.index] resolves to the same wrapped row the count windows over.
  //
  // `id` is a UNIQUE PRIMITIVE (uniqueKeys in src/internal/valueMatch.ts — no two rows can
  // share one, whatever the values are): an object value is keyed by its position (every
  // object stringifies alike — as a framework key the raw value gave every row the key
  // "[object Object]", and React rebuilt the rows on each change of the window), anything
  // else by its type and string form.
  //
  // The windowed template reads the option through rowOption(), NOT `wr.row._opt`: these
  // rows are handed to `$data.rows`, which on Vue and Svelte gives them back as reactive
  // proxies — `_opt` would then be a proxy of the consumer's option, and a commit made
  // from it would hand the consumer a proxy instead of its own value.
  //
  // $memo, keyed on the TRUE inputs. The key covers everything the map reads:
  // options ref + virtual + groups while grouping is in effect (visibleOptions' inputs —
  // with `virtual` on grouping is off, the order is source order, and a new `groups`
  // array changes nothing here) and the optionValue resolver (valueOf in the map body).
  // virtual-core's getItemKey/getMeasurements walk this O(count) per pass, so an
  // unmemoized per-call re-map made every scroll tick O(N²) in wrapper allocations.
  // (A memo of row KEYS only: what is selected is never cached — see VALUE IDENTITY.)
  const windowSourceCache = {
    keys: null as any[] | null,
    val: null as any
  };
  function windowSource() {
    const __rozieMemoKey = [local.options, optionCount(), groupsKey(), local.virtual, local.optionValue];
    const __rozieMemoPrev = windowSourceCache.keys;
    if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
      return windowSourceCache.val;
    }
    const __rozieMemoVal = (() => {
      const opts = visibleOptions();
      const keys = uniqueKeys(opts.map((o: any, i: any) => keyBase(valueOf(o), i)));
      return opts.map((o: any, i: any) => ({
        id: keys[i],
        _opt: o,
        _i: i
      }));
    })();
    windowSourceCache.keys = __rozieMemoKey;
    windowSourceCache.val = __rozieMemoVal;
    return __rozieMemoVal;
  }
  // The option a windowed row stands for, read from the option list itself by the row's
  // index. While the rows lag one step behind a list that just shrank, the row's own copy.
  function rowOption(wr: any) {
    const opts = visibleOptions();
    return wr.vi.index < opts.length ? opts[wr.vi.index] : wr.row._opt;
  }

  // D-05 NO-OP PIN HOOK (defined in THIS host, NOT the shared partial — keeps data-table
  // A==B intact). The shared windowedRows/padTop/padBottom call pinnedEditIndex()/
  // pinnedMeasurement() UNGUARDED by convention; a select has no edit-pinning, so these
  // reduce the pin union (-1 → never unioned) and the spacer subtraction (null → identity)
  // to a no-op. They MUST exist or the by-convention call ReferenceErrors at mount.
  function pinnedEditIndex() {
    return -1;
  }
  function pinnedMeasurement(pin: any) {
    return null;
  }

  // D-05 windowing.rzts host-contract one-liner (Phase 87 87-02). rowsWindowed() preserves
  // today's EXACT truthiness (byte-behavior-identical) — it is the REQUIRED symbol
  // windowing.rzts calls in place of a bare `$props.virtual` read. NOT type-annotated — this
  // `<script>` block has no `lang="ts"` (unlike windowing.rzts / Combobox.rozie), so the
  // pinMeasurement() explicit-return-type trick (windowing.rzts:65-74) does not apply here; nothing
  // in this plan calls these through a type-narrowing wrapper.
  //
  // GAP-CLOSURE 87-16 (WR-02): the column-axis host-contract symbols (`colVirtualizer`,
  // `colsWindowed()`, `columnCount()`, `columnSize()`, `forcedColumns()`) that 87-02 added
  // alongside this were REMOVED here — they were dead code shipped on a mistaken premise
  // about the compiler's tree-shaking BFS. Select imports only `{ virtualItemKey,
  // virtualizerOptions, windowedRows, padTop, padBottom, pmIndexInWindow, rowIsOutsideWindow }`
  // from windowing.rzts; none of those functions' bodies reference the column-axis symbols
  // (only `columnVirtualizerOptions()`/`windowedColIndices()`/`colPadLeft()`/`colPadRight()`/
  // `colIsOutsideWindow()` do, and Select never imports any of those), so
  // `inlineScriptPartials()`'s BFS never needed them to exist. See 87-REVIEW.md WR-02 /
  // 87-16-SUMMARY.md for the verification trail.
  function rowsWindowed() {
    return !!local.virtual;
  }
  // autoMeasureOn() (Phase 87 87-07, D-18/D-20): the content-driven-estimate host-contract
  // gate. Select never lights this branch — a permanent `false` keeps windowing.rzts's
  // estimateRowSize()/refineRowEstimate() accumulator dead code here. RETAINED (unlike the
  // column-axis symbols above): `virtualizerOptions()` — which Select DOES import and call
  // — wires `estimateSize: (i) => estimateRowSize(i)`, and `estimateRowSize()` calls
  // `autoMeasureOn()` as its first line. This one IS reachable through the import graph.
  function autoMeasureOn() {
    return false;
  }

  // Keep $data.rows === windowSource() so the windowing math indexes the live option set.
  function syncRows() {
    setRows(windowSource());
  }

  // SCROLL-END PIN (the data-table D-19 twin): keep a user who scrolled to the END of a
  // variable-height list at the end while the options in view measure taller than their
  // estimate. The view is judged on the DOM, and only at a move the USER made — a move is
  // virtual-core's own when it still holds an unreconciled scroll adjustment
  // (scrollAdjustments !== 0): its above-viewport compensation writes an ABSOLUTE scrollTop
  // computed from its last-observed (stale) offset, so it pulls the view back up from the end
  // and must neither clear the pin nor be mistaken for the user leaving the end. That position
  // is remembered so the scroll event that later reports it is not read as a user move either.
  // (Judging on virtual-core's MODEL, as the data-table host does, fails here: its total grows
  // with every option measured in the ResizeObserver batch while its offset stays at the stale
  // value, so the pin was cleared mid-batch — every target ended 10-126px short, measured.)
  function recordScrollEnd() {
    if (!virtualizer || !gridScrollEl || virtualizer.scrollState) return;
    const top = gridScrollEl.scrollTop;
    if (top === scrollEndPinnedTop) return;
    scrollEndPinnedTop = top;
    if (virtualizer.scrollAdjustments !== 0) return;
    // Only a list that actually overflows has an end to hold: while the window has not painted
    // yet (or the list is closed), scrollHeight <= clientHeight reads as "at the end" and a pin
    // recorded then would jump the freshly opened list to the bottom.
    const sh = gridScrollEl.scrollHeight;
    const ch = gridScrollEl.clientHeight;
    scrollEndPinned = ch > 0 && sh - ch > 1 && sh - top - ch <= 1;
    scrollEndPinnedCount = windowSource().length;
  }

  // Re-apply the pin after the framework has committed the window (called from the rAF pass):
  // the real maximum is known only then. Not while a programmatic scroll (scrollToIndex) is in
  // flight, and not when the option count changed since the user reached the end (a new filter
  // or appended options must not be auto-followed).
  function keepScrollEnd() {
    if (!scrollEndPinned || !virtualizer || !gridScrollEl || virtualizer.scrollState) return;
    if (windowSource().length !== scrollEndPinnedCount) return;
    const maxTop = gridScrollEl.scrollHeight - gridScrollEl.clientHeight;
    if (maxTop - gridScrollEl.scrollTop > 1) {
      gridScrollEl.scrollTop = maxTop;
      scrollEndPinnedTop = gridScrollEl.scrollTop;
    }
  }

  // Defer remeasureWindow() until AFTER the framework commits the recycled window
  // (onChange fires BEFORE React/Solid commit). TWO deferred passes (microtask THEN rAF)
  // behind one in-flight flag (the data-table virtualization.rzts:46-56 pattern, copied
  // per-consumer per D-04/D-09): the microtask catches Solid's <For> / Svelte's {#each}
  // SYNCHRONOUS commit (the Phase 63 Solid under-convergence hazard — D-09 rAF-defer
  // budget), the rAF catches React's async commit. measureElement is idempotent on an
  // already-observed node, so running both is cheap and loop-free.
  function scheduleRemeasure() {
    recordScrollEnd();
    if (remeasurePending) return;
    remeasurePending = true;
    let ranMicro = false;
    const microPass = () => {
      if (!disposed) remeasureWindow();
    };
    // N-05 (quick 260923-rrr): key the rAF pass on the OUTCOME. React and Angular commit the
    // recycled window AFTER the first rAF, so one pass measured the OLD options and the new ones
    // waited for virtual-core's 150ms scrolling-ended tick — with variable-height options the late
    // above-viewport adjustment then moved the whole list (measured). Re-run next frame until the
    // committed options cover the virtualizer's window, bounded (the data-table host twin).
    let rafAttempts = 0;
    const rafPass = () => {
      if (disposed) return;
      const covered = remeasureWindow();
      rafAttempts = rafAttempts + 1;
      if (!covered && rafAttempts < 10 && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(rafPass);
        return;
      }
      keepScrollEnd();
      remeasurePending = false;
    };
    if (typeof queueMicrotask !== 'undefined') {
      ranMicro = true;
      queueMicrotask(microPass);
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(rafPass);else if (ranMicro) remeasurePending = false;else setTimeout(rafPass, 0);
  }

  // measureElement sweep: hand every rendered windowed option to the virtualizer so its
  // true (variable) height is observed (virtual-core measures ONLY nodes passed to
  // measureElement, keyed by the data-index attribute). Bails during a programmatic
  // scroll (scrollToIndex) so a measure can't starve the scroll target.
  function remeasureWindow() {
    if (!virtualizer || !gridScrollEl) return true;
    if (virtualizer.scrollState) return true;
    const els = gridScrollEl.querySelectorAll('.rozie-select-option[data-index]');
    const rendered = new Set();
    for (const el of els as any) {
      virtualizer.measureElement(el);
      rendered.add(el.getAttribute('data-index'));
    }
    // N-05: false while the framework has not yet committed the recycled window.
    const items = virtualizer.getVirtualItems();
    for (let i = 0; i < items.length; i++) {
      if (!rendered.has(String(items[i].index))) return false;
    }
    return true;
  }

  // ---- focus / scroll helpers (post-mount $refs only) --------------------
  // Impure ($refs) → per the ROZ123 + A==B rules they stay in the host (the spine
  // only closes over them). Named `focusControl` (not `focus`): a `focus` $expose
  // verb would override the inherited HTMLElement.focus method on the Lit element.
  function focusControl() {
    // While the native picker is active the native <select> is the control (the custom
    // trigger is aria-hidden), so that is what takes focus.
    if (nativeActive()) {
      const el = nativeEl();
      if (el) {
        el.focus();
        return;
      }
    }
    triggerElRef?.focus();
  }

  // The user is scrolling the list: any reveal still in flight is theirs to override.
  // Called — on all three list branches — for a wheel, a touch move, and a press of any
  // mouse button inside the list (a scrollbar drag, middle-button autoscroll). Keys do not scroll the list by themselves:
  // DOM focus stays on the trigger.
  function cancelReveal() {
    revealGen = revealGen + 1;
  }

  // Scroll option `index` into view inside the scrolling listbox, for reveal `gen`, giving
  // up at time `until` (see REVEAL_PATIENCE_MS). When windowing, route through the
  // virtualizer (scrollToIndex) so an option OUTSIDE the rendered window is scrolled into
  // view (the windowed-arrow-nav seam); else the native scrollIntoView. Reads nothing
  // reactive but the id base: it runs from a deferred callback (below).
  function revealIndex(index: any, gen: any, until: any) {
    if (disposed || gen !== revealGen || index < 0 || liveActive !== index || !__rozieRootRef! || !__rozieRootRef!.isConnected) return;
    if (virtualizer) {
      // An explicit move decides the scroll-end pin (see recordScrollEnd()): going to the
      // LAST option holds the end, so virtual-core's later compensation for options that
      // measure smaller above the viewport cannot leave the last option cut off (measured
      // on Angular, 25px short); going anywhere else releases a pin left by an earlier
      // visit to the end, which otherwise scrolled the list straight back there (measured
      // on Vue and Solid: Home after End did not move the list).
      const count = virtualizer.options.count;
      scrollEndPinned = index === count - 1;
      scrollEndPinnedCount = count;
      // 'center' (not 'auto'): keep the active option well inside the rendered slice as the
      // window scrolls — 'auto' lands it at the viewport edge where the overscan band can
      // leave it just-unrendered for a frame on the fine-grained targets (Solid).
      virtualizer.scrollToIndex(index, {
        align: 'center'
      });
      scheduleRemeasure();
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => settleReveal(index, gen, until));
      return;
    }
    const el = __rozieRootRef!.querySelector('#' + CSS.escape(optionId(index)));
    if (el && el.getClientRects().length > 0) {
      el.scrollIntoView({
        block: 'nearest'
      });
      return;
    }
    // The option is not in the DOM yet, or not laid out (the popup is still opening — on
    // some targets that is a few commits after the key or click that opened it): look
    // again next frame.
    if (Date.now() < until && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => revealIndex(index, gen, until));
  }

  // The windowed reveal is done when the option IS in view, not when scrollToIndex ran:
  // checked on the DOM, one frame at a time, until it is. A scroll can be lost or undone:
  //  - the popup may not be laid out yet. A windowed list stays mounted while closed, inside
  //    a `display: none` panel, and the panel is shown a few commits after the key or click
  //    that opened it — a scroll written before that is dropped, and the row's box reads
  //    0 × 0 (which must not count as "in view"). This used to be a count of 12 frames
  //    (about 100 ms in headless Chromium), and a popup that took longer than that to
  //    appear left the list at its top with the selection out of view for good. Frames in
  //    which the list has no box are now simply waited out.
  //  - virtual-core's size compensation for options measured in the previous window writes
  //    an ABSOLUTE scrollTop from the offset it last saw, and when that lands after our
  //    scroll it puts the list back where it was (measured on Angular: Home pressed right
  //    after End left the list at the end, and virtual-core does not re-issue a scroll whose
  //    target did not change).
  // Asking again is idempotent once the list is where it should be. Stops when the option
  // is in view, the highlight moves elsewhere (a close clears it), a newer reveal starts,
  // the user scrolls (cancelReveal()), the select unmounts — or, as a safety valve only,
  // at `until`.
  function settleReveal(index: any, gen: any, until: any) {
    if (disposed || gen !== revealGen || !virtualizer || !gridScrollEl || !gridScrollEl.isConnected || liveActive !== index) return;
    const box = gridScrollEl.getBoundingClientRect();
    if (box.height > 0) {
      const el = gridScrollEl.querySelector('.rozie-select-option[data-index="' + index + '"]');
      if (el) {
        const row = el.getBoundingClientRect();
        // In view: inside the list's box — or, for an option taller than the list, covering it.
        const inside = row.top >= box.top - 1 && row.bottom <= box.bottom + 1;
        const covering = row.height > box.height && row.top <= box.top + 1 && row.bottom >= box.bottom - 1;
        if (row.height > 0 && (inside || covering)) return;
      }
      virtualizer.scrollToIndex(index, {
        align: 'center'
      });
      scheduleRemeasure();
    }
    if (Date.now() >= until || typeof requestAnimationFrame !== 'function') return;
    requestAnimationFrame(() => settleReveal(index, gen, until));
  }

  // Keep the active option visible — called by the keyboard and type-ahead paths right
  // after they write `$data.activeIndex`, and by open() (never by pointer hover, which
  // must not scroll). The scroll itself runs one frame later, on `liveActive`:
  //  - right here the index just written is not readable on React (state is a per-render
  //    snapshot): End / Home scrolled to the PREVIOUS highlight and the list only caught
  //    up on the next key;
  //  - and the list may not be on screen yet (End or a typed letter on a closed select
  //    opens it in the same handler): scrolling a hidden list does nothing.
  // One frame later every target has committed the write and the open list. Each call
  // takes a new generation, so of several requests in one frame only the last one acts,
  // and a user scroll in between (cancelReveal()) leaves none.
  function scrollActiveIntoView() {
    revealGen = revealGen + 1;
    const gen = revealGen;
    const until = Date.now() + REVEAL_PATIENCE_MS;
    const run = () => revealLive(gen, until);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);else setTimeout(run, 0);
  }
  // Reveal the committed highlight. When there is none yet — open() called outside a user
  // event (a timer, a promise) is committed by React on its own schedule, possibly after
  // this frame — look again next frame instead of giving up.
  function revealLive(gen: any, until: any) {
    if (disposed || gen !== revealGen) return;
    if (liveActive < 0) {
      if (Date.now() < until && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => revealLive(gen, until));
      return;
    }
    revealIndex(liveActive, gen, until);
  }

  // ---- windowing lifecycle (post-mount; ONLY when virtual) ----------------
  // kickWindow: the cross-target first-paint settle. Re-captures the LIVE scroll element,
  // re-attaches the virtualizer's rect observer (_willUpdate), and bumps the windowVer
  // signal so the windowed <For>/{#each}/repeat re-derives. Retried over a few frames
  // because (a) virtual-core measures the scroll rect asynchronously (D-09 Solid rAF-defer —
  // a synchronous kick sees rectH 0 → empty window) and (b) Solid/Lit recreate the list node
  // between mount and first commit (leaving virtual-core's scrollElement stale). Stops once
  // the virtualizer has items for the window (or attempts run out) — idempotent +
  // loop-free. The stop condition is read from the virtualizer itself: this chain keeps
  // the closure it started in, and a reactive read (`$data.rows`, through windowedRows())
  // was the mount-time one on React, so there it never saw the window and always ran
  // every retry.
  //
  // It does NOT feed options or the option count: on React this rAF chain runs in the
  // closure of the render it started from, so anything it reads from props is that
  // render's. Feeding from here put the mount-time options back over a set the consumer
  // replaced within the chain's few frames (measured: the old rows stayed). The `options`
  // watcher below owns the feed on every target; $onMount covers the mount-time set.
  function kickWindow(attempts: any) {
    if (disposed || !virtualizer) return;
    gridScrollEl = __rozieRootRef! ? __rozieRootRef!.querySelector('.rozie-select-list') : gridScrollEl;
    virtualizer._willUpdate();
    setWindowVer(windowVer() + 1);
    remeasureWindow();
    if (virtualizer.getVirtualItems().length === 0 && attempts > 0) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => kickWindow(attempts - 1));else setTimeout(() => kickWindow(attempts - 1), 16);
    }
  }

  // nextAutoId(): a page-wide counter shared by every Rozie component instance. It
  // lives on globalThis (read through Reflect, which type-checks in the plain-JS and
  // the TS script alike) so separately bundled copies of a leaf never hand out the
  // same id. The same four lines live in Combobox, Select and Popover.
  function nextAutoId() {
    const n = (Number(Reflect.get(globalThis, '__rozieAutoId')) || 0) + 1;
    Reflect.set(globalThis, '__rozieAutoId', n);
    return n;
  }

  // idRoot(): the `idBase` prop, else the per-instance id generated in $onMount, else the
  // pre-mount fallback. Also the listCore.rzts host contract (its optionId reads it).
  function idRoot() {
    return local.idBase || autoId() || 'rozie-select';
  }
  // popupVisible(): the single gate every list branch and aria-expanded read.
  function popupVisible() {
    if (!open$local()) return false;
    if (!local.hideEmpty) return true;
    return visibleOptions().length > 0;
  }
  // ---- composed popover <-> open state ------------------------------------
  // The popover's `open` model is bound to $data.panelOpen, NOT to $data.open: the
  // popover emits nothing of its own, it only writes its model when it dismisses
  // (outside click, or Escape seen at the document). Binding it to a field of its own
  // makes that write visible, so a popover-initiated close is routed through the
  // spine's close() like every other close — one `open-change` per real transition and
  // the highlight reset.
  //
  // Telling the popover's write from our own is done with STATE, not a flag:
  // $data.panelEcho is written together with every $data.panelOpen write made here, so
  // in any one render/flush the pair is consistent — equal means "ours", different
  // means "the popover closed itself" (it can never open itself: `trigger="manual"`).
  // A plain variable in its place is read live while the reactive values are per-render
  // snapshots on React: when a close and a re-open land in one commit, both watchers
  // run in one pass and the second one misreads our own write as a dismissal (seen as
  // a popup that stayed shut after Enter-then-ArrowDown).
  //
  // WHICH popup the popover closed is state too. `$data.session` counts the opens (the
  // open() gate) and `$data.panelSession` is the session the panel was last shown for.
  // A popover write is a dismissal of the current popup only while the two are equal.
  // They differ when the select was closed AND opened again before the watchers ran:
  // Escape is handled by the trigger (close()) and, at the document, by the popover
  // (its own write), and a key or click right after it reopens the select — on Angular,
  // whose effects run on a later tick, all of that lands in one flush, and taking the
  // leftover write for a dismissal closed the popup that had just been opened (Space
  // straight after Escape left the select shut, roughly one run in four).
  function syncPanel() {
    // A write of the popover's that the `panelOpen` watcher below has not taken yet (the
    // pair differs): leave it alone. Writing our own state over it here loses the
    // dismissal — an outside click on a button that also changes `options` runs this
    // function before that watcher on Angular, and the popup stayed "open" with no panel.
    // The watcher takes it and brings this function back with the pair equal.
    if (panelOpen() !== panelEcho()) return;
    const visible = popupVisible();
    // The panel is showing (or about to) for the CURRENT open, whether or not `panelOpen`
    // has to change for it: a shown popup closed and opened again inside one flush leaves
    // `panelOpen` where it was while the session moved on. Recording the session only on
    // a false -> true flip left it behind there, and the next real dismissal was then
    // taken for a leftover (the popup hid, came back, and needed a second dismissal).
    if (visible && panelSession() !== session()) setPanelSession(session());
    if (visible === panelOpen()) return;
    // The two writes are ordered so that, between them, the pair can only read
    // "panelOpen true, echo false" — a state no watcher takes for a dismissal (the popover
    // only ever writes `false`). That matters where watchers run synchronously on a write.
    if (visible) {
      setPanelOpen(true);
      setPanelEcho(true);
    } else {
      setPanelEcho(false);
      setPanelOpen(false);
    }
  }
  // select -> popover: everything popupVisible() reads.

  // popover -> select: the popover's own write.
  function takePanelWrite() {
    if (panelOpen() === panelEcho()) return;
    setPanelEcho(panelOpen());
    if (panelOpen()) return;
    // A dismissal of the popup that is showing goes through close().
    if (panelSession() === session()) {
      close();
      return;
    }
    // A leftover from the popup before this one: nothing to close. The panel has to be
    // shown again for the current session — but NOT in this same flush: the popover holds
    // `false` because it wrote it, and Angular only pushes a bound value down when it
    // differs from the one it pushed last (`true`), so `panelOpen` must be seen `false`
    // by one flush before it goes back to `true`. Hence a task later, through state.
    queueResync();
  }
  // The later look: nothing is remembered across the wait — the timer only bumps a
  // counter, and syncPanel() decides from the state as it is then.
  function queueResync() {
    if (resyncTimer !== null) clearTimeout(resyncTimer);
    resyncTimer = setTimeout(() => {
      resyncTimer = null;
      if (!disposed) setResync(resync() + 1);
    }, 0);
  }
  // Select-local keydown wrapper in front of the key reducer (kept out of listCore so the
  // shared partial and the sibling families' generated output stay untouched).
  //  - hideEmpty: when the popup is hidden because the list is empty ($data.open is still true
  //    internally; only the rendered/ARIA state is gated), Escape and Enter are left entirely to
  //    the host - not preventDefault'ed, not consumed. All other keys still reach the key
  //    reducer (onControlKeyDown, the host-local copy above).
  //  - selectOnTab: Tab commits the highlighted option before the reducer closes the popup,
  //    only while the popup is actually visible.
  function onTriggerKeyDown($event: any) {
    if (local.disabled) return;
    if (nativeActive()) return;
    const hidden = open$local() && !popupVisible();
    if (hidden && ($event.key === 'Escape' || $event.key === 'Enter')) return;
    if (onChipKey($event)) return;
    if (onClearKey($event)) return;
    if ($event.key === 'Tab' && open$local() && local.selectOnTab && popupVisible() && activeIndex() >= 0) commitActive();
    onControlKeyDown($event);
  }

  // ── clearable ──────────────────────────────────────────────────────────────
  function hasValue() {
    const cur = value();
    if (local.multiple) return Array.isArray(cur) && cur.length > 0;
    return cur !== null && cur !== undefined && cur !== '';
  }
  // The clear button's mousedown is prevented (keeps focus on the trigger); the handler
  // is a deliberate no-op, mirroring Combobox's onChipRemovePointerDown.
  function noop() {}
  function onClearClick() {
    if (local.disabled) return;
    clear();
    focusControl();
  }
  // Keyboard clear while the popup is closed. Returns true when it handled the key.
  function onClearKey($event: any) {
    if (!local.clearable || popupVisible() || !hasValue()) return false;
    if ($event.key === 'Delete' || $event.key === 'Backspace' && !local.multiple) {
      $event.preventDefault();
      clear();
      return true;
    }
    return false;
  }

  // ── multi-select chips ─────────────────────────────────────────────────────
  function selectedValues() {
    const cur = value();
    return Array.isArray(cur) ? cur : [];
  }
  // One row per DISTINCT selected value, in value order (a value the model holds more
  // than once shows one chip, at its first position). A value that matches no option
  // keeps a chip labelled by its raw value (and a null option) rather than vanishing.
  // `members` are the value's positions in the model — what removing the chip removes.
  // `key` is unique per row by construction (uniqueKeys): an object that matched an
  // option is keyed by that option's index (every object stringifies alike), anything
  // else by its type and string form.
  function chipRows() {
    const opts = Array.isArray(local.options) ? local.options : [];
    const rows = distinctValues(selectedValues(), opts.map((o: any) => valueOf(o)));
    const keys = uniqueKeys(rows.map((r: any, i: any) => 'chip-' + keyBase(r.value, r.at !== -1 ? r.at : i)));
    return rows.map((r: any, i: any) => r.at === -1 ? {
      key: keys[i],
      value: r.value,
      members: r.members,
      label: String(r.value),
      option: null
    } : {
      key: keys[i],
      value: r.value,
      members: r.members,
      label: labelOf(opts[r.at]),
      option: opts[r.at]
    });
  }
  function chipRemoveLabel(row: any) {
    return 'Remove ' + String(row.label);
  }
  // Removes EVERY occurrence of the chip's value: its one chip stands for all of them.
  function removeChip(row: any) {
    if (local.disabled) return;
    const next = selectedValues().filter((x: any, j: any) => !row.members.includes(j)); // fresh array every commit
    setValue(next);
    _props.onChange?.({
      value: next,
      option: null
    });
  }
  function onChipRemove(row: any) {
    removeChip(row);
    focusControl();
  }
  // Backspace with the popup closed removes the last chip (regardless of `clearable`).
  // Returns true when it handled the key.
  function onChipKey($event: any) {
    if (!local.multiple || popupVisible() || $event.key !== 'Backspace') return false;
    const rows = chipRows();
    if (rows.length === 0) return false;
    $event.preventDefault();
    removeChip(rows[rows.length - 1]);
    return true;
  }

  // A primary-button press inside the popup does not take DOM focus: focus stays on the
  // trigger (the APG select-only model — the popup is driven through
  // aria-activedescendant), so the keyboard keeps working after a pointer pick in a
  // multi-select, or after a press on a disabled option, a group heading, the padding or
  // the empty state. Without this the press moved focus to <body> and every key went
  // nowhere. Only the default action of mousedown is cancelled: the click still arrives,
  // and the scrollbar still drags.
  //
  // NOT cancelled when the press lands on something focusable or editable that a slot
  // fill brought into the popup (a field or a button in an `option`, `groupHeading` or
  // `empty` slot): that control takes focus as it would anywhere. The composed path is
  // walked up to the list (the onControlClick() approach) — on Lit a slot fill lives in the
  // light DOM while the list is in the shadow root, and `closest()` does not cross that.
  function onListMouseDown($event: any) {
    // ANY button: a primary press may start a scrollbar drag, a middle press autoscroll.
    cancelReveal();
    if ($event.button !== 0) return;
    const focusable = 'input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"]), [tabindex]';
    const path = typeof $event.composedPath === 'function' ? $event.composedPath() : [];
    if (path.length > 0) {
      for (const el of path as any) {
        if (el === $event.currentTarget) break;
        if (el && typeof el.matches === 'function' && el.matches(focusable)) return;
      }
    } else {
      const t = $event.target;
      const hit = t && typeof t.closest === 'function' ? t.closest(focusable) : null;
      if (hit && hit !== $event.currentTarget && $event.currentTarget.contains(hit)) return;
    }
    $event.preventDefault();
  }

  // A number-typed helper: a literal `0`/`-1` tabindex trips TS2869 on React
  // (`?? undefined` on a provably non-null operand) - the data-table cellTabindex precedent.
  function triggerTabindex() {
    return local.disabled || nativeActive() ? -1 : 0;
  }
  // One click handler on the whole control: the arrow, padding and (later) the chip
  // row all open the popup; the buttons inside stop propagation themselves.
  function onControlClick($event: any) {
    if (local.disabled) return;
    // The native picker owns every tap on the control (the overlay receives it).
    if (nativeActive()) return;
    // React, Svelte and Solid delegate events at the root, so stopPropagation in a
    // button handler cannot keep the click from here: decide from the event target
    // instead (one code path on all six targets). The clear button never toggles; an
    // INTERACTIVE element inside a chip (the default remove button, or any control a
    // `chip` slot fill brings) never toggles; a chip's plain content (its label) does.
    // Walk the composed path when the event offers one: on Lit a slotted fill lives in
    // the light DOM while the chip wrapper is in the shadow root, and `closest()` does
    // not cross that boundary. Fall back to `closest()` (React's synthetic event has no
    // composedPath, and has no shadow boundary either).
    const interactive = 'button, a[href], input, select, textarea, [role="button"]';
    const path = typeof $event.composedPath === 'function' ? $event.composedPath() : [];
    if (path.length > 0) {
      let seenInteractive = false;
      for (const el of path as any) {
        if (el === $event.currentTarget) break;
        if (!el || typeof el.matches !== 'function') continue;
        if (el.matches('.rozie-select-clear')) return;
        if (el.matches('.rozie-select-chip')) {
          if (seenInteractive) return;
          break;
        }
        if (el.matches(interactive)) seenInteractive = true;
      }
    } else {
      const t = $event.target;
      if (t && typeof t.closest === 'function') {
        if (t.closest('.rozie-select-clear')) return;
        const chip = t.closest('.rozie-select-chip');
        const hit = t.closest(interactive);
        if (chip && hit && chip.contains(hit)) return;
      }
    }
    toggle();
    focusControl();
  }
  // Reactive re-feed: when the option set changes, re-sync the indexable rows + push fresh
  // options into the virtualizer and re-pull the window (the data-table
  // setOptions+_willUpdate re-feed precedent). The getter is the `options` prop itself and
  // nothing else — the reference, not its length: an array replaced by another of the SAME
  // length is a new option set too (a length-keyed getter kept the old rows on Vue).
  // Nothing in a select-only host writes `$data.query`, so there is no query to follow.
  //
  // A second watcher follows the LENGTH: a list grown or shrunk in
  // place keeps its reference. And because a watcher only hears what the framework
  // reports — an in-place change is reported on Vue and Svelte, not on the other four —
  // the post-render hook below re-feeds too, whenever the virtualizer's count is not the
  // option count any more: whatever made the select render again, the windowed rows then
  // agree with what the label, the chips and the keyboard read.
  function refeedWindow() {
    syncRows();
    if (local.virtual && virtualizer) {
      gridScrollEl = __rozieRootRef! ? __rozieRootRef!.querySelector('.rozie-select-list') : gridScrollEl;
      virtualizer.setOptions(virtualizerOptions());
      virtualizer._willUpdate();
      setWindowVer(windowVer() + 1);
      scheduleRemeasure();
    }
  }

  createOutsideClick(
    [() => controlElRef, () => listElRef],
    close,
    () => open$local() && (local.inline || !popupVisible()),
  );

  return (
    <>
    <div ref={(el) => { __rozieRootRef = el as HTMLElement; }} {...attrs} class={"rozie-select" + " " + rozieClass({ 'rozie-select-open': popupVisible(), 'rozie-select-disabled': local.disabled, 'rozie-select-inline': local.inline, 'rozie-select--block': local.block, 'rozie-select--native': nativeActive() }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-6e3ebfa6="">
      
      <Popover trigger="manual" open={panelOpen()} onOpenChange={setPanelOpen} bare={true} matchWidth={true} keepMounted={local.virtual} disablePositioning={local.inline} disableDismiss={local.inline} placement={local.placement} offset={local.offset} disableFlip={local.disableFlip} disableShift={local.disableShift} idBase={idRoot()} data-rozie-s-6e3ebfa6="" anchorSlot={() => (<>
          
          <div class={"rozie-select-control"} ref={(el) => { controlElRef = el as HTMLElement; }} onClick={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onControlClick($event); }} data-rozie-s-6e3ebfa6="">
            {<Show when={local.multiple}><Key each={chipRows() as readonly any[]} by={(row) => row.key}>{(row, idx) => <span class={"rozie-select-chip"} data-rozie-s-6e3ebfa6="">
              {(_props.chipSlot ?? _props.slots?.['chip'])?.({ get option() { return row().option; }, remove: () => onChipRemove(row()), get index() { return idx(); } }) ?? <><span class={"rozie-select-chip__label"} data-rozie-s-6e3ebfa6="">{rozieDisplay(row().label)}</span><button type="button" aria-label={rozieAttr(chipRemoveLabel(row()))} class={"rozie-select-chip__remove"} tabIndex={-1} disabled={!!local.disabled} onMouseDown={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { $event.preventDefault(); noop(); }} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { onChipRemove(row()); }} data-rozie-s-6e3ebfa6="">×</button></>}
            </span>}</Key></Show>}<div role="combobox" aria-haspopup="listbox" aria-hidden={(nativeActive() ? true : null) ?? undefined} aria-expanded={!!popupVisible()} aria-controls={rozieAttr(idRoot() + '-list')} aria-activedescendant={rozieAttr(popupVisible() && activeIndex() < visibleOptions().length ? activeDescendant() : null)} aria-label={rozieAttr(local.ariaLabel)} aria-disabled={!!local.disabled} ref={(el) => { triggerElRef = el as HTMLElement; }} class={"rozie-select-trigger"} tabIndex={rozieAttr(triggerTabindex())} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLDivElement; target: Element }) => { onTriggerKeyDown($event); }} data-rozie-s-6e3ebfa6="">
              {<Show when={!local.multiple}>{(_props.selectedSlot ?? _props.slots?.['selected'])?.({ get selected() { return selectedLabel(); }, get value() { return value(); } }) ?? <Show when={selectedLabel()} fallback={<span class={"rozie-select-placeholder"} data-rozie-s-6e3ebfa6="">{local.placeholder}</span>}><span class={"rozie-select-selected"} data-rozie-s-6e3ebfa6="">{rozieDisplay(selectedLabel())}</span></Show>}</Show>}{<Show when={local.multiple && selectedValues().length === 0}><span class={"rozie-select-placeholder"} data-rozie-s-6e3ebfa6="">{local.placeholder}</span></Show>}</div>
            {<Show when={local.clearable && hasValue() && !local.disabled}><button type="button" aria-label={local.clearLabel} class={"rozie-select-clear"} tabIndex={-1} onMouseDown={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { $event.preventDefault(); noop(); }} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { onClearClick(); }} data-rozie-s-6e3ebfa6="">×</button></Show>}<span class={"rozie-select-arrow"} aria-hidden="true" data-rozie-s-6e3ebfa6="">▾</span>
            
            {<Show when={nativeActive()}><select aria-label={rozieAttr(local.ariaLabel ? local.ariaLabel : null)} class={"rozie-select-native"} disabled={!!local.disabled} onChange={($event: Event & { currentTarget: HTMLSelectElement; target: Element }) => { onNativeChange($event); }} data-rozie-s-6e3ebfa6="">
              <option value="" disabled={!!nativePlaceholderDisabled()} data-rozie-s-6e3ebfa6="">{local.placeholder}</option>
              <Key each={nativeRows().loose as readonly any[]} by={(row) => 'n-' + row.index}>{(row) => <option value={rozieAttr(row().index)} disabled={!!disabledOf(row().opt)} data-rozie-s-6e3ebfa6="">{rozieDisplay(labelOf(row().opt))}</option>}</Key>
              <Key each={nativeRows().grouped as readonly any[]} by={(blk) => 'ng-' + blk.group.id}>{(blk) => <optgroup label={rozieAttr(blk().group.label)} data-rozie-s-6e3ebfa6="">
                <Key each={blk().items as readonly any[]} by={(row) => 'n-' + row.index}>{(row) => <option value={rozieAttr(row().index)} disabled={!!disabledOf(row().opt)} data-rozie-s-6e3ebfa6="">{rozieDisplay(labelOf(row().opt))}</option>}</Key>
              </optgroup>}</Key>
            </select></Show>}</div>
        </>)}>
          
          {<Show when={popupVisible() && !local.virtual && !isGrouped()}><div role="listbox" aria-label={rozieAttr(local.ariaLabel)} aria-multiselectable={local.multiple} ref={(el) => { listElRef = el as HTMLElement; }} class={"rozie-select-list"} id={rozieAttr(idRoot() + '-list')} onMouseDown={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onListMouseDown($event); }} onWheel={($event: WheelEvent & { currentTarget: HTMLDivElement; target: Element }) => { cancelReveal(); }} onTouchMove={($event: TouchEvent & { currentTarget: HTMLDivElement; target: Element }) => { cancelReveal(); }} data-rozie-s-6e3ebfa6="">
            <Key each={flatRows() as readonly any[]} by={(row) => optionId(row.index)}>{(row) => <div role="option" aria-selected={!!row().selected} aria-disabled={!!disabledOf(row().opt)} id={rozieAttr(optionId(row().index))} class={"rozie-select-option" + " " + rozieClass({ 'is-active': activeIndex() === row().index, 'is-selected': row().selected, 'is-disabled': disabledOf(row().opt) })} onClick={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { select(row().opt); }} onMouseMove={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onOptionPointerMove(row().index); }} data-rozie-s-6e3ebfa6="">
              {(_props.optionSlot ?? _props.slots?.['option'])?.({ get option() { return row().opt; }, get index() { return row().index; }, get active() { return activeIndex() === row().index; }, get selected() { return row().selected; }, get disabled() { return disabledOf(row().opt); } }) ?? rozieDisplay(labelOf(row().opt))}
            </div>}</Key>

            {<Show when={visibleOptions().length === 0}><div class={"rozie-select-empty"} role="presentation" data-rozie-s-6e3ebfa6="">
              {(_props.emptySlot ?? _props.slots?.['empty'])?.({ get query() { return query(); } }) ?? "No options"}
            </div></Show>}</div></Show>}{<Show when={popupVisible() && !local.virtual && isGrouped()}><div role="listbox" aria-label={rozieAttr(local.ariaLabel)} aria-multiselectable={local.multiple} ref={(el) => { listElRef = el as HTMLElement; }} class={"rozie-select-list"} id={rozieAttr(idRoot() + '-list')} onMouseDown={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onListMouseDown($event); }} onWheel={($event: WheelEvent & { currentTarget: HTMLDivElement; target: Element }) => { cancelReveal(); }} onTouchMove={($event: TouchEvent & { currentTarget: HTMLDivElement; target: Element }) => { cancelReveal(); }} data-rozie-s-6e3ebfa6="">
            <Key each={groupedRows() as readonly any[]} by={(blk) => blk.key}>{(blk) => <div class={"rozie-select-group"} role="group" aria-label={rozieAttr(blk().group ? blk().group.label : null)} data-rozie-s-6e3ebfa6="">
              {<Show when={blk().group}><div class={"rozie-select-group-heading"} role="presentation" data-rozie-s-6e3ebfa6="">
                {(_props.groupHeadingSlot ?? _props.slots?.['groupHeading'])?.({ get group() { return blk().group; } }) ?? rozieDisplay(blk().group.label)}
              </div></Show>}<Key each={blk().items as readonly any[]} by={(row) => optionId(row.index)}>{(row) => <div role="option" aria-selected={!!row().selected} aria-disabled={!!disabledOf(row().opt)} id={rozieAttr(optionId(row().index))} class={"rozie-select-option" + " " + rozieClass({ 'is-active': activeIndex() === row().index, 'is-selected': row().selected, 'is-disabled': disabledOf(row().opt) })} onClick={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { select(row().opt); }} onMouseMove={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onOptionPointerMove(row().index); }} data-rozie-s-6e3ebfa6="">
                {(_props.optionSlot ?? _props.slots?.['option'])?.({ get option() { return row().opt; }, get index() { return row().index; }, get active() { return activeIndex() === row().index; }, get selected() { return row().selected; }, get disabled() { return disabledOf(row().opt); } }) ?? rozieDisplay(labelOf(row().opt))}
              </div>}</Key>
            </div>}</Key>
            {<Show when={visibleOptions().length === 0}><div class={"rozie-select-empty"} role="presentation" data-rozie-s-6e3ebfa6="">
              {(_props.emptySlot ?? _props.slots?.['empty'])?.({ get query() { return query(); } }) ?? "No options"}
            </div></Show>}</div></Show>}{<Show when={local.virtual}><div role="listbox" aria-label={rozieAttr(local.ariaLabel)} aria-multiselectable={local.multiple} ref={(el) => { listElRef = el as HTMLElement; }} class={"rozie-select-list rozie-select-list--virtual"} id={rozieAttr(idRoot() + '-list')} style={parseInlineStyle((popupVisible() ? '' : 'display:none;') + (local.maxHeight ? 'height:' + local.maxHeight + ';max-height:' + local.maxHeight + ';overflow-y:auto;--rozie-select-list-max-height:' + local.maxHeight : 'overflow-y:auto'))} onMouseDown={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onListMouseDown($event); }} onWheel={($event: WheelEvent & { currentTarget: HTMLDivElement; target: Element }) => { cancelReveal(); }} onTouchMove={($event: TouchEvent & { currentTarget: HTMLDivElement; target: Element }) => { cancelReveal(); }} data-rozie-s-6e3ebfa6="">
            <div class={"rozie-select-spacer"} aria-hidden="true" style={parseInlineStyle('height:' + padTop() + 'px')} data-rozie-s-6e3ebfa6="" />

            <Key each={windowedRows() as readonly any[]} by={(wr) => wr.row.id}>{(wr) => <div data-index={rozieAttr(wr().vi.index)} role="option" aria-selected={!!isSelected(rowOption(wr()))} aria-disabled={!!disabledOf(rowOption(wr()))} id={rozieAttr(optionId(wr().vi.index))} class={"rozie-select-option" + " " + rozieClass({ 'is-active': activeIndex() === wr().vi.index, 'is-selected': isSelected(rowOption(wr())), 'is-disabled': disabledOf(rowOption(wr())) })} onClick={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { select(rowOption(wr())); }} onMouseMove={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onOptionPointerMove(wr().vi.index); }} data-rozie-s-6e3ebfa6="">
              {(_props.optionSlot ?? _props.slots?.['option'])?.({ get option() { return rowOption(wr()); }, get index() { return wr().vi.index; }, get active() { return activeIndex() === wr().vi.index; }, get selected() { return isSelected(rowOption(wr())); }, get disabled() { return disabledOf(rowOption(wr())); } }) ?? rozieDisplay(labelOf(rowOption(wr())))}
            </div>}</Key>

            <div class={"rozie-select-spacer"} aria-hidden="true" style={parseInlineStyle('height:' + padBottom() + 'px')} data-rozie-s-6e3ebfa6="" />

            {<Show when={windowSource().length === 0}><div class={"rozie-select-empty"} role="presentation" data-rozie-s-6e3ebfa6="">
              {(_props.emptySlot ?? _props.slots?.['empty'])?.({ get query() { return query(); } }) ?? "No options"}
            </div></Show>}</div></Show>}</Popover>
    </div>
    </>
  );
}
