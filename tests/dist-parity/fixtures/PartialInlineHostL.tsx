import { clsx, rozieContext, rozieDisplay } from '@rozie/runtime-react';

interface PartialInlineHostLProps {
  base?: number;
}

export default function PartialInlineHostL(_props: PartialInlineHostLProps): JSX.Element {
  const __ctx_themeL = rozieContext("themeL");
  const props: Omit<PartialInlineHostLProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as PartialInlineHostLProps & Record<string, unknown>;
    void base;
    return rest;
  })();

  function headL() {
    return props.base + 1;
  }
  function verbL(n: number): number {
    return headL() + n;
  }
  function verb2L(n: number): number {
    return verbL(n) + 1;
  }

  return (
    <__ctx_themeL.Provider value={{
  v: 1
}}>
    <>
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-e05b5f1a="">
      <span className={"echo"} data-rozie-s-e05b5f1a="">{rozieDisplay(verbL(1))}</span>
      <span className={"echo"} data-rozie-s-e05b5f1a="">{rozieDisplay(verb2L(1))}</span>
    </div>
    </>
    </__ctx_themeL.Provider>
  );
}
