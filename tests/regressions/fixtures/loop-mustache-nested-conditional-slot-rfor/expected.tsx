import { useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface ChildrenCtx { name: any; }

interface LoopMustacheNestedConditionalSlotRforProps {
  items?: any[];
  children?: ReactNode | ((ctx: ChildrenCtx) => ReactNode);
  slots?: Record<string, () => import('react').ReactNode>;
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

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-bc149f2f="">{props.items.map((x) => (!!(x) && (typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)({ name: x }) : (props.children ?? props.slots?.['']))))}</div>
    </>
  );
}
