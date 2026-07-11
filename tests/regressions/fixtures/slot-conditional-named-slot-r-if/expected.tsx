import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface SlotConditionalNamedSlotRIfProps {
  show?: boolean;
  renderHeader?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function SlotConditionalNamedSlotRIf(_props: SlotConditionalNamedSlotRIfProps): JSX.Element {
  const props: Omit<SlotConditionalNamedSlotRIfProps, 'show'> & { show: boolean } = {
    ..._props,
    show: _props.show ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { show, ...rest } = _props as SlotConditionalNamedSlotRIfProps & Record<string, unknown>;
    void show;
    return rest;
  })();

  function noop(): void {}

  return (
    <>

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-91cab247="">{!!(props.show) && ((props.renderHeader ?? props.slots?.['header'])?.())}</div>
    </>
  );
}
