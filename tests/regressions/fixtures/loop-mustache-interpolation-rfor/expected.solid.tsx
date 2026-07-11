import type { JSX } from 'solid-js';
import { For, mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface LoopMustacheInterpolationRforProps {
  items?: any[];
}

export default function LoopMustacheInterpolationRfor(_props: LoopMustacheInterpolationRforProps): JSX.Element {
  const _merged = mergeProps({ items: (() => [])() }, _props);
  const [local, attrs] = splitProps(_merged, ['items']);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-f892f1a3=""><For each={local.items}>{(x) => (rozieDisplay(x))}</For></div>
    </>
  );
}
