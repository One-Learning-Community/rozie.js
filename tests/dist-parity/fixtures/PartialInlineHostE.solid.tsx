import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface PartialInlineHostEProps {
  base?: number;
}

export default function PartialInlineHostE(_props: PartialInlineHostEProps): JSX.Element {
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
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-7214c3ba="">
      <span class={"echo"} data-rozie-s-7214c3ba="">{rozieDisplay(usedNameE(1))}</span>
      <span class={"echo"} data-rozie-s-7214c3ba="">{rozieDisplay(hostTailE(1))}</span>
    </div>
    </>
  );
}
