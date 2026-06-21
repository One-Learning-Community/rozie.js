import type { JSX } from 'solid-js';
import { createMemo, mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';
import { clamp } from './partial-helpers.js';
// leading: the first used $computed export sits ZERO blank lines below the import (the gap-0 seam)

interface PartialInlineHostFProps {
  base?: number;
}

export default function PartialInlineHostF(_props: PartialInlineHostFProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  const usedFirstF = createMemo(() => clamp(tickF + local.base));
  const usedSecondF = createMemo(() => clamp(usedFirstF() + 1));

  const tickF = local.base * 2;

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-de500702="">
      <span class={"echo"} data-rozie-s-de500702="">{rozieDisplay(usedFirstF())}</span>
      <span class={"echo"} data-rozie-s-de500702="">{rozieDisplay(usedSecondF())}</span>
    </div>
    </>
  );
}
