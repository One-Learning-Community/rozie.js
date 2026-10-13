import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

/** An entry of the `groups` prop. */
export interface SelectGroup {
  id: string;
  label: string;
}

export interface SelectProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'options' | 'value' | 'defaultValue' | 'onValueChange' | 'multiple' | 'inline' | 'disabled' | 'placeholder' | 'closeOnSelect' | 'optionLabel' | 'optionValue' | 'optionDisabled' | 'idBase' | 'hideEmpty' | 'selectOnTab' | 'clearable' | 'clearLabel' | 'nativePicker' | 'placement' | 'offset' | 'disableFlip' | 'disableShift' | 'block' | 'groups' | 'ariaLabel' | 'virtual' | 'estimateRowHeight' | 'maxHeight' | 'onOpenChange' | 'onChange' | 'renderChip' | 'renderSelected' | 'renderOption' | 'renderEmpty' | 'renderGroupHeading' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  /**
   * The option set. Each entry is either a primitive (`string`/`number`) or an object; objects resolve their label, value, and disabled state via the `option*` resolver props, falling back to `.label` / `.value` / `.disabled`. An option is the selected one when its value is the model value — the same reference, or, for object values, an object with the same prototype and equal contents (so a value read back through reactive state still matches).
   */
  options?: unknown[];
  /**
   * The selected value (two-way `r-model`) — a scalar in single-select, an array of values in multi-select. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Select **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
   * @example
   * <Select value={fruit} onValueChange={setFruit} options={fruits} />
   */
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (next: (unknown) | null) => void;
  /**
   * Enable multi-select: `value` becomes an array, selecting an option toggles its membership, and the popup stays open after each commit. Selected values render as removable chips inside the control (a value missing from `options` keeps a chip labelled by its raw value), and Backspace removes the last chip while the popup is closed. A value the array holds more than once shows a single chip; removing that chip, or picking its option again, removes every occurrence.
   */
  multiple?: boolean;
  /**
   * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the select inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
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
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  optionValue?: ((...args: any[]) => any) | null;
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  optionDisabled?: ((...args: any[]) => any) | null;
  /**
   * Id base for the popup, option and control elements — `aria-activedescendant` needs real ids. Option ids are `idBase + "-opt-" + i`, the popup id is `idBase + "-list"`. Leave it empty (the default) and each instance generates a unique id base after mount (`rozie-select-<n>`). Named `idBase` (not `id`) to avoid shadowing `HTMLElement.id` on the Lit custom element.
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
  groups?: unknown[];
  /**
   * Accessible name for the control when there is no visible `<label for>` pointing at its `id` (`aria-label`).
   */
  ariaLabel?: (string) | null;
  /**
   * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling list (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed select. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded. Grouping is not applied while `virtual` is on.
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
  renderChip?: (params: { option: any; remove: () => void; index: number }) => ReactNode;
  renderSelected?: (params: { selected: unknown; value: unknown }) => ReactNode;
  renderOption?: (params: { option: unknown; index: unknown; active: unknown; selected: unknown; disabled: unknown }) => ReactNode;
  renderEmpty?: (params: { query: unknown }) => ReactNode;
  renderGroupHeading?: (params: { group: SelectGroup }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface SelectHandle {
  open: (...args: any[]) => any;
  close: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  focusControl: (...args: any[]) => any;
}

declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<SelectHandle>>;
export default Select;
