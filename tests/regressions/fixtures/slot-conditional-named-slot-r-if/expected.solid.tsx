import type { JSX } from 'solid-js';
import { Show, mergeProps, splitProps } from 'solid-js';

interface SlotConditionalNamedSlotRIfProps {
  show?: boolean;
  headerSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function SlotConditionalNamedSlotRIf(_props: SlotConditionalNamedSlotRIfProps): JSX.Element {
  const _merged = mergeProps({ show: false }, _props);
  const [local, attrs] = splitProps(_merged, ['show']);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-91cab247="">{<Show when={local.show}>{(_props.headerSlot ?? _props.slots?.['header']?.({}))}</Show>}</div>
    </>
  );
}
