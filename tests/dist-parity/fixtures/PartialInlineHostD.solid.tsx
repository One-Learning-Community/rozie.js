import type { JSX } from 'solid-js';
import { createMemo, mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';
import { clampD } from './wr01-helpers.js';

interface PartialInlineHostDProps {
  base?: number;
}

export default function PartialInlineHostD(_props: PartialInlineHostDProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  const inner = createMemo(() => local.base + 10);
  const outer = createMemo(() => clampD(inner() + local.base));

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-dd6eac9a="">
      <span class={"echo"} data-rozie-s-dd6eac9a="">{rozieDisplay(outer())}</span>
    </div>
    </>
  );
}
