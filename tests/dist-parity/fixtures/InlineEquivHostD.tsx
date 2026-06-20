import { useMemo } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import { clampD } from './wr01-helpers.js';

interface InlineEquivHostDProps {
  base?: number;
}

export default function InlineEquivHostD(_props: InlineEquivHostDProps): JSX.Element {
  const props: Omit<InlineEquivHostDProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as InlineEquivHostDProps & Record<string, unknown>;
    void base;
    return rest;
  })();
  const inner = useMemo(() => props.base + 10, [props.base]);
  const outer = useMemo(() => clampD(inner + props.base), [clampD, inner, props.base]);

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-bf28abea="">
      <span className={"echo"} data-rozie-s-bf28abea="">{rozieDisplay(outer)}</span>
    </div>
    </>
  );
}
