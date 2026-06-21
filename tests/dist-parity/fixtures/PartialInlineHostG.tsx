import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface PartialInlineHostGProps {
  base?: number;
}

export default function PartialInlineHostG(_props: PartialInlineHostGProps): JSX.Element {
  const props: Omit<PartialInlineHostGProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as PartialInlineHostGProps & Record<string, unknown>;
    void base;
    return rest;
  })();

  function headG(n: number): number {
    return n + 1;
  }
  let selectAllBoxG = headG(1);
  function afterDeclG(k: number): number {
    return k * 2;
  }
  function midDeclG(k: number): number {
    return k + 3;
  }
  // before-side: the sandwiched host let trails the spliced midDeclG above
  let rangeTransitionG = midDeclG(1);
  function beforeDeclG(k: number): number {
    return k * 5;
  }
  // before-side: the sandwiched host let trails the spliced beforeDeclG above
  let fillDragUpG = beforeDeclG(1);

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-298827ca="">
      <span className={"echo"} data-rozie-s-298827ca="">{rozieDisplay(selectAllBoxG)}</span>
      <span className={"echo"} data-rozie-s-298827ca="">{rozieDisplay(afterDeclG(1))}</span>
      <span className={"echo"} data-rozie-s-298827ca="">{rozieDisplay(rangeTransitionG)}</span>
      <span className={"echo"} data-rozie-s-298827ca="">{rozieDisplay(beforeDeclG(1))}</span>
      <span className={"echo"} data-rozie-s-298827ca="">{rozieDisplay(fillDragUpG)}</span>
    </div>
    </>
  );
}
