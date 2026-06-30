import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, useControllableState } from '@rozie/runtime-react';
import './Switch.css';

interface ChildrenCtx { checked: any; toggle: any; }

interface SwitchProps {
  /**
   * The on/off state of the switch (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a switch **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `true` is the checked/on state; reflected as `aria-checked`.
   * @example
   * <Switch r-model:modelValue="on" ariaLabel="Wi-Fi" />
   */
  modelValue?: boolean;
  defaultModelValue?: boolean;
  onModelValueChange?: (modelValue: boolean) => void;
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
  onChange?: (...args: any[]) => void;
  children?: ReactNode | ((ctx: ChildrenCtx) => ReactNode);
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface SwitchHandle {
  focus: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
}

const Switch = forwardRef<SwitchHandle, SwitchProps>(function Switch(_props: SwitchProps, ref): JSX.Element {
  const props: Omit<SwitchProps, 'disabled' | 'readonly' | 'ariaLabel'> & { disabled: boolean; readonly: boolean; ariaLabel: (string) | null } = {
    ..._props,
    disabled: _props.disabled ?? false,
    readonly: _props.readonly ?? false,
    ariaLabel: _props.ariaLabel ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { modelValue, disabled, readonly, ariaLabel, defaultValue, onModelValueChange, defaultModelValue, ...rest } = _props as SwitchProps & Record<string, unknown>;
    void modelValue; void disabled; void readonly; void ariaLabel; void defaultValue; void onModelValueChange; void defaultModelValue;
    return rest;
  })();
  const [modelValue, setModelValue] = useControllableState({
    value: props.modelValue,
    defaultValue: props.defaultModelValue ?? false,
    onValueChange: props.onModelValueChange,
  });
  const control = useRef<HTMLButtonElement | null>(null);

  function isChecked() {
    return modelValue === true;
  }
  function commitValue(next: any) {
    const v = next === true;
    setModelValue(v);
    props.onChange && props.onChange({
      checked: v
    });
  }
  function toggle() {
    if (props.disabled || props.readonly) return;
    commitValue(!isChecked());
  }
  const onClick = useCallback(() => {
    toggle();
  }, [toggle]);
  const onKeydown = useCallback((e: any) => {
    if (props.disabled || props.readonly) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
      if (e) e.preventDefault();
      toggle();
    }
  }, [props.disabled, props.readonly, toggle]);
  function controlTabindex() {
    return props.disabled ? null : 0;
  }
  function focus() {
    const el = control.current;
    if (el && el.focus) el.focus();
  }

  const _rozieExposeRef = useRef({ focus, toggle });
  _rozieExposeRef.current = { focus, toggle };
  useImperativeHandle(ref, () => ({ focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args), toggle: (...args: Parameters<typeof toggle>): ReturnType<typeof toggle> => _rozieExposeRef.current.toggle(...args) }), []);

  return (
    <>
    <button ref={control} type="button" role="switch" tabIndex={controlTabindex()} disabled={!!props.disabled} aria-checked={!!modelValue} aria-disabled={!!props.disabled} aria-readonly={!!props.readonly} aria-label={rozieAttr(props.ariaLabel)} {...attrs} className={clsx(clsx("rozie-switch", { "rozie-switch--checked": isChecked(), "rozie-switch--disabled": props.disabled }), (attrs.className as string | undefined))} onClick={($event) => { onClick(); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-5a76e232="">
      {typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)({ checked: isChecked(), toggle }) : ((props.children ?? props.slots?.['']) ?? <span className={"rozie-switch-track"} data-rozie-s-5a76e232="">
          <span className={"rozie-switch-thumb"} data-rozie-s-5a76e232="" />
        </span>)}
    </button>
    </>
  );
});
export default Switch;
