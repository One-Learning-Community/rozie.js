import type { JSX } from 'solid-js';
import { createMemo, mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';
import { clamp } from './partial-helpers.js';

interface InlineEquivHostFProps {
  base?: number;
}

export default function InlineEquivHostF(_props: InlineEquivHostFProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  const usedFirstF = createMemo(() => clamp(tickF + local.base));
  const usedSecondF = createMemo(() => clamp(usedFirstF() + 1));

  const tickF = local.base * 2;

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-13935c1a="">
      <span class={"echo"} data-rozie-s-13935c1a="">{rozieDisplay(usedFirstF())}</span>
      <span class={"echo"} data-rozie-s-13935c1a="">{rozieDisplay(usedSecondF())}</span>
    </div>
    </>
  );
}
