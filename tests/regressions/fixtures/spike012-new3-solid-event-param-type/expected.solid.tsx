import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';

interface SolidEventParamTypeProps {}

export default function SolidEventParamType(_props: SolidEventParamTypeProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [n, setN] = createSignal(0);

  function bump(): void {
    setN(n() + 1);
  }

  return (
    <>
    <div {...attrs} class={"root" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-618cbb65="">
      <button class={"stop"} onClick={($event: MouseEvent) => { $event.stopPropagation(); bump(); }} data-rozie-s-618cbb65="">{n()}</button>
      <button class={"plain"} onClick={($event: MouseEvent) => { bump(); }} data-rozie-s-618cbb65="">plain</button>
    </div>
    </>
  );
}
