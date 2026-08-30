import { useMemo } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import { clamp } from './partial-helpers.js';

/* between-statement: a transitive non-exported helper pulled in as the closure of usedName */

interface InlineEquivHostCProps {
  base?: number;
}

export default function InlineEquivHostC(_props: InlineEquivHostCProps): JSX.Element {
  const props: Omit<InlineEquivHostCProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as InlineEquivHostCProps & Record<string, unknown>;
    void base;
    return rest;
  })();
  const usedName = useMemo(() => clamp(double(props.base)), [clamp, double, props.base]);

  /* between-statement: a transitive non-exported helper pulled in as the closure of usedName */
  function double(n: number): number {
    return n * 2;
  } // trailing: doubles its input

  // leading: the used $computed export (comment immediately above)

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-5163a222="">
      <span className={"echo"} data-rozie-s-5163a222="">{rozieDisplay(usedName)}</span>
    </div>
    </>
  );
}
