import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';

interface EventParamMergeProps {}

export default function EventParamMerge(_props: EventParamMergeProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [n, setN] = createSignal(0);

  function bump(): void {
    setN(n() + 1);
  }
  function other(): void {
    setN(n() + 2);
  }

  return (
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-9690701e=""><button onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { (($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { $event.stopPropagation(); bump(); })($event); (($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { other(); })($event); }} data-rozie-s-9690701e="">go</button></div>
    </>
  );
}
