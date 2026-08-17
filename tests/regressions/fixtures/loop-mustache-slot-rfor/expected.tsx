import { useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface LoopMustacheSlotRforProps {
  items?: any[];
  slots?: { [key: string]: ((...args: any[]) => import('react').ReactNode) | undefined; };
}

export default function LoopMustacheSlotRfor(_props: LoopMustacheSlotRforProps): JSX.Element {
  const __defaultItems = useState(() => (() => [])())[0];
  const props: Omit<LoopMustacheSlotRforProps, 'items'> & { items: any[] } = {
    ..._props,
    items: _props.items ?? __defaultItems,
  };
  const attrs: Record<string, unknown> = (() => {
    const { items, ...rest } = _props as LoopMustacheSlotRforProps & Record<string, unknown>;
    void items;
    return rest;
  })();

  function noop(): void {}

  return (
    <>

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-caafe4dd="">{props.items.map((x) => ((typeof props.slots?.[x] === 'function' ? (props.slots?.[x] as Function)() : props.slots?.[x])))}</div>
    </>
  );
}
