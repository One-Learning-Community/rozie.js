import { useMemo } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import { clamp } from './partial-helpers.js';

/* between-statement: a transitive non-exported helper pulled in as the closure of usedName */

interface PartialInlineHostCProps {
  base?: number;
}

export default function PartialInlineHostC(_props: PartialInlineHostCProps): JSX.Element {
  const props: Omit<PartialInlineHostCProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as PartialInlineHostCProps & Record<string, unknown>;
    void base;
    return rest;
  })();
  const usedName = useMemo(() => clamp(double(props.base)), [clamp, double, props.base]);

  function double(n: number): number {
    return n * 2;
  }

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-d770543a="">
      <span className={"echo"} data-rozie-s-d770543a="">{rozieDisplay(usedName)}</span>
    </div>
    </>
  );
}
