<script lang="ts">
import { rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
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

let __defaultGrouping = (() => [])();
let __defaultGroupableColumns = (() => [])();

let {
  grouping = __defaultGrouping,
  groupableColumns = __defaultGroupableColumns,
  applyGrouping = null,
  clearGrouping = null
}: Props = $props();

let draggingId = $state('');

// Untyped handler params neutralize to `any` so the native drag-event shapes
// (dataTransfer / preventDefault) typecheck across all six strict leaves — the
// global-filter idiom (see FilterText.rozie). NEVER annotate these params.

const onDragStart = (e: any, id: any) => {
  draggingId = id;
  if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
};

// MUST preventDefault — native HTML5 DnD never fires @drop on a zone that does not
// cancel the dragover default.
// MUST preventDefault — native HTML5 DnD never fires @drop on a zone that does not
// cancel the dragover default.
const onDragOver = (e: any) => {
  if (e) e.preventDefault();
};
const onDrop = (e: any) => {
  const id = e && e.dataTransfer && e.dataTransfer.getData('text/plain') || draggingId;
  draggingId = '';
  if (!id) return;
  // Append the dragged column id IF not already in the grouping — read the order
  // from $props.grouping, write the NEW order through applyGrouping.
  if (grouping.indexOf(id) !== -1) return;
  const next = grouping.concat([id]);
  applyGrouping && applyGrouping(next);
};
const removeKey = (key: any) => {
  applyGrouping && applyGrouping(grouping.filter((k: any) => k !== key));
};
const clearAll = () => {
  clearGrouping && clearGrouping();
};
</script>

<div class="rdt-group-bar" data-rozie-s-546c469a>{#each groupableColumns as col (col.id)}<span class="rdt-group-token" draggable="true" ondragstart={($event) => { onDragStart($event, col.id); }} data-rozie-s-546c469a>{rozieDisplay(col.label)}</span>{/each}<span class="rdt-group-drop-zone" data-group-drop-zone="" ondragover={($event) => { onDragOver($event); }} ondrop={($event) => { onDrop($event); }} data-rozie-s-546c469a>{#each grouping as gk (gk)}<span class="rdt-group-token" data-group-token="" data-rozie-s-546c469a>{rozieDisplay(gk)}<button type="button" class="rdt-group-token-remove" aria-label={rozieAttr(gk)} onclick={($event) => { removeKey(gk); }} data-rozie-s-546c469a>×</button></span>{/each}</span>{#if grouping.length}<button type="button" class="rdt-group-clear" onclick={($event) => { clearAll(); }} data-rozie-s-546c469a>Clear</button>{/if}</div>
