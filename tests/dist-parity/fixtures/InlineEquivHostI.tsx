import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface InlineEquivHostIProps {
  base?: number;
}

export default function InlineEquivHostI(_props: InlineEquivHostIProps): JSX.Element {
  const props: Omit<InlineEquivHostIProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as InlineEquivHostIProps & Record<string, unknown>;
    void base;
    return rest;
  })();

  function headI(n: number): number {
    return n + 1;
  }
  let rangeTransitionI = headI(1);
  // after-side: comment trails the host let rangeTransitionI and leads the spliced afterDeclI below
  function afterDeclI(k: number): number {
    return k * 2;
  }
  let fillDragUpI = afterDeclI(1);

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-ce4a0b5a="">
      <span className={"echo"} data-rozie-s-ce4a0b5a="">{rozieDisplay(rangeTransitionI)}</span>
      <span className={"echo"} data-rozie-s-ce4a0b5a="">{rozieDisplay(afterDeclI(1))}</span>
      <span className={"echo"} data-rozie-s-ce4a0b5a="">{rozieDisplay(fillDragUpI)}</span>
    </div>
    </>
  );
}
