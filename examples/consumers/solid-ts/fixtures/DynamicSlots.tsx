import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface DynamicSlotsProps {
  row?: Record<string, any>;
  total?: number;
  cellKey?: string;
  freeSlotName?: string;
  slots?: { 'cell-total'?: ((ctx: { value: any }) => JSX.Element) | undefined; [key: `cell-${string}`]: ((ctx: { row: any; value: any }) => JSX.Element) | undefined; [key: `row-${string}`]: (() => JSX.Element) | undefined; [key: string]: ((...args: any[]) => JSX.Element) | undefined; };
}

export default function DynamicSlots(_props: DynamicSlotsProps): JSX.Element {
  const _merged = mergeProps({ row: (() => ({}))() as Record<string, any>, total: 0, cellKey: 'status', freeSlotName: 'freeform' }, _props);
  const [local, attrs] = splitProps(_merged, ['row', 'total', 'cellKey', 'freeSlotName']);

  return (
    <>
    <div {...attrs} class={"dynamic-slots" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-96693586="">

      
      {_props.slots?.['cell-total']?.({ value: local.total }) ?? <strong data-rozie-s-96693586="">{local.total}</strong>}

      
      {_props.slots?.[`cell-${local.cellKey}`]?.({ row: local.row, value: local.row[local.cellKey] }) ?? <span data-rozie-s-96693586="">{rozieDisplay(local.row[local.cellKey])}</span>}

      
      {_props.slots?.[`row-${local.freeSlotName}`]?.() ?? <em data-rozie-s-96693586="">fallback</em>}

    </div>
    </>
  );
}
