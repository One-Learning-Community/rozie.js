import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface PartialInlineHostEProps {
  base?: number;
}

export default function PartialInlineHostE(_props: PartialInlineHostEProps): JSX.Element {
  const props: Omit<PartialInlineHostEProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as PartialInlineHostEProps & Record<string, unknown>;
    void base;
    return rest;
  })();

  function headE(n: number): number {
    return n + 1;
  }
  function usedNameE(k: number): number {
    return k * 2;
  }
  function hostTailE(n: number): number {
    return usedNameE(n) + headE(n);
  }

  return (
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-7214c3ba="">
      <span className={"echo"} data-rozie-s-7214c3ba="">{rozieDisplay(usedNameE(1))}</span>
      <span className={"echo"} data-rozie-s-7214c3ba="">{rozieDisplay(hostTailE(1))}</span>
    </div>
    </>
  );
}
