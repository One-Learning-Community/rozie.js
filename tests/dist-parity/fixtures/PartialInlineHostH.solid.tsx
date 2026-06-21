import type { JSX } from 'solid-js';
import { mergeProps, onMount, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';
import { clampH } from './partial-helpers.js';

interface PartialInlineHostHProps {
  base?: number;
}

export default function PartialInlineHostH(_props: PartialInlineHostHProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  onMount(() => {
    editTransitionH = 2;
  });

  let editTransitionH = 1;
  // leading: stays with the extracted decl, must NOT float to the hoisted import
  function editorBindingsH(k: number): number {
    return clampH(k * 2);
  }

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-3844649a="">
      <span class={"echo"} data-rozie-s-3844649a="">{rozieDisplay(editTransitionH)}</span>
      <span class={"echo"} data-rozie-s-3844649a="">{rozieDisplay(editorBindingsH(1))}</span>
    </div>
    </>
  );
}
