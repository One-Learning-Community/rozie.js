import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { createControllableSignal, mergeListeners } from '@rozie/runtime-solid';

interface ControllableNoPropsProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
}

export default function ControllableNoProps(_props: ControllableNoPropsProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['value']);

  const [value, setValue] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'value', 0);

  // D-VR-03 reproduction: a Solid component with a defaulted model:true prop,
  // mounted with NO props passed (the visual-regression host mounts every cell
  // bare). The emitted `createControllableSignal(_props, 'value', 0)` was handed
  // `_props === undefined` and crashed with "Cannot read properties of undefined
  // (reading 'defaultValue')". The runtime helper must tolerate an absent props
  // object and fall back to the declared default.
  function bump() {
    setValue(value() + 1);
  }

  return (
    <>
    <style>{`.bump[data-rozie-s-141c4000] { font-variant-numeric: tabular-nums; }`}</style>
    <>
    <button {...attrs} class={"bump" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} {...mergeListeners({ onClick: bump }, attrs)} data-rozie-s-141c4000="">{value()}</button>
    </>
    </>
  );
}
