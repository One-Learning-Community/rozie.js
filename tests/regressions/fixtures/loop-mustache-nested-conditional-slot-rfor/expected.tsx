import { useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface LoopMustacheNestedConditionalSlotRforProps {
  items?: any[];
  slots?: { [key: string]: ((...args: any[]) => import('react').ReactNode) | undefined; };
}

export default function LoopMustacheNestedConditionalSlotRfor(_props: LoopMustacheNestedConditionalSlotRforProps): JSX.Element {
  const __defaultItems = useState(() => (() => [])())[0];
  const props: Omit<LoopMustacheNestedConditionalSlotRforProps, 'items'> & { items: any[] } = {
    ..._props,
    items: _props.items ?? __defaultItems,
  };
  const attrs: Record<string, unknown> = (() => {
    const { items, ...rest } = _props as LoopMustacheNestedConditionalSlotRforProps & Record<string, unknown>;
    void items;
    return rest;
  })();

  function noop(): void {}

  return (
    <>

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-bc149f2f="">{props.items.map((x) => (!!(x) && ((typeof props.slots?.[x] === 'function' ? (props.slots?.[x] as Function)() : props.slots?.[x]))))}</div>
    </>
  );
}
