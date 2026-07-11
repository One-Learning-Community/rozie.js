import type { JSX } from 'solid-js';
import { Show, children, mergeProps, splitProps } from 'solid-js';

interface SlotConditionalDefaultSlotRIfProps {
  show?: boolean;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function SlotConditionalDefaultSlotRIf(_props: SlotConditionalDefaultSlotRIfProps): JSX.Element {
  const _merged = mergeProps({ show: false }, _props);
  const [local, attrs] = splitProps(_merged, ['show', 'children']);
  const resolved = children(() => local.children);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-b0fd693f="">{<Show when={local.show}>{resolved()}</Show>}</div>
    </>
  );
}
