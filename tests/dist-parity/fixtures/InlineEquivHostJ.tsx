import { useCallback, useEffect, useRef } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface InlineEquivHostJProps {
  base?: number;
}

export default function InlineEquivHostJ(_props: InlineEquivHostJProps): JSX.Element {
  const props: Omit<InlineEquivHostJProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as InlineEquivHostJProps & Record<string, unknown>;
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
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-6eab802a="">
      <span className={"echo"} data-rozie-s-6eab802a="">{rozieDisplay(setColumnFilterJ(1, 2))}</span>
      <span className={"echo"} data-rozie-s-6eab802a="">{rozieDisplay(refreshRowModelJ)}</span>
    </div>
    </>
  );
}
