import { useCallback, useEffect, useRef } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface PartialInlineHostMProps {
  base?: number;
}

export default function PartialInlineHostM(_props: PartialInlineHostMProps): JSX.Element {
  const props: Omit<PartialInlineHostMProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as PartialInlineHostMProps & Record<string, unknown>;
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
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-5d3a593a="">
      <span className={"echo"} data-rozie-s-5d3a593a="">{rozieDisplay(gridKeydownHandlersM(1, 2))}</span>
      <span className={"echo"} data-rozie-s-5d3a593a="">{rozieDisplay(refreshRowModelM)}</span>
    </div>
    </>
  );
}
