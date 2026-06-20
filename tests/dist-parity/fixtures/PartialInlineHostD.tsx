import { useMemo } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import { clampD } from './wr01-helpers.js';

interface PartialInlineHostDProps {
  base?: number;
}

export default function PartialInlineHostD(_props: PartialInlineHostDProps): JSX.Element {
  const props: Omit<PartialInlineHostDProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as PartialInlineHostDProps & Record<string, unknown>;
    void base;
    return rest;
  })();
  const inner = useMemo(() => props.base + 10, [props.base]);
  const outer = useMemo(() => clampD(inner + props.base), [clampD, inner, props.base]);

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-dd6eac9a="">
      <span className={"echo"} data-rozie-s-dd6eac9a="">{rozieDisplay(outer)}</span>
    </div>
    </>
  );
}
