import type { JSX } from 'solid-js';
import { createSignal, mergeProps, onCleanup, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('OnMountMountLocalCleanup-c1a25008', `.ticks[data-rozie-s-c1a25008] { font-variant-numeric: tabular-nums; }`);

interface OnMountMountLocalCleanupProps {
  label?: string;
}

export default function OnMountMountLocalCleanup(_props: OnMountMountLocalCleanupProps): JSX.Element {
  const _merged = mergeProps({ label: '' }, _props);
  const [local, attrs] = splitProps(_merged, ['label']);

  const [ticks, setTicks] = createSignal(0);
  onMount(() => {
    const timer = setInterval(() => {
      setTicks(ticks() + 1);
    }, 1000);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <>
    <div {...attrs} class={"ticks" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-c1a25008="">{ticks()}</div>
    </>
  );
}
