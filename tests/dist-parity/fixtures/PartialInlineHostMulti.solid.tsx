import type { JSX } from 'solid-js';
import { createMemo, mergeProps, onMount, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';
import { clampB } from './partial-helpers.js';
import { clampD } from './wr01-helpers.js';

interface PartialInlineHostMultiProps {
  base?: number;
}

export default function PartialInlineHostMulti(_props: PartialInlineHostMultiProps): JSX.Element {
  const _merged = mergeProps({ base: 1 }, _props);
  const [local, attrs] = splitProps(_merged, ['base']);

  const inner = createMemo(() => local.base + 10);
  const outerM = createMemo(() => clampD(inner() + local.base));
  onMount(() => {
    editTransitionM = 2;
  });

  function headM(n: number): number {
    return n + 1;
  }
  let editTransitionM = 1;
  // after-side: comment trails the host let editTransitionM and leads the spliced editorBindingsM below
  function editorBindingsM(k: number): number {
    return k * 2;
  }
  // trailing-seam: the inline host successor trails the spliced editorBindingsM
  function hostTailM(n: number): number {
    return editorBindingsM(1) + headM(n);
  }
  function tickM(): number {
    return local.base * 2;
  }
  // gap-0 leading: stays with the extracted columnChromeM, must NOT float to the hoisted import
  function columnChromeM(k: number): number {
    return clampB(tickM() + k);
  }

  return (
    <>
    <div {...attrs} class={"partial-inline-host" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-66a0496a="">
      <span class={"echo"} data-rozie-s-66a0496a="">{rozieDisplay(editTransitionM)}</span>
      <span class={"echo"} data-rozie-s-66a0496a="">{rozieDisplay(hostTailM(1))}</span>
      <span class={"echo"} data-rozie-s-66a0496a="">{rozieDisplay(columnChromeM(1))}</span>
      <span class={"echo"} data-rozie-s-66a0496a="">{rozieDisplay(outerM())}</span>
    </div>
    </>
  );
}
