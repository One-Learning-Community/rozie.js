import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface InlineEquivHostKProps {
  base?: number;
}

export default function InlineEquivHostK(_props: InlineEquivHostKProps): JSX.Element {
  const props: Omit<InlineEquivHostKProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as InlineEquivHostKProps & Record<string, unknown>;
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
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-3f0d2452="">
      <span className={"echo"} data-rozie-s-3f0d2452="">{rozieDisplay(ariaSortK(1))}</span>
      <span className={"echo"} data-rozie-s-3f0d2452="">{rozieDisplay(sortIndicatorK(1))}</span>
    </div>
    </>
  );
}
