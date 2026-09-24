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
  // ── C-04: the keyboard half of the group bar ────────────────────────────────────────────
  // DECLARED AFTER removeKey ON PURPOSE: toggleKey and onTokenKeydown call it, and the React
  // emitter lowers each to a useCallback whose dependency array is evaluated EAGERLY — declared
  // above removeKey, every React GroupBar died at mount with a TDZ ReferenceError (measured in
  // quick 260922-mkb; the same 87-02 ordering lesson as onEditorDropinKeyDown).
  // Native HTML5 drag-and-drop was the SOLE input path for both adding and reordering, on
  // elements with no tabindex, no role and no click/keydown handler. Remove and Clear were real
  // `<button>`s, so a keyboard user could UNGROUP but could never group or reorder — the bar was
  // a one-way door. HTML5 DnD has no keyboard equivalent by construction, so a parallel,
  // explicitly-keyboard path is the only fix; both halves write through the SAME
  // `applyGrouping` funnel the drop handler uses, so there is one ordering rule, not two.
  //
  // The palette chips become real `<button>`s (Enter/Space for free, focusable for free) rather
  // than spans with `tabindex` + a hand-rolled key handler — the same reasoning that already
  // made Remove and Clear buttons. A `<button draggable="true">` keeps the existing pointer
  // path working unchanged.
  //
  // Reorder is Alt+Arrow on a grouping token, not plain Arrow: the tokens sit in a toolbar that
  // a user also arrows THROUGH, and stealing bare arrows would trap them. Alt is the modifier
  // Windows/macOS list reordering conventionally uses.
  const toggleKey = useCallback((id: any) => {
    if (!id) return;
    if (props.grouping.indexOf(id) !== -1) {
      removeKey(id);
      return;
    }
    _rozieProp_applyGrouping && _rozieProp_applyGrouping(props.grouping.concat([id]));
  }, [_rozieProp_applyGrouping, props.grouping, removeKey]);
  // Move a grouping key one position left/right. No-op at the ends (never wraps: a wrap would
  // make a held key cycle forever with no signal that the end was reached).
  function moveKey(key: any, delta: any) {
    const cur = props.grouping;
    const from = cur.indexOf(key);
    if (from === -1) return;
    const to = from + delta;
    if (to < 0 || to >= cur.length) return;
    const next = cur.slice();
    next.splice(from, 1);
    next.splice(to, 0, key);
    props.applyGrouping && props.applyGrouping(next);
  }
  const onTokenKeydown = useCallback((e: any, gk: any) => {
    if (!e) return;
    const key = e.key;
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      removeKey(gk);
      return;
    }
    if (!e.altKey) return;
    if (key === 'ArrowLeft') {
      e.preventDefault();
      moveKey(gk, -1);
    } else if (key === 'ArrowRight') {
      e.preventDefault();
      moveKey(gk, 1);
    }
  }, [moveKey, removeKey]);
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
      
      {props.groupableColumns.map((col) => <button key={col.id} type="button" className={"rdt-group-token rdt-group-token-add"} part="group-token" draggable="true" aria-pressed={rozieAttr(props.grouping.indexOf(col.id) !== -1 ? 'true' : 'false')} aria-label={rozieAttr('Group by ' + col.label)} onDragStart={($event) => { onChipDragStart($event, col.id); }} onDragEnd={($event) => { onDragEnd(); }} onClick={($event) => { toggleKey(col.id); }} data-rozie-s-546c469a="">{rozieDisplay(col.label)}</button>)}

      
      <span className={clsx("rdt-group-drop-zone", { "is-over": isOver })} data-group-drop-zone="" role="list" aria-label="Active grouping" onDragOver={($event) => { onDragOver($event); }} onDragLeave={($event) => { onDragLeave($event); }} onDrop={($event) => { onDrop($event); }} data-rozie-s-546c469a="">
        
        {!!(!props.grouping.length) && <span className={"rdt-group-drop-hint"} data-rozie-s-546c469a="">Drag columns here to group</span>}{props.grouping.map((gk) => <span key={gk} className={clsx("rdt-group-token", { "is-drop-target": dragKind === 'token' && dropKey === gk && draggingId !== gk })} part="group-token" data-group-token="" draggable="true" role="listitem" tabIndex={0} aria-label={rozieAttr(labelFor(gk) + ' grouping, position ' + (props.grouping.indexOf(gk) + 1) + ' of ' + props.grouping.length + '. Alt+Arrow to reorder, Delete to remove.')} onDragStart={($event) => { onTokenDragStart($event, gk); }} onDragOver={($event) => { onTokenDragOver($event, gk); }} onDragEnd={($event) => { onDragEnd(); }} onKeyDown={($event) => { onTokenKeydown($event, gk); }} data-rozie-s-546c469a="">
          {rozieDisplay(labelFor(gk))}
          <button type="button" className={"rdt-group-token-remove"} aria-label={rozieAttr('Remove ' + labelFor(gk) + ' grouping')} onClick={($event) => { removeKey(gk); }} data-rozie-s-546c469a="">×</button>
        </span>)}
      </span>

      
      {!!(props.grouping.length) && <button type="button" className={"rdt-group-clear"} onClick={($event) => { clearAll(); }} data-rozie-s-546c469a="">Clear</button>}</div>
    </>
  );
}
