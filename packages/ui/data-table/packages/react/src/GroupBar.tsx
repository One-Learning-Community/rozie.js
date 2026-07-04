import { useCallback, useState } from 'react';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-react';

interface GroupBarProps {
  /**
   * The ordered active grouping key array (read-only source of truth from the `#groupBar` slot scope). This drop-in never keeps its own copy — it always reads this and writes through `applyGrouping` / `clearGrouping`.
   */
  grouping?: any[];
  /**
   * The columns offered as grouping targets — `[{ id, label }]` — rendered as draggable chips.
   */
  groupableColumns?: any[];
  /**
   * `(cols: string[]) => void` — the only add/reorder writer for the grouping order. Null-guarded at call sites.
   */
  applyGrouping?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — the only clear writer; resets grouping to empty. Null-guarded at call sites.
   */
  clearGrouping?: ((...args: any[]) => any) | null;
}

export default function GroupBar(_props: GroupBarProps): JSX.Element {
  const __defaultGrouping = useState(() => (() => [])())[0];
  const __defaultGroupableColumns = useState(() => (() => [])())[0];
  const props: Omit<GroupBarProps, 'grouping' | 'groupableColumns' | 'applyGrouping' | 'clearGrouping'> & { grouping: any[]; groupableColumns: any[]; applyGrouping: ((...args: any[]) => any) | null; clearGrouping: ((...args: any[]) => any) | null } = {
    ..._props,
    grouping: _props.grouping ?? __defaultGrouping,
    groupableColumns: _props.groupableColumns ?? __defaultGroupableColumns,
    applyGrouping: _props.applyGrouping ?? null,
    clearGrouping: _props.clearGrouping ?? null,
  };
  const [draggingId, setDraggingId] = useState('');

  const { applyGrouping: _rozieProp_applyGrouping } = props;
  const onDragStart = useCallback((e: any, id: any) => {
    setDraggingId(id);
    if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
  }, []);
  const onDragOver = useCallback((e: any) => {
    if (e) e.preventDefault();
  }, []);
  const onDrop = useCallback((e: any) => {
    const id = e && e.dataTransfer && e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId('');
    if (!id) return;
    // Append the dragged column id IF not already in the grouping — read the order
    // from $props.grouping, write the NEW order through applyGrouping.
    if (props.grouping.indexOf(id) !== -1) return;
    const next = props.grouping.concat([id]);
    _rozieProp_applyGrouping && _rozieProp_applyGrouping(next);
  }, [_rozieProp_applyGrouping, draggingId, props.grouping]);
  const removeKey = useCallback((key: any) => {
    _rozieProp_applyGrouping && _rozieProp_applyGrouping(props.grouping.filter((k: any) => k !== key));
  }, [_rozieProp_applyGrouping, props.grouping]);
  const { clearGrouping: _rozieProp_clearGrouping } = props;
    const clearAll = useCallback(() => {
    _rozieProp_clearGrouping && _rozieProp_clearGrouping();
  }, [_rozieProp_clearGrouping]);

  return (
    <>
    <div className={"rdt-group-bar"} data-rozie-s-546c469a="">
      
      {props.groupableColumns.map((col) => <span key={col.id} className={"rdt-group-token"} part="group-token" draggable="true" onDragStart={($event) => { onDragStart($event, col.id); }} data-rozie-s-546c469a="">{rozieDisplay(col.label)}</span>)}

      
      <span className={"rdt-group-drop-zone"} data-group-drop-zone="" onDragOver={($event) => { onDragOver($event); }} onDrop={($event) => { onDrop($event); }} data-rozie-s-546c469a="">
        {props.grouping.map((gk) => <span key={gk} className={"rdt-group-token"} part="group-token" data-group-token="" data-rozie-s-546c469a="">
          {rozieDisplay(gk)}
          <button type="button" className={"rdt-group-token-remove"} aria-label={rozieAttr(gk)} onClick={($event) => { removeKey(gk); }} data-rozie-s-546c469a="">×</button>
        </span>)}
      </span>

      
      {!!(props.grouping.length) && <button type="button" className={"rdt-group-clear"} onClick={($event) => { clearAll(); }} data-rozie-s-546c469a="">Clear</button>}</div>
    </>
  );
}
