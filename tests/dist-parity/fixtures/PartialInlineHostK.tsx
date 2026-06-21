import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface PartialInlineHostKProps {
  base?: number;
}

export default function PartialInlineHostK(_props: PartialInlineHostKProps): JSX.Element {
  const props: Omit<PartialInlineHostKProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as PartialInlineHostKProps & Record<string, unknown>;
    void base;
    return rest;
  })();

  function tickK() {
    return props.base * 2;
  }
  function ariaSortK(n: number): number {
    return tickK() + n;
  }
  function sortIndicatorK(n: number): number {
    return ariaSortK(n) + 1;
  }

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-8263a79a="">
      <span className={"echo"} data-rozie-s-8263a79a="">{rozieDisplay(ariaSortK(1))}</span>
      <span className={"echo"} data-rozie-s-8263a79a="">{rozieDisplay(sortIndicatorK(1))}</span>
    </div>
    </>
  );
}
