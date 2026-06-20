import type { JSX } from 'solid-js';
import { createMemo, mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';
import { clamp } from './partial-helpers.js';

/* between-statement: a transitive non-exported helper pulled in as the closure of usedName */

interface InlineEquivHostCProps {
  base?: number;
}

export default function InlineEquivHostC(_props: InlineEquivHostCProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  const usedName = createMemo(() => clamp(double(local.base)));

  /* between-statement: a transitive non-exported helper pulled in as the closure of usedName */
  function double(n: number): number {
    return n * 2;
  } // trailing: doubles its input

  // leading: the used $computed export (comment immediately above)

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-5163a222="">
      <span class={"echo"} data-rozie-s-5163a222="">{rozieDisplay(usedName())}</span>
    </div>
    </>
  );
}
