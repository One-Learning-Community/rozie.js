import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface SlotConditionalSlotRIfWithFallbackProps {
  show?: boolean;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function SlotConditionalSlotRIfWithFallback(_props: SlotConditionalSlotRIfWithFallbackProps): JSX.Element {
  const props: Omit<SlotConditionalSlotRIfWithFallbackProps, 'show'> & { show: boolean } = {
    ..._props,
    show: _props.show ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { show, ...rest } = _props as SlotConditionalSlotRIfWithFallbackProps & Record<string, unknown>;
    void show;
    return rest;
  })();

  function noop(): void {}

  return (
    <>

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-44d0c1d8="">{!!(props.show) && ((typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.[''])) ?? <span data-rozie-s-44d0c1d8="">fallback</span>)}</div>
    </>
  );
}
