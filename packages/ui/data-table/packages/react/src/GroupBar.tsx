import { useCallback, useState } from 'react';
import { clsx, rozieAttr, rozieDisplay } from '@rozie/runtime-react';
import './GroupBar.css';

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
  const [isOver, setIsOver] = useState(false);
  const [dragKind, setDragKind] = useState('');
  const [dropKey, setDropKey] = useState('');

  const { applyGrouping: _rozieProp_applyGrouping } = props;
  // Untyped handler params neutralize to `any` so the native drag-event shapes
  // (dataTransfer / preventDefault) typecheck across all six strict leaves — the
  // global-filter idiom (see FilterText.rozie). NEVER annotate these params.
  // A palette CHIP started dragging → this is an ADD-a-new-column drag.
  const onChipDragStart = useCallback((e: any, id: any) => {
    setDraggingId(id);
    setDragKind('chip');
    if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
  }, []);
  // An active TOKEN started dragging → this is a REORDER drag.
  const onTokenDragStart = useCallback((e: any, gk: any) => {
    setDraggingId(gk);
    setDragKind('token');
    if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', gk);
  }, []);
  // MUST preventDefault — native HTML5 DnD never fires @drop on a zone that does not
  // cancel the dragover default. Also raises the drop-target highlight.
  const onDragOver = useCallback((e: any) => {
    if (e) e.preventDefault();
    setIsOver(true);
  }, []);
  // While reordering, record the token under the pointer as the insertion anchor
  // (we drop BEFORE it). preventDefault so the zone still accepts the drop. Ignored
  // for chip drags — those just append at the end.
  const onTokenDragOver = useCallback((e: any, gk: any) => {
    if (e) e.preventDefault();
    if (dragKind === 'token') setDropKey(gk);
  }, [dragKind]);
  // Clear the highlight only on a REAL leave: dragleave ALSO fires when the pointer
  // crosses onto a child token, so ignore leaves whose relatedTarget is still inside
  // the zone (prevents flicker as you hover over existing grouping tokens).
  const onDragLeave = useCallback((e: any) => {
    if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    setIsOver(false);
    setDropKey('');
  }, []);
  // Single reset for all ephemeral drag bookkeeping — called on drop AND on dragend
  // (so an aborted drag, dropped outside the zone, still clears the marker/highlight).
  function resetDrag() {
    setDraggingId('');
    setDragKind('');
    setDropKey('');
    setIsOver(false);
  }
  const onDragEnd = useCallback(() => {
    resetDrag();
  }, [resetDrag]);
  const onDrop = useCallback((e: any) => {
    if (e) e.preventDefault();
    const kind = dragKind;
    const anchor = dropKey;
    const id = e && e.dataTransfer && e.dataTransfer.getData('text/plain') || draggingId;
    resetDrag();
    if (!id) return;
    if (kind === 'token') {
      // REORDER: pull the dragged key out, then splice it back in BEFORE the anchor
      // token (or at the end when dropped on empty zone space). Shift-safe because we
      // resolve the anchor by KEY inside the already-filtered array, not by raw index.
      if (props.grouping.indexOf(id) === -1) return;
      const without = props.grouping.filter((k: any) => k !== id);
      let to = without.length;
      if (anchor && anchor !== id) {
        const j = without.indexOf(anchor);
        if (j !== -1) to = j;
      }
      const next = without.slice(0, to).concat([id]).concat(without.slice(to));
      _rozieProp_applyGrouping && _rozieProp_applyGrouping(next);
      return;
    }
    // APPEND (chip): add the dragged column IF not already grouped — read the order
    // from $props.grouping, write the NEW order through applyGrouping.
    if (props.grouping.indexOf(id) !== -1) return;
    const next = props.grouping.concat([id]);
    _rozieProp_applyGrouping && _rozieProp_applyGrouping(next);
  }, [_rozieProp_applyGrouping, dragKind, draggingId, dropKey, props.grouping, resetDrag]);
  const removeKey = useCallback((key: any) => {
    _rozieProp_applyGrouping && _rozieProp_applyGrouping(props.grouping.filter((k: any) => k !== key));
  }, [_rozieProp_applyGrouping, props.grouping]);
  const { clearGrouping: _rozieProp_clearGrouping } = props;
    const clearAll = useCallback(() => {
    _rozieProp_clearGrouping && _rozieProp_clearGrouping();
  }, [_rozieProp_clearGrouping]);
  // Resolve a grouping key to its column's friendly label (falls back to the raw
  // key). Used for both the token text and the remove button's aria-label so the
  // bar reads in human terms, not internal column ids. Untyped like the handlers.
  function labelFor(key: any) {
    const col = props.groupableColumns.find((c: any) => c.id === key);
    return col && col.label || key;
  }

  return (
    <>
    <div className={"rdt-group-bar"} data-rozie-s-546c469a="">
      
      {props.groupableColumns.map((col) => <span key={col.id} className={"rdt-group-token"} part="group-token" draggable="true" onDragStart={($event) => { onChipDragStart($event, col.id); }} onDragEnd={($event) => { onDragEnd(); }} data-rozie-s-546c469a="">{rozieDisplay(col.label)}</span>)}

      
      <span className={clsx("rdt-group-drop-zone", { "is-over": isOver })} data-group-drop-zone="" onDragOver={($event) => { onDragOver($event); }} onDragLeave={($event) => { onDragLeave($event); }} onDrop={($event) => { onDrop($event); }} data-rozie-s-546c469a="">
        
        {!!(!props.grouping.length) && <span className={"rdt-group-drop-hint"} data-rozie-s-546c469a="">Drag columns here to group</span>}{props.grouping.map((gk) => <span key={gk} className={clsx("rdt-group-token", { "is-drop-target": dragKind === 'token' && dropKey === gk && draggingId !== gk })} part="group-token" data-group-token="" draggable="true" onDragStart={($event) => { onTokenDragStart($event, gk); }} onDragOver={($event) => { onTokenDragOver($event, gk); }} onDragEnd={($event) => { onDragEnd(); }} data-rozie-s-546c469a="">
          {rozieDisplay(labelFor(gk))}
          <button type="button" className={"rdt-group-token-remove"} aria-label={rozieAttr('Remove ' + labelFor(gk) + ' grouping')} onClick={($event) => { removeKey(gk); }} data-rozie-s-546c469a="">×</button>
        </span>)}
      </span>

      
      {!!(props.grouping.length) && <button type="button" className={"rdt-group-clear"} onClick={($event) => { clearAll(); }} data-rozie-s-546c469a="">Clear</button>}</div>
    </>
  );
}
