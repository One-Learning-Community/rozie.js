import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';
import { createDebouncedHandler } from '@rozie/runtime-solid';

interface FunctionPropDefaultValueProps {
  onPick?: (...args: any[]) => any;
}

export default function FunctionPropDefaultValue(_props: FunctionPropDefaultValueProps): JSX.Element {
  const _merged = mergeProps({ onPick: () => {} }, _props);
  const [local, attrs] = splitProps(_merged, ['onPick']);

  const [n, setN] = createSignal(0);

  function bump(): void {
    setN(n() + 1);
  }

  const _rozieDebouncedHandler0 = createDebouncedHandler(local.onPick, 300);

  return (
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-8a79dce7=""><input onInput={_rozieDebouncedHandler0} data-rozie-s-8a79dce7="" /></div>
    </>
  );
}
