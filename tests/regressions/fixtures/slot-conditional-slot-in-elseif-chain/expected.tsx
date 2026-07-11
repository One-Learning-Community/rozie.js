import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface SlotConditionalSlotInElseifChainProps {
  mode?: number;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function SlotConditionalSlotInElseifChain(_props: SlotConditionalSlotInElseifChainProps): JSX.Element {
  const props: Omit<SlotConditionalSlotInElseifChainProps, 'mode'> & { mode: number } = {
    ..._props,
    mode: _props.mode ?? 0,
  };
  const attrs: Record<string, unknown> = (() => {
    const { mode, ...rest } = _props as SlotConditionalSlotInElseifChainProps & Record<string, unknown>;
    void mode;
    return rest;
  })();

  function noop(): void {}

  return (
    <>

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-da247b87="">{(props.mode === 0) ? <span data-rozie-s-da247b87="">zero</span> : (props.mode === 1) ? ((typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))) : <span data-rozie-s-da247b87="">other</span>}</div>
    </>
  );
}
