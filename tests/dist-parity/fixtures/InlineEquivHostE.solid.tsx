import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface InlineEquivHostEProps {
  base?: number;
}

export default function InlineEquivHostE(_props: InlineEquivHostEProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  function headE(n: number): number {
    return n + 1;
  }
  function usedNameE(k: number): number {
    return k * 2;
  }
  // leading: the inline host successor trails the spliced partial decl
  function hostTailE(n: number): number {
    return usedNameE(n) + headE(n);
  }

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-625a89aa="">
      <span class={"echo"} data-rozie-s-625a89aa="">{rozieDisplay(usedNameE(1))}</span>
      <span class={"echo"} data-rozie-s-625a89aa="">{rozieDisplay(hostTailE(1))}</span>
    </div>
    </>
  );
}
