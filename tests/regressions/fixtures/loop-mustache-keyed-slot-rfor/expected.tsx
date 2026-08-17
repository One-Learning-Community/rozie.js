import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface LoopMustacheKeyedSlotRforProps {
  rows?: any[];
  slots?: { [key: string]: ((...args: any[]) => import('react').ReactNode) | undefined; };
}

export default function LoopMustacheKeyedSlotRfor(_props: LoopMustacheKeyedSlotRforProps): JSX.Element {
  const __defaultRows = useState(() => (() => [])())[0];
  const props: Omit<LoopMustacheKeyedSlotRforProps, 'rows'> & { rows: any[] } = {
    ..._props,
    rows: _props.rows ?? __defaultRows,
  };
  const attrs: Record<string, unknown> = (() => {
    const { rows, ...rest } = _props as LoopMustacheKeyedSlotRforProps & Record<string, unknown>;
    void rows;
    return rest;
  })();

  function noop(): void {}

  return (
    <>

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-10bfe9b6="">{props.rows.map((row) => <Fragment key={row.id}>{(typeof props.slots?.[row] === 'function' ? (props.slots?.[row] as Function)() : props.slots?.[row])}</Fragment>)}</div>
    </>
  );
}
