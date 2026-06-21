import { useMemo } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import { clamp } from './partial-helpers.js';

interface InlineEquivHostFProps {
  base?: number;
}

export default function InlineEquivHostF(_props: InlineEquivHostFProps): JSX.Element {
  const props: Omit<InlineEquivHostFProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as InlineEquivHostFProps & Record<string, unknown>;
    void base;
    return rest;
  })();
  const usedFirstF = useMemo(() => clamp(tickF + props.base), [clamp, props.base, tickF]);
  const usedSecondF = useMemo(() => clamp(usedFirstF + 1), [clamp, usedFirstF]);

  const tickF = props.base * 2;

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-13935c1a="">
      <span className={"echo"} data-rozie-s-13935c1a="">{rozieDisplay(usedFirstF)}</span>
      <span className={"echo"} data-rozie-s-13935c1a="">{rozieDisplay(usedSecondF)}</span>
    </div>
    </>
  );
}
