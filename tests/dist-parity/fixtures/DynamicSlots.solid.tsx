import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { rozieDisplay } from '@rozie/runtime-solid';

interface HeaderCellSlotCtx { title: any; }

interface DynamicSlotsProps {
  columns?: any[];
  row?: Record<string, any>;
  total?: number;
  heading?: string;
  headerCellSlot?: (ctx: HeaderCellSlotCtx) => JSX.Element;
  slots?: { 'cell-total'?: ((ctx: { value: any }) => JSX.Element) | undefined; [key: `cell-${string}`]: ((ctx: { row: any; value: any }) => JSX.Element) | undefined; [key: string]: ((...args: any[]) => JSX.Element) | undefined; };
}

export default function DynamicSlots(_props: DynamicSlotsProps): JSX.Element {
  const _merged = mergeProps({ columns: (() => [])() as any[], row: (() => ({}))() as Record<string, any>, total: 0, heading: 'Header' }, _props);
  const [local, attrs] = splitProps(_merged, ['columns', 'row', 'total', 'heading']);

  const [freeSlotName, setFreeSlotName] = createSignal('freeform');

  return (
    <>
    <div {...attrs} class={"dynamic-slots" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-96693586="">

      
      {_props.slots?.['cell-total']?.({ value: local.total }) ?? <strong data-rozie-s-96693586="">{local.total}</strong>}

      
      <Key each={local.columns as readonly any[]} by={(col) => col.key}>{(col) => <div data-rozie-s-96693586="">
        {_props.slots?.[`cell-${col().key}`]?.({ row: local.row, value: local.row[col().key] }) ?? <span data-rozie-s-96693586="">{rozieDisplay(local.row[col().key])}</span>}
      </div>}</Key>

      
      {_props.slots?.[freeSlotName()]?.({ label: freeSlotName() }) ?? <em data-rozie-s-96693586="">fallback</em>}

      
      {(_props.headerCellSlot ?? _props.slots?.['headerCell'])?.({ title: local.heading }) ?? <h2 data-rozie-s-96693586="">{local.heading}</h2>}

    </div>
    </>
  );
}
