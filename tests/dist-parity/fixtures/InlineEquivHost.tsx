import { useMemo } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import { clamp } from './partial-helpers.js';

interface InlineEquivHostProps {
  base?: number;
}

export default function InlineEquivHost(_props: InlineEquivHostProps): JSX.Element {
  const props: Omit<InlineEquivHostProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as InlineEquivHostProps & Record<string, unknown>;
    void base;
    return rest;
  })();
  const usedName = useMemo(() => clamp(double(props.base)), [clamp, double, props.base]);

  function double(n: number): number {
    return n * 2;
  }

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-c60d9dd6="">
      <span className={"echo"} data-rozie-s-c60d9dd6="">{rozieDisplay(usedName)}</span>
    </div>
    </>
  );
}
