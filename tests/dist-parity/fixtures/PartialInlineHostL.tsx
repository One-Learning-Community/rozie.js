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
  // the registry API handed to children (the $provide leading comment that STAYS in
  // residual position when $provide lowers to provide()/Provider — the real shape).
  // imperative handle (consumer-callable) — the run-LEADING comment block that is
  // SEPARATED from the host predecessor by one blank line (beforeGap=2). Inline, the
  // blank breaks @babel's prev-trailing attachment, so this block attaches to verbL's
  // leadingComments ONLY → single-emit on svelte/vue. The partial-splice mirror must
  // NOT re-create the prev-trailing copy (doubling it = the R10 bug this guards).
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
