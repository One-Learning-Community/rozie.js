import { useMemo } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import { clamp } from './partial-helpers.js';

interface PartialInlineHostProps {
  base?: number;
}

export default function PartialInlineHost(_props: PartialInlineHostProps): JSX.Element {
  const props: Omit<PartialInlineHostProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as PartialInlineHostProps & Record<string, unknown>;
    void base;
    return rest;
  })();
  const usedName = useMemo(() => clamp(double(props.base)), [clamp, double, props.base]);

  function double(n: number): number {
    return n * 2;
  }

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-28f2dfac="">
      <span className={"echo"} data-rozie-s-28f2dfac="">{rozieDisplay(usedName)}</span>
    </div>
    </>
  );
}
