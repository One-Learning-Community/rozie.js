import { clsx, useControllableState } from '@rozie/runtime-react';
import './CvaOffState.css';

interface CvaOffStateProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export default function CvaOffState(props: CvaOffStateProps): JSX.Element {
  const attrs: Record<string, unknown> = (() => {
    const { value, defaultValue, onValueChange, ...rest } = props as CvaOffStateProps & Record<string, unknown>;
    void value; void defaultValue; void onValueChange;
    return rest;
  })();
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? '',
    onValueChange: props.onValueChange,
  });

  // Producer-side write to the `value` model prop: writing `$model.value`
  // lowers to each target's two-way emit (Vue `emit('update:value', …)`,
  // React `onValueChange?.(…)`, Angular `valueChange.emit(…)`, etc.). This is
  // the single-model shape Phase 23's CVA auto-wires the Angular accessor onto.
  function onInput(e: any) {
    setValue(e.target.value);
  }

  return (
    <>
    <div {...attrs} className={clsx("cva-off-state", (attrs.className as string | undefined))} data-rozie-s-a2873aa8="">
      <input type="text" value={value} placeholder="Type a value" onInput={onInput} data-rozie-s-a2873aa8="" />
      <span className={"echo"} data-rozie-s-a2873aa8="">{value}</span>
    </div>
    </>
  );
}
