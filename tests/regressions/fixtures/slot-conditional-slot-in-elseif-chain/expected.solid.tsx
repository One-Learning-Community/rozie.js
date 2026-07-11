import type { JSX } from 'solid-js';
import { Show, children, mergeProps, splitProps } from 'solid-js';

interface SlotConditionalSlotInElseifChainProps {
  mode?: number;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function SlotConditionalSlotInElseifChain(_props: SlotConditionalSlotInElseifChainProps): JSX.Element {
  const _merged = mergeProps({ mode: 0 }, _props);
  const [local, attrs] = splitProps(_merged, ['mode', 'children']);
  const resolved = children(() => local.children);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-da247b87="">{<Show when={local.mode === 0} fallback={<Show when={local.mode === 1} fallback={<span data-rozie-s-da247b87="">other</span>}>{resolved()}</Show>}><span data-rozie-s-da247b87="">zero</span></Show>}</div>
    </>
  );
}
