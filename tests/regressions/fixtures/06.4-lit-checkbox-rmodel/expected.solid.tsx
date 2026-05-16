import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { createControllableSignal } from '@rozie/runtime-solid';

interface CheckboxRModelProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export default function CheckboxRModel(_props: CheckboxRModelProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['checked']);

  const [checked, setChecked] = createControllableSignal(_props as Record<string, unknown>, 'checked', false);

  return (
    <>
    <style>{`.toggle[data-rozie-s-5898a126] { display: inline-flex; gap: 0.25rem; align-items: center; }`}</style>
    <>
    <label class={"toggle"} data-rozie-s-5898a126="">
      
      <input type="checkbox" checked={checked()} onChange={e => setChecked(e.currentTarget.checked)} data-rozie-s-5898a126="" />
      <span data-rozie-s-5898a126="">Enabled</span>
    </label>
    </>
    </>
  );
}
