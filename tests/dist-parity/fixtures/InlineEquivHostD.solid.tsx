import type { JSX } from 'solid-js';
import { createMemo, mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';
import { clampD } from './wr01-helpers.js';

interface InlineEquivHostDProps {
  base?: number;
}

export default function InlineEquivHostD(_props: InlineEquivHostDProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  const inner = createMemo(() => local.base + 10);
  const outer = createMemo(() => clampD(inner() + local.base));

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-bf28abea="">
      <span class={"echo"} data-rozie-s-bf28abea="">{rozieDisplay(outer())}</span>
    </div>
    </>
  );
}
