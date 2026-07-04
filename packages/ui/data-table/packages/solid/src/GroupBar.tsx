import type { JSX } from 'solid-js';
import { For, Show, createSignal, mergeProps, splitProps } from 'solid-js';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-solid';

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

  // Untyped handler params neutralize to `any` so the native drag-event shapes
  // (dataTransfer / preventDefault) typecheck across all six strict leaves — the
  // global-filter idiom (see FilterText.rozie). NEVER annotate these params.

  function onDragStart(e: any, id: any) {
    setDraggingId(id);
    if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
  }

  // MUST preventDefault — native HTML5 DnD never fires @drop on a zone that does not
  // cancel the dragover default.
  function onDragOver(e: any) {
    if (e) e.preventDefault();
  }
  function onDrop(e: any) {
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

      
      <span data-group-drop-zone="" class={"rdt-group-drop-zone"} onDragOver={($event) => { onDragOver($event); }} onDrop={($event) => { onDrop($event); }} data-rozie-s-546c469a="">
        <For each={local.grouping}>{(gk) => <span class={"rdt-group-token"} part="group-token" data-group-token="" data-rozie-s-546c469a="">
          {rozieDisplay(gk)}
          <button type="button" aria-label={rozieAttr(gk)} class={"rdt-group-token-remove"} onClick={($event) => { removeKey(gk); }} data-rozie-s-546c469a="">×</button>
        </span>}</For>
      </span>

      
      {<Show when={local.grouping.length}><button type="button" class={"rdt-group-clear"} onClick={($event) => { clearAll(); }} data-rozie-s-546c469a="">Clear</button></Show>}</div>
    </>
  );
}
