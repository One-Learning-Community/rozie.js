import { useEffect, useRef } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import { clampH } from './partial-helpers.js';

interface InlineEquivHostHProps {
  base?: number;
}

export default function InlineEquivHostH(_props: InlineEquivHostHProps): JSX.Element {
  const props: Omit<InlineEquivHostHProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as InlineEquivHostHProps & Record<string, unknown>;
    void base;
    return rest;
  })();
  const editTransitionH = useRef(1);

  function editorBindingsH(k: number): number {
    return clampH(k * 2);
  }

  useEffect(() => {
    editTransitionH.current = 2;
  }, []);

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-a125a3da="">
      <span className={"echo"} data-rozie-s-a125a3da="">{rozieDisplay(editTransitionH)}</span>
      <span className={"echo"} data-rozie-s-a125a3da="">{rozieDisplay(editorBindingsH(1))}</span>
    </div>
    </>
  );
}
