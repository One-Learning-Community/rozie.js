import type { JSX } from 'solid-js';
import { mergeProps, onMount, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface InlineEquivHostMProps {
  base?: number;
}

export default function InlineEquivHostM(_props: InlineEquivHostMProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  onMount(() => {
    refreshRowModelM = gridKeydownHandlersM(1, headM(2));
  });

  function headM(n: number): number {
    return n + 1;
  }
  function gridKeydownHandlersM(rIdx: number, cIdx: number): number {
    const active = rIdx + cIdx;
    return active;
  }

  // the row-selection slice tracks which rows are checked
  // across header-group and body rows alike

  // inRange(rIdx, cIdx) gates the active cell within the
  // current 2-D selection range before a keydown commits
  let refreshRowModelM = 0;

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-f3df026a="">
      <span class={"echo"} data-rozie-s-f3df026a="">{rozieDisplay(gridKeydownHandlersM(1, 2))}</span>
      <span class={"echo"} data-rozie-s-f3df026a="">{rozieDisplay(refreshRowModelM)}</span>
    </div>
    </>
  );
}
