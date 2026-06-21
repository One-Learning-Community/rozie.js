import { useCallback, useEffect, useRef } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface InlineEquivHostMProps {
  base?: number;
}

export default function InlineEquivHostM(_props: InlineEquivHostMProps): JSX.Element {
  const props: Omit<InlineEquivHostMProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as InlineEquivHostMProps & Record<string, unknown>;
    void base;
    return rest;
  })();
  const refreshRowModelM = useRef(0);

  const headM = useCallback((n: number): number => n + 1, []);
  const gridKeydownHandlersM = useCallback((rIdx: number, cIdx: number): number => {
    const active = rIdx + cIdx;
    return active;
  }, []);

  useEffect(() => {
    refreshRowModelM.current = gridKeydownHandlersM(1, headM(2));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-f3df026a="">
      <span className={"echo"} data-rozie-s-f3df026a="">{rozieDisplay(gridKeydownHandlersM(1, 2))}</span>
      <span className={"echo"} data-rozie-s-f3df026a="">{rozieDisplay(refreshRowModelM)}</span>
    </div>
    </>
  );
}
