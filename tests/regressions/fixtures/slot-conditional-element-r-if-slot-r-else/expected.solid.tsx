import type { JSX } from 'solid-js';
import { Show, children, mergeProps, splitProps } from 'solid-js';

interface SlotConditionalElementRIfSlotRElseProps {
  show?: boolean;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function SlotConditionalElementRIfSlotRElse(_props: SlotConditionalElementRIfSlotRElseProps): JSX.Element {
  const _merged = mergeProps({ show: false }, _props);
  const [local, attrs] = splitProps(_merged, ['show', 'children']);
  const resolved = children(() => local.children);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-536fe913="">{<Show when={!local.show} fallback={resolved()}><p data-rozie-s-536fe913="">nothing</p></Show>}</div>
    </>
  );
}
