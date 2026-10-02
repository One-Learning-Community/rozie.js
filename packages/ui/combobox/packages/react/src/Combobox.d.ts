import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

// The typed public surface (typed-surface P1; always TypeScript). `value` /
// `option` stay `any`: options are consumer-shaped objects (or primitives) the
// component never inspects beyond the label/value/disabled resolvers.
/** `search` payload — the current input text. */
export interface ComboboxSearchPayload {
  query: string;
}
/** `change` payload — `option` is the raw source option (`null` for a clear or a free-text commit); `text` is set ONLY on free-text commits. */
export interface ComboboxChangePayload {
  value: any;
  option: any;
  selected: boolean;
  text?: string;
}
/** `create` payload — the (untrimmed) query the user asked to create. */
export interface ComboboxCreatePayload {
  query: string;
}
/** An entry of the `groups` prop. */
export interface ComboboxGroup {
  id: string;
  label: string;
}
/** `chip` slot params — `remove()` removes the chip and refocuses the input. */
export interface ComboboxChipSlotCtx {
  option: any;
  remove: () => void;
  index: number;
}
/** `option` slot params. */
export interface ComboboxOptionSlotCtx {
  option: any;
  index: number;
  active: boolean;
  selected: boolean;
  disabled: boolean;
}
/** `empty` / `create` slot params. */
export interface ComboboxQuerySlotCtx {
  query: string;
}
/** `groupHeading` slot params. */
export interface ComboboxGroupHeadingSlotCtx {
  group: ComboboxGroup;
}
/** `groupMore` slot params. */
export interface ComboboxGroupMoreSlotCtx {
  group: ComboboxGroup | null;
  hidden: number;
  expand: () => void;
}

