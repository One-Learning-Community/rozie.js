import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { createControllableSignal } from '@rozie/runtime-solid';

interface ControllableNoPropsProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
}

export default function ControllableNoProps(_props: ControllableNoPropsProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['value']);

  const [value, setValue] = createControllableSignal(_props as Record<string, unknown>, 'value', 0);

  // D-VR-03 reproduction: a Solid component with a defaulted model:true prop,
  // mounted with NO props passed (the visual-regression host mounts every cell
  // bare). The emitted `createControllableSignal(_props, 'value', 0)` was handed
  // `_props === undefined` and crashed with "Cannot read properties of undefined
  // (reading 'defaultValue')". The runtime helper must tolerate an absent props
  // object and fall back to the declared default.
  const bump = () => {
    setValue(value() + 1);
  };

  return (
    <>
    <style>{`.bump { font-variant-numeric: tabular-nums; }`}</style>
    <>
    <button class={"bump"} onClick={bump}>{value()}</button>
    </>
    </>
  );
}
