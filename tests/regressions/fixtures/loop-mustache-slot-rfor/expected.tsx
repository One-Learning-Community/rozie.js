import { useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface ChildrenCtx { name: any; }

interface LoopMustacheSlotRforProps {
  items?: any[];
  children?: ReactNode | ((ctx: ChildrenCtx) => ReactNode);
  slots?: Record<string, () => import('react').ReactNode>;
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

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-caafe4dd="">{props.items.map((x) => (typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)({ name: x }) : (props.children ?? props.slots?.[''])))}</div>
    </>
  );
}