export interface ComboboxProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'value' | 'defaultValue' | 'onValueChange' | 'options' | 'placeholder' | 'disabled' | 'disableFilter' | 'ariaLabel' | 'idBase' | 'inline' | 'closeOnSelect' | 'multiple' | 'creatable' | 'optionLabel' | 'optionValue' | 'optionDisabled' | 'virtual' | 'estimateRowHeight' | 'maxHeight' | 'groups' | 'groupCap' | 'placement' | 'offset' | 'disableFlip' | 'disableShift' | 'block' | 'chipLayout' | 'disableOpenOnFocus' | 'hideEmpty' | 'delimiters' | 'validate' | 'selectOnTab' | 'onSearch' | 'onChange' | 'onCreate' | 'renderChip' | 'renderOption' | 'renderEmpty' | 'renderCreate' | 'renderGroupHeading' | 'renderGroupMore' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  /**
   * The selected option's value (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a combobox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `null` when nothing is selected.
   * @example
   * <Combobox value={country} onValueChange={setCountry} options={countries} />
   */
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (next: (unknown) | null) => void;
  /**
   * The option list — `[{ value, label, disabled?, group? }]`. `label` is the displayed text (and what client filtering matches against), `value` is what `r-model:value` reads and writes, an optional `disabled` flag makes an option non-selectable, and an optional `group` string buckets the option under a matching entry of the `groups` prop (or a first-appearance fallback section) when grouping is active.
   */
  options?: unknown[];
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
  ariaLabel?: (string) | null;
  /**
   * Id base for the listbox and option elements — `aria-activedescendant` needs real ids. Option ids are derived as `idBase + "-opt-" + i`. Set a **distinct** value per instance when more than one combobox shares a page. Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
   */
  idBase?: string;
  /**
   * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the combobox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
   */
  inline?: boolean;
  /**
   * Close the popup after a selection commits. Unset (default) resolves through `effectiveCloseOnSelect()`: `true` in single-select (today's default behavior) and `false` in `multiple` mode, where closing after every chip pick would make multi-select unusable. Pass an explicit `true` or `false` to override in either mode.
   */
  closeOnSelect?: (boolean) | null;
  /**
   * `value` widens to hold an **array** of selected values and remains the sole `model: true` prop, so the Angular `ControlValueAccessor` is preserved (a second model would forfeit it — `ROZ125`). Re-selecting an already-selected option toggles it off. Default `false` is byte-identical to single-select.
   */
  multiple?: boolean;
  /**
   * When the user commits text matching no option (case-insensitive, trimmed, exact label equality — no Unicode normalization applied), combobox emits `create` with the query and writes NOTHING to `value` — the consumer adds the option to `options` and updates the model itself. Composes with `multiple`. Turning this on replaces the `#empty` fill with the `#create` row whenever the query is creatable (non-empty, no exact match); `#empty` still renders for an empty or whitespace-only query. Default `false` is byte-identical to today.
   */
  creatable?: boolean;
  /**
   * Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property.
   */
  optionLabel?: ((...args: any[]) => any) | null;
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  optionValue?: ((...args: any[]) => any) | null;
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  optionDisabled?: ((...args: any[]) => any) | null;
  /**
   * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling popup (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed combobox. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded.
   */
  virtual?: boolean;
  /**
   * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  estimateRowHeight?: number;
  /**
   * A CSS length string bounding the popup scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-combobox-list-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
   */
  maxHeight?: string;
  /**
   * Ordered section list `[{ id, label }]` setting group order + heading text. Options are partitioned by their optional `group?` string; groups present on options but absent here fall back to first-appearance order after the listed ones. Empty/absent ⇒ flat, ungrouped rendering (default).
   */
  groups?: unknown[];
  /**
   * Cap each native section group to its first `groupCap` results, adding a keyboard-reachable '+N more' row that expands that group IN PLACE when activated. `0`/absent = uncapped (default). Only applies to the non-virtual grouped render (`groups` non-empty); ignored when `virtual` is on.
   */
  groupCap?: number;
  /**
   * Floating UI placement of the popup relative to the control, forwarded to the composed `@rozie-ui/popover` leaf — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end`. Default `"bottom-start"` matches the pre-Phase-86 static popup alignment (flush with the control's left edge). Ignored when `inline` is set.
   */
  placement?: string;
  /**
   * Gap in pixels between the control and the popup, forwarded to the composed `@rozie-ui/popover` leaf. Default `4` preserves the pre-Phase-86 resting gap (`--rozie-combobox-list-gap`). Ignored when `inline` is set.
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
   * Fill the container: the root becomes `display: block; width: 100%`, the control (chips + input) stretches to that width, and the width-matched popup follows. Adds the `rozie-combobox--block` modifier class on the root. Default `false` keeps the fixed `--rozie-combobox-width` sizing.
   */
  block?: boolean;
  /**
   * Chip rail layout under `multiple`: `'stacked'` (default) renders the chips above the input; `'inline'` puts the chips and the input on ONE wrapping row (the Tags layout), with the input taking the remaining width (`flex: 1`, never narrower than `--rozie-combobox-inline-input-min-width`). Only meaningful with `multiple`.
   */
  chipLayout?: string;
  /**
   * Do not open the list when the input gains focus. Typing and ArrowDown / ArrowUp still open it. Default `false` opens on focus.
   */
  disableOpenOnFocus?: boolean;
  /**
   * Show nothing instead of the empty state: when there are no option rows and no create row, the popup is not shown, the input reports `aria-expanded="false"`, and Escape is left to the host (not `preventDefault`ed). This is the supported way to render no popup at all; filling the `empty` slot with nothing still renders the fallback on most targets.
   */
  hideEmpty?: boolean;
  /**
   * Keys that commit the **typed text** as a value (matched against the key event's `key`), under `multiple` only — a delimiter never picks the highlighted option. Character entries (e.g. `[',', ';']`) also split pasted text: a paste containing a delimiter is split on them and every non-empty trimmed part is committed. `'Enter'` and `'Tab'` are allowed; Enter then commits the typed text only when no option is highlighted. A non-empty list (or a `validate` function) turns on free-text commits, so Enter with no highlighted option commits the typed text too. Default `[]` (off).
   * @example
   * <Combobox multiple value={to} onValueChange={setTo} options={contacts} delimiters={delims} />
   */
  delimiters?: unknown[];
  /**
   * Free-text gate, `(text: string) => boolean`, under `multiple` only. Called with the trimmed typed (or pasted) text before every free-text commit; return `false` to reject it — rejected text stays in the input. Setting it also turns on free-text commits (Enter with no highlighted option commits the typed text). A free-text commit appends the text to `value` (skipped when already present), clears the input, and emits `change` with `option: null` and the committed `text`.
   * @example
   * <Combobox multiple value={to} onValueChange={setTo} options={contacts} validate={isEmail} />
   */
  validate?: ((...args: any[]) => any) | null;
  /**
   * Tab picks the highlighted option while the popup is visible and an option is highlighted, keeping focus in the input. When nothing is picked, Tab moves focus normally. Default `false` (Tab always moves focus).
   */
  selectOnTab?: boolean;
  onSearch?: (payload: ComboboxSearchPayload) => void;
  onChange?: (payload: ComboboxChangePayload) => void;
  onCreate?: (payload: ComboboxCreatePayload) => void;
  renderChip?: (params: { option: any; remove: () => void; index: number }) => ReactNode;
  renderOption?: (params: { option: any; index: number; active: boolean; selected: boolean; disabled: boolean }) => ReactNode;
  renderEmpty?: (params: { query: string }) => ReactNode;
  renderCreate?: (params: { query: string }) => ReactNode;
  renderGroupHeading?: (params: { group: ComboboxGroup }) => ReactNode;
  renderGroupMore?: (params: { group: ComboboxGroup | null; hidden: number; expand: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface ComboboxHandle {
  focus: () => void;
  clear: () => void;
  seedQuery: (text: string) => void;
  pinOpen: (v: boolean) => void;
  activeOption: () => any;
}

declare const Combobox: React.ForwardRefExoticComponent<ComboboxProps & React.RefAttributes<ComboboxHandle>>;
export default Combobox;
