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
    <style>{`.toggle { display: inline-flex; gap: 0.25rem; align-items: center; }`}</style>
    <>
    <label class={"toggle"}>
      
      <input type="checkbox" checked={checked()} onChange={e => setChecked(e.currentTarget.checked)} />
      <span>Enabled</span>
    </label>
    </>
    </>
  );
}
