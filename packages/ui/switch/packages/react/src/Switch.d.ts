import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface SwitchProps {
  /**
   * The on/off state of the switch (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a switch **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `true` is the checked/on state; reflected as `aria-checked`.
   * @example
   * <Switch r-model:modelValue="on" ariaLabel="Wi-Fi" />
   */
  modelValue?: boolean;
  defaultModelValue?: boolean;
  onModelValueChange?: (next: boolean) => void;
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
  ariaLabel?: (string) | null;
  onChange?: (...args: unknown[]) => void;
  children?: ReactNode | ((params: { checked: unknown; toggle: () => void }) => ReactNode);
  slots?: Record<string, () => ReactNode>;
}

export interface SwitchHandle {
  focus: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
}

declare const Switch: React.ForwardRefExoticComponent<SwitchProps & React.RefAttributes<SwitchHandle>>;
export default Switch;
