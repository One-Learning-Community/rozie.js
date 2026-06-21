import { useMemo } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import { clamp } from './partial-helpers.js';
// leading: the first used $computed export sits ZERO blank lines below the import (the gap-0 seam)

interface PartialInlineHostFProps {
  base?: number;
}

export default function PartialInlineHostF(_props: PartialInlineHostFProps): JSX.Element {
  const props: Omit<PartialInlineHostFProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as PartialInlineHostFProps & Record<string, unknown>;
    void base;
    return rest;
  })();
  const usedFirstF = useMemo(() => clamp(tickF + props.base), [clamp, props.base, tickF]);
  const usedSecondF = useMemo(() => clamp(usedFirstF + 1), [clamp, usedFirstF]);

  const tickF = props.base * 2;

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-de500702="">
      <span className={"echo"} data-rozie-s-de500702="">{rozieDisplay(usedFirstF)}</span>
      <span className={"echo"} data-rozie-s-de500702="">{rozieDisplay(usedSecondF)}</span>
    </div>
    </>
  );
}
