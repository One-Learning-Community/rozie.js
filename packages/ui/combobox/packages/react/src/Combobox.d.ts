import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface ComboboxProps {
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
  onChange?: (...args: unknown[]) => void;
  onSearch?: (...args: unknown[]) => void;
  renderOption?: (params: { option: unknown; index: unknown; active: unknown; selected: unknown; disabled: unknown }) => ReactNode;
  renderEmpty?: (params: { query: unknown }) => ReactNode;
  renderGroupHeading?: (params: { group: unknown }) => ReactNode;
  renderOption?: (params: { option: unknown; index: unknown; active: unknown; selected: unknown; disabled: unknown }) => ReactNode;
  renderEmpty?: (params: { query: unknown }) => ReactNode;
  renderGroupHeading?: (params: { group: unknown }) => ReactNode;
  renderOption?: (params: { option: unknown; index: unknown; active: unknown; selected: unknown; disabled: unknown }) => ReactNode;
  renderGroupMore?: (params: { group: unknown; hidden: unknown; expand: unknown }) => ReactNode;
  renderEmpty?: (params: { query: unknown }) => ReactNode;
  renderOption?: (params: { option: unknown; index: unknown; active: unknown; selected: unknown; disabled: unknown }) => ReactNode;
  renderEmpty?: (params: { query: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface ComboboxHandle {
  focus: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  seedQuery: (...args: any[]) => any;
  pinOpen: (...args: any[]) => any;
}

declare const Combobox: React.ForwardRefExoticComponent<ComboboxProps & React.RefAttributes<ComboboxHandle>>;
export default Combobox;
