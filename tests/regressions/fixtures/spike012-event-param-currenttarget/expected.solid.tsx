import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';

interface EventParamCurrentTargetProps {}

export default function EventParamCurrentTarget(_props: EventParamCurrentTargetProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [q, setQ] = createSignal('');

  return (
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-f0266236=""><input onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { setQ($event.currentTarget.value); }} data-rozie-s-f0266236="" /></div>
    </>
  );
}
