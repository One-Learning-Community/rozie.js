import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-solid';

interface ObjectInterpProps {}

export default function ObjectInterp(_props: ObjectInterpProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [obj, setObj] = createSignal({
    a: 1,
    b: [2, 3]
  });

  return (
    <>
    <div {...attrs} class={"object-interp" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-aca60b6e="">
      <p class={`card--${rozieDisplay(obj())}`} data-x={rozieAttr(obj())} data-rozie-s-aca60b6e="">{rozieDisplay(obj())}</p>
    </div>
    </>
  );
}
