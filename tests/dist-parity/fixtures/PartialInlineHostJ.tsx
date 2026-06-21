import { useCallback, useEffect, useRef } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface PartialInlineHostJProps {
  base?: number;
}

export default function PartialInlineHostJ(_props: PartialInlineHostJProps): JSX.Element {
  const props: Omit<PartialInlineHostJProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as PartialInlineHostJProps & Record<string, unknown>;
    void base;
    return rest;
  })();
  const refreshRowModelJ = useRef(0);

  const headJ = useCallback((n: number): number => n + 1, []);
  const setColumnFilterJ = useCallback((colId: number, value: number): number => {
    const next = colId + value;
    return next;
  }, []);

  useEffect(() => {
    refreshRowModelJ.current = setColumnFilterJ(1, headJ(2));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-31bf38e2="">
      <span className={"echo"} data-rozie-s-31bf38e2="">{rozieDisplay(setColumnFilterJ(1, 2))}</span>
      <span className={"echo"} data-rozie-s-31bf38e2="">{rozieDisplay(refreshRowModelJ)}</span>
    </div>
    </>
  );
}
