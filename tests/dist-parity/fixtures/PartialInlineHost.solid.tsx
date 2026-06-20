import type { JSX } from 'solid-js';
import { createMemo, mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';
import { clamp } from './partial-helpers.js';

interface PartialInlineHostProps {
  base?: number;
}

export default function PartialInlineHost(_props: PartialInlineHostProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  const usedName = createMemo(() => clamp(double(local.base)));

  function double(n: number): number {
    return n * 2;
  }

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-28f2dfac="">
      <span class={"echo"} data-rozie-s-28f2dfac="">{rozieDisplay(usedName())}</span>
    </div>
    </>
  );
}
