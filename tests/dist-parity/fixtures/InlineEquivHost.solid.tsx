import type { JSX } from 'solid-js';
import { createMemo, mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';
import { clamp } from './partial-helpers.js';

interface InlineEquivHostProps {
  base?: number;
}

export default function InlineEquivHost(_props: InlineEquivHostProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  const usedName = createMemo(() => clamp(double(local.base)));

  function double(n: number): number {
    return n * 2;
  }

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-c60d9dd6="">
      <span class={"echo"} data-rozie-s-c60d9dd6="">{rozieDisplay(usedName())}</span>
    </div>
    </>
  );
}
