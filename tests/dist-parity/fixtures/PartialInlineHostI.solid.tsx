import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface PartialInlineHostIProps {
  base?: number;
}

export default function PartialInlineHostI(_props: PartialInlineHostIProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  function headI(n: number): number {
    return n + 1;
  }
  let rangeTransitionI = headI(1);
  // after-side: comment trails the host let rangeTransitionI and leads the spliced afterDeclI below
  function afterDeclI(k: number): number {
    return k * 2;
  }
  let fillDragUpI = afterDeclI(1);

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-58c4107a="">
      <span class={"echo"} data-rozie-s-58c4107a="">{rozieDisplay(rangeTransitionI)}</span>
      <span class={"echo"} data-rozie-s-58c4107a="">{rozieDisplay(afterDeclI(1))}</span>
      <span class={"echo"} data-rozie-s-58c4107a="">{rozieDisplay(fillDragUpI)}</span>
    </div>
    </>
  );
}
