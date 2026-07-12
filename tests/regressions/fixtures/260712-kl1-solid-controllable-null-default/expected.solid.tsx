import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';

__rozieInjectStyle('SolidControllableNullDefault-bacc2ac5', `.solid-controllable-null-default[data-rozie-s-bacc2ac5] { display: block; }`);

interface SolidControllableNullDefaultProps {
  value?: (number) | null;
  defaultValue?: (number) | null;
  onValueChange?: (value: (number) | null) => void;
}

export default function SolidControllableNullDefault(_props: SolidControllableNullDefaultProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['value']);

  const [value, setValue] = createControllableSignal<number | null>(_props as unknown as Record<string, unknown>, 'value', null);

  return (
    <>
    <div {...attrs} class={"solid-controllable-null-default" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-bacc2ac5="">
      <span data-rozie-s-bacc2ac5="">{value()}</span>
    </div>
    </>
  );
}
