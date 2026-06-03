import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';

__rozieInjectStyle('CvaOffState-a2873aa8', `.cva-off-state[data-rozie-s-a2873aa8] { display: inline-flex; align-items: center; gap: 0.5rem; }
input[data-rozie-s-a2873aa8] { padding: 0.25rem 0.5rem; }
.echo[data-rozie-s-a2873aa8] { color: rgba(0, 0, 0, 0.6); }`);

interface CvaOffStateProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export default function CvaOffState(_props: CvaOffStateProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['value']);

  const [value, setValue] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'value', '');

  // Producer-side write to the `value` model prop: writing `$model.value`
  // lowers to each target's two-way emit (Vue `emit('update:value', …)`,
  // React `onValueChange?.(…)`, Angular `valueChange.emit(…)`, etc.). This is
  // the single-model shape Phase 23's CVA auto-wires the Angular accessor onto.
  function onInput(e: any) {
    setValue(e.target.value);
  }

  return (
    <>
    <div {...attrs} class={"cva-off-state" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-a2873aa8="">
      <input type="text" placeholder="Type a value" value={value()} onInput={onInput} data-rozie-s-a2873aa8="" />
      <span class={"echo"} data-rozie-s-a2873aa8="">{value()}</span>
    </div>
    </>
  );
}
