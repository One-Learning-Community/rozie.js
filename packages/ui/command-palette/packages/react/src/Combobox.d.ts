import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface ComboboxProps {
  /**
   * The selected option's value (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a combobox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `null` when nothing is selected.
   * @example
   * <Combobox r-model:value="country" :options="countries" />
   */
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (next: (unknown) | null) => void;
  /**
   * The option list — `[{ value, label, disabled? }]`. `label` is the displayed text (and what client filtering matches against), `value` is what `r-model:value` reads and writes, and an optional `disabled` flag makes an option non-selectable.
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
   * Close the popup after a selection commits. Defaults `true` (standard autocomplete behavior); set to `false` to keep the popup open after a selection — e.g. when the combobox is embedded in a multi-action surface like a command palette.
   */
  closeOnSelect?: boolean;
  /**
   * Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property.
   */
  optionLabel?: ((...args: unknown[]) => unknown) | null;
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  optionValue?: ((...args: unknown[]) => unknown) | null;
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  optionDisabled?: ((...args: unknown[]) => unknown) | null;
  onChange?: (...args: unknown[]) => void;
  onSearch?: (...args: unknown[]) => void;
  renderOption?: (params: { option: unknown; index: unknown; active: unknown; selected: unknown; disabled: unknown }) => ReactNode;
  renderEmpty?: (params: { query: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface ComboboxHandle {
  focus: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

declare const Combobox: React.ForwardRefExoticComponent<ComboboxProps & React.RefAttributes<ComboboxHandle>>;
export default Combobox;
