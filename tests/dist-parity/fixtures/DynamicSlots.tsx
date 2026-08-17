import { useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface HeaderCellCtx { title: any; }

interface DynamicSlotsProps {
  columns?: any[];
  row?: Record<string, any>;
  total?: number;
  heading?: string;
  renderHeaderCell?: (ctx: HeaderCellCtx) => ReactNode;
  slots?: { 'cell-total'?: ((params: { value: any }) => import('react').ReactNode) | undefined; [key: `cell-${string}`]: ((params: { row: any; value: any }) => import('react').ReactNode) | undefined; [key: string]: ((...args: any[]) => import('react').ReactNode) | undefined; };
}

export default function DynamicSlots(_props: DynamicSlotsProps): JSX.Element {
  const __defaultColumns = useState(() => (() => [])())[0];
  const __defaultRow = useState(() => (() => ({}))())[0];
  const props: Omit<DynamicSlotsProps, 'columns' | 'row' | 'total' | 'heading'> & { columns: any[]; row: Record<string, any>; total: number; heading: string } = {
    ..._props,
    columns: _props.columns ?? __defaultColumns,
    row: _props.row ?? __defaultRow,
    total: _props.total ?? 0,
    heading: _props.heading ?? 'Header',
  };
  const attrs: Record<string, unknown> = (() => {
    const { columns, row, total, heading, ...rest } = _props as DynamicSlotsProps & Record<string, unknown>;
    void columns; void row; void total; void heading;
    return rest;
  })();
  const [freeSlotName, setFreeSlotName] = useState('freeform');

  return (
    <>
    <div {...attrs} className={clsx("dynamic-slots", (attrs.className as string | undefined))} data-rozie-s-96693586="">

      
      {props.slots?.['cell-total'] ? (props.slots?.['cell-total'] as Function)({ value: props.total }) : <strong data-rozie-s-96693586="">{props.total}</strong>}

      
      {props.columns.map((col) => <div key={col.key} data-rozie-s-96693586="">
        {typeof props.slots?.[`cell-${col.key}`] === 'function' ? (props.slots?.[`cell-${col.key}`] as Function)({ row: props.row, value: props.row[col.key] }) : (props.slots?.[`cell-${col.key}`] ?? <span data-rozie-s-96693586="">{rozieDisplay(props.row[col.key])}</span>)}
      </div>)}

      
      {typeof props.slots?.[freeSlotName] === 'function' ? (props.slots?.[freeSlotName] as Function)({ label: freeSlotName }) : (props.slots?.[freeSlotName] ?? <em data-rozie-s-96693586="">fallback</em>)}

      
      {(props.renderHeaderCell ?? props.slots?.['headerCell']) ? ((props.renderHeaderCell ?? props.slots?.['headerCell']) as Function)({ title: props.heading }) : <h2 data-rozie-s-96693586="">{props.heading}</h2>}

    </div>
    </>
  );
}
