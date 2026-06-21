import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface PartialInlineHostKProps {
  base?: number;
}

export default function PartialInlineHostK(_props: PartialInlineHostKProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  function tickK() {
    return local.base * 2;
  }
  // columnChromeK — the run-LEADING comment that flows directly below the host `const tickK`
  // arrow const (gap-0 seam; no hoisted import — the arrow bodies close over host scope, the
  // real DataTable columnChrome shape). This block is the partial's first surviving decl's
  // leading comment; it transfers into the host verbatim (doubled on svelte/vue per-statement),
  // so the inline oracle carries the IDENTICAL block directly below its own `const tickK`.
  function ariaSortK(n: number): number {
    return tickK() + n;
  }
  function sortIndicatorK(n: number): number {
    return ariaSortK(n) + 1;
  }

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-8263a79a="">
      <span class={"echo"} data-rozie-s-8263a79a="">{rozieDisplay(ariaSortK(1))}</span>
      <span class={"echo"} data-rozie-s-8263a79a="">{rozieDisplay(sortIndicatorK(1))}</span>
    </div>
    </>
  );
}
