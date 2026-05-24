import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';

__rozieInjectStyle('CheckboxRModel-5898a126', `.toggle[data-rozie-s-5898a126] { display: inline-flex; gap: 0.25rem; align-items: center; }`);

interface CheckboxRModelProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export default function CheckboxRModel(_props: CheckboxRModelProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['checked']);

  const [checked, setChecked] = createControllableSignal<boolean>(_props as unknown as Record<string, unknown>, 'checked', false);

  return (
    <>
    <label {...attrs} class={"toggle" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-5898a126="">
      
      <input type="checkbox" checked={checked()} onChange={e => setChecked(e.currentTarget.checked)} data-rozie-s-5898a126="" />
      <span data-rozie-s-5898a126="">Enabled</span>
    </label>
    </>
  );
}
