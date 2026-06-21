import { useEffect, useMemo, useRef } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import { clampB } from './partial-helpers.js';
import { clampD } from './wr01-helpers.js';

interface InlineEquivHostMultiProps {
  base?: number;
}

export default function InlineEquivHostMulti(_props: InlineEquivHostMultiProps): JSX.Element {
  const props: Omit<InlineEquivHostMultiProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as InlineEquivHostMultiProps & Record<string, unknown>;
    void base;
    return rest;
  })();
  const editTransitionM = useRef(1);
  const inner = useMemo(() => props.base + 10, [props.base]);
  const outerM = useMemo(() => clampD(inner + props.base), [clampD, inner, props.base]);

  function headM(n: number): number {
    return n + 1;
  }
  function editorBindingsM(k: number): number {
    return k * 2;
  }
  function hostTailM(n: number): number {
    return editorBindingsM(1) + headM(n);
  }
  function tickM(): number {
    return props.base * 2;
  }
  function columnChromeM(k: number): number {
    return clampB(tickM() + k);
  }

  useEffect(() => {
    editTransitionM.current = 2;
  }, []);

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-f6996e0e="">
      <span className={"echo"} data-rozie-s-f6996e0e="">{rozieDisplay(editTransitionM)}</span>
      <span className={"echo"} data-rozie-s-f6996e0e="">{rozieDisplay(hostTailM(1))}</span>
      <span className={"echo"} data-rozie-s-f6996e0e="">{rozieDisplay(columnChromeM(1))}</span>
      <span className={"echo"} data-rozie-s-f6996e0e="">{rozieDisplay(outerM)}</span>
    </div>
    </>
  );
}
