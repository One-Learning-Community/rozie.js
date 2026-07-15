import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';

interface FnPropNullGateProps {
  onSave?: (...args: any[]) => any;
  onCancel?: ((...args: any[]) => any) | null;
}

export default function FnPropNullGate(_props: FnPropNullGateProps): JSX.Element {
  const _merged = mergeProps({ onSave: () => {}, onCancel: null }, _props);
  const [local, attrs] = splitProps(_merged, ['onSave', 'onCancel']);

  const [n, setN] = createSignal(0);

  return (
    <>
    <div {...attrs} class={"fpg" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-a5944868="">
      <button class={"save"} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { (local.onSave)?.($event); }} data-rozie-s-a5944868="">save</button>
      <button class={"cancel"} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { local.onCancel && local.onCancel(); }} data-rozie-s-a5944868="">cancel</button>
      <span class={"n"} data-rozie-s-a5944868="">{n()}</span>
    </div>
    </>
  );
}
