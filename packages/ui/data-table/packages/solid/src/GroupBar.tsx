import type { JSX } from 'solid-js';
import { For, Show, createSignal, mergeProps, splitProps } from 'solid-js';
import { __rozieInjectStyle, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('GroupBar-546c469a', `.rdt-group-drop-zone[data-rozie-s-546c469a] {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--rdt-group-bar-gap, 0.375rem);
  min-width: var(--rdt-group-drop-zone-min, 8rem);
  min-height: 1.75rem;
  padding: var(--rdt-group-drop-zone-pad, 0.1875rem 0.5rem);
  border: 1px dashed var(--rdt-group-drop-zone-border, rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-group-drop-zone-radius, 0.375rem);
  background: var(--rdt-group-drop-zone-bg, transparent);
  transition: border-color 0.12s ease, background 0.12s ease;
}
.rdt-group-drop-zone.is-over[data-rozie-s-546c469a] {
  border-color: var(--rdt-group-drop-zone-border-over, rgba(37, 99, 235, 0.7));
  background: var(--rdt-group-drop-zone-bg-over, rgba(37, 99, 235, 0.08));
}
.rdt-group-drop-hint[data-rozie-s-546c469a] {
  opacity: 0.55;
  font-size: 0.8125em;
  user-select: none;
  pointer-events: none;
}`);

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
  applyGrouping?: ((...args: unknown[]) => unknown) | null;
  /**
   * `() => void` — the only clear writer; resets grouping to empty. Null-guarded at call sites.
   */
  clearGrouping?: ((...args: unknown[]) => unknown) | null;
}

export default function GroupBar(_props: GroupBarProps): JSX.Element {
  const _merged = mergeProps({ grouping: (() => [])(), groupableColumns: (() => [])(), applyGrouping: null, clearGrouping: null }, _props);
  const [local, attrs] = splitProps(_merged, ['grouping', 'groupableColumns', 'applyGrouping', 'clearGrouping']);

  const [draggingId, setDraggingId] = createSignal('');
  const [isOver, setIsOver] = createSignal(false);

  // Untyped handler params neutralize to `any` so the native drag-event shapes
  // (dataTransfer / preventDefault) typecheck across all six strict leaves — the
  // global-filter idiom (see FilterText.rozie). NEVER annotate these params.

  function onDragStart(e: any, id: any) {
    setDraggingId(id);
    if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
  }

  // MUST preventDefault — native HTML5 DnD never fires @drop on a zone that does not
  // cancel the dragover default. Also raises the drop-target highlight.
  function onDragOver(e: any) {
    if (e) e.preventDefault();
    setIsOver(true);
  }

  // Clear the highlight only on a REAL leave: dragleave ALSO fires when the pointer
  // crosses onto a child token, so ignore leaves whose relatedTarget is still inside
  // the zone (prevents flicker as you hover over existing grouping tokens).
  function onDragLeave(e: any) {
    if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    setIsOver(false);
  }
  function onDrop(e: any) {
    setIsOver(false);
    const id = e && e.dataTransfer && e.dataTransfer.getData('text/plain') || draggingId();
    setDraggingId('');
    if (!id) return;
    // Append the dragged column id IF not already in the grouping — read the order
    // from $props.grouping, write the NEW order through applyGrouping.
    if (local.grouping.indexOf(id) !== -1) return;
    const next = local.grouping.concat([id]);
    local.applyGrouping && local.applyGrouping(next);
  }
  function removeKey(key: any) {
    local.applyGrouping && local.applyGrouping(local.grouping.filter((k: any) => k !== key));
  }
  function clearAll() {
    local.clearGrouping && local.clearGrouping();
  }

  return (
    <>
    <div class={"rdt-group-bar"} data-rozie-s-546c469a="">
      
      <For each={local.groupableColumns}>{(col) => <span part="group-token" draggable="true" class={"rdt-group-token"} onDragStart={($event) => { onDragStart($event, col.id); }} data-rozie-s-546c469a="">{rozieDisplay(col.label)}</span>}</For>

      
      <span data-group-drop-zone="" class={"rdt-group-drop-zone" + " " + rozieClass({ 'is-over': isOver() })} onDragOver={($event) => { onDragOver($event); }} onDragLeave={($event) => { onDragLeave($event); }} onDrop={($event) => { onDrop($event); }} data-rozie-s-546c469a="">
        
        {<Show when={!local.grouping.length}><span class={"rdt-group-drop-hint"} data-rozie-s-546c469a="">Drag columns here to group</span></Show>}<For each={local.grouping}>{(gk) => <span class={"rdt-group-token"} part="group-token" data-group-token="" data-rozie-s-546c469a="">
          {rozieDisplay(gk)}
          <button type="button" aria-label={rozieAttr(gk)} class={"rdt-group-token-remove"} onClick={($event) => { removeKey(gk); }} data-rozie-s-546c469a="">×</button>
        </span>}</For>
      </span>

      
      {<Show when={local.grouping.length}><button type="button" class={"rdt-group-clear"} onClick={($event) => { clearAll(); }} data-rozie-s-546c469a="">Clear</button></Show>}</div>
    </>
  );
}
