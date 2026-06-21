import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { rozieContext, rozieDisplay } from '@rozie/runtime-solid';

interface InlineEquivHostLProps {
  base?: number;
}

export default function InlineEquivHostL(_props: InlineEquivHostLProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  const __ctx_themeL = rozieContext("themeL");

  function headL() {
    return local.base + 1;
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
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-6bfa9f0a="">
      <span class={"echo"} data-rozie-s-6bfa9f0a="">{rozieDisplay(verbL(1))}</span>
      <span class={"echo"} data-rozie-s-6bfa9f0a="">{rozieDisplay(verb2L(1))}</span>
    </div>
    </>
    </__ctx_themeL.Provider>
  );
}
