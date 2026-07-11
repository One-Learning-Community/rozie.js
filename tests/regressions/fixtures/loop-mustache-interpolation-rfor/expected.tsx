import { useState } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface LoopMustacheInterpolationRforProps {
  items?: any[];
}

export default function LoopMustacheInterpolationRfor(_props: LoopMustacheInterpolationRforProps): JSX.Element {
  const __defaultItems = useState(() => (() => [])())[0];
  const props: Omit<LoopMustacheInterpolationRforProps, 'items'> & { items: any[] } = {
    ..._props,
    items: _props.items ?? __defaultItems,
  };
  const attrs: Record<string, unknown> = (() => {
    const { items, ...rest } = _props as LoopMustacheInterpolationRforProps & Record<string, unknown>;
    void items;
    return rest;
  })();

  function noop(): void {}

  return (
    <>

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-f892f1a3="">{props.items.map((x) => (rozieDisplay(x)))}</div>
    </>
  );
}
