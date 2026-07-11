import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface SlotConditionalDefaultSlotRIfProps {
  show?: boolean;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function SlotConditionalDefaultSlotRIf(_props: SlotConditionalDefaultSlotRIfProps): JSX.Element {
  const props: Omit<SlotConditionalDefaultSlotRIfProps, 'show'> & { show: boolean } = {
    ..._props,
    show: _props.show ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { show, ...rest } = _props as SlotConditionalDefaultSlotRIfProps & Record<string, unknown>;
    void show;
    return rest;
  })();

  function noop(): void {}

  return (
    <>

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-b0fd693f="">{!!(props.show) && ((typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.[''])))}</div>
    </>
  );
}
