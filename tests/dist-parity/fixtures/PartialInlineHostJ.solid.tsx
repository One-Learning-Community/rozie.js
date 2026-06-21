import type { JSX } from 'solid-js';
import { mergeProps, onMount, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface PartialInlineHostJProps {
  base?: number;
}

export default function PartialInlineHostJ(_props: PartialInlineHostJProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  onMount(() => {
    refreshRowModelJ = setColumnFilterJ(1, headJ(2));
  });

  function headJ(n: number): number {
    return n + 1;
  }
  function setColumnFilterJ(colId: number, value: number): number {
    const next = colId + value;
    return next;
  }

  // Re-read the row model + header groups into $data
  let refreshRowModelJ = 0;

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-31bf38e2="">
      <span class={"echo"} data-rozie-s-31bf38e2="">{rozieDisplay(setColumnFilterJ(1, 2))}</span>
      <span class={"echo"} data-rozie-s-31bf38e2="">{rozieDisplay(refreshRowModelJ)}</span>
    </div>
    </>
  );
}
