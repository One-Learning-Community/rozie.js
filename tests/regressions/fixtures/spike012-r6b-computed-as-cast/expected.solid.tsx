import type { JSX } from 'solid-js';
import { createMemo, mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface ComputedAsCastProps {
  raw?: string;
}

export default function ComputedAsCast(_props: ComputedAsCastProps): JSX.Element {
  const _merged = mergeProps({ raw: '' }, _props);
  const [local, attrs] = splitProps(_merged, ['raw']);

  const label = createMemo(() => ((local.raw + '!') as string));

  return (
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-6ad03933="">{rozieDisplay(label())}</div>
    </>
  );
}
