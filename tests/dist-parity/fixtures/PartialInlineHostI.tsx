import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface PartialInlineHostIProps {
  base?: number;
}

export default function PartialInlineHostI(_props: PartialInlineHostIProps): JSX.Element {
  const props: Omit<PartialInlineHostIProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as PartialInlineHostIProps & Record<string, unknown>;
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
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-58c4107a="">
      <span className={"echo"} data-rozie-s-58c4107a="">{rozieDisplay(rangeTransitionI)}</span>
      <span className={"echo"} data-rozie-s-58c4107a="">{rozieDisplay(afterDeclI(1))}</span>
      <span className={"echo"} data-rozie-s-58c4107a="">{rozieDisplay(fillDragUpI)}</span>
    </div>
    </>
  );
}
