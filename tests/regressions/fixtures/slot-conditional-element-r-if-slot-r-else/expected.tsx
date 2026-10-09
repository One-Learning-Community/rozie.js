import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface SlotConditionalElementRIfSlotRElseProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'show' | 'children' | 'slots' | 'dangerouslySetInnerHTML'> {
  show?: boolean;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function SlotConditionalElementRIfSlotRElse(_props: SlotConditionalElementRIfSlotRElseProps): JSX.Element {
  const props: Omit<SlotConditionalElementRIfSlotRElseProps, 'show'> & { show: boolean } = {
    ..._props,
    show: _props.show ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { show, children, slots, ...rest } = _props as SlotConditionalElementRIfSlotRElseProps & Record<string, unknown>;
    void show; void children; void slots;
    return rest;
  })();

  function noop(): void {}

  return (
    <>

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-536fe913="">{(!props.show) ? <p data-rozie-s-536fe913="">nothing</p> : ((typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.[''])))}</div>
    </>
  );
}
