import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface SlotConditionalSlotRIfElementRElseProps {
  show?: boolean;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function SlotConditionalSlotRIfElementRElse(_props: SlotConditionalSlotRIfElementRElseProps): JSX.Element {
  const props: Omit<SlotConditionalSlotRIfElementRElseProps, 'show'> & { show: boolean } = {
    ..._props,
    show: _props.show ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { show, ...rest } = _props as SlotConditionalSlotRIfElementRElseProps & Record<string, unknown>;
    void show;
    return rest;
  })();

  function noop(): void {}

  return (
    <>

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-ae404d71="">{(props.show) ? ((typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))) : <p data-rozie-s-ae404d71="">nothing</p>}</div>
    </>
  );
}
