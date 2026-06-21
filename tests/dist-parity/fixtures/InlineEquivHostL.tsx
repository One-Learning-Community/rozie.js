import { clsx, rozieContext, rozieDisplay } from '@rozie/runtime-react';

interface InlineEquivHostLProps {
  base?: number;
}

export default function InlineEquivHostL(_props: InlineEquivHostLProps): JSX.Element {
  const __ctx_themeL = rozieContext("themeL");
  const props: Omit<InlineEquivHostLProps, 'base'> & { base: number } = {
    ..._props,
    base: _props.base ?? 1,
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, ...rest } = _props as InlineEquivHostLProps & Record<string, unknown>;
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
    <div {...attrs} className={clsx("partial-inline-host", (attrs.className as string | undefined))} data-rozie-s-6bfa9f0a="">
      <span className={"echo"} data-rozie-s-6bfa9f0a="">{rozieDisplay(verbL(1))}</span>
      <span className={"echo"} data-rozie-s-6bfa9f0a="">{rozieDisplay(verb2L(1))}</span>
    </div>
    </>
    </__ctx_themeL.Provider>
  );
}
