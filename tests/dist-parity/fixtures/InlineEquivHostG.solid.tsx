import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface InlineEquivHostGProps {
  base?: number;
}

export default function InlineEquivHostG(_props: InlineEquivHostGProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  function headG(n: number): number {
    return n + 1;
  }
  let selectAllBoxG = headG(1);
  function afterDeclG(k: number): number {
    return k * 2;
  }
  function midDeclG(k: number): number {
    return k + 3;
  }
  // before-side: the sandwiched host let trails the spliced midDeclG above
  let rangeTransitionG = midDeclG(1);
  function beforeDeclG(k: number): number {
    return k * 5;
  }
  // before-side: the sandwiched host let trails the spliced beforeDeclG above
  let fillDragUpG = beforeDeclG(1);

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-72aa62a2="">
      <span class={"echo"} data-rozie-s-72aa62a2="">{rozieDisplay(selectAllBoxG)}</span>
      <span class={"echo"} data-rozie-s-72aa62a2="">{rozieDisplay(afterDeclG(1))}</span>
      <span class={"echo"} data-rozie-s-72aa62a2="">{rozieDisplay(rangeTransitionG)}</span>
      <span class={"echo"} data-rozie-s-72aa62a2="">{rozieDisplay(beforeDeclG(1))}</span>
      <span class={"echo"} data-rozie-s-72aa62a2="">{rozieDisplay(fillDragUpG)}</span>
    </div>
    </>
  );
}
