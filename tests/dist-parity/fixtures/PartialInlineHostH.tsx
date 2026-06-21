import { useEffect, useRef } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import { clampH } from './partial-helpers.js';

interface PartialInlineHostHProps {
  base?: number;
}

export default function PartialInlineHostH(_props: PartialInlineHostHProps): JSX.Element {
  const props: Omit<PartialInlineHostHProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as PartialInlineHostHProps & Record<string, unknown>;
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
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-3844649a="">
      <span className={"echo"} data-rozie-s-3844649a="">{rozieDisplay(editTransitionH)}</span>
      <span className={"echo"} data-rozie-s-3844649a="">{rozieDisplay(editorBindingsH(1))}</span>
    </div>
    </>
  );
}
