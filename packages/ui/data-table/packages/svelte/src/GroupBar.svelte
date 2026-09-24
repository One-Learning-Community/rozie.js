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
let isOver = $state(false);
let dragKind = $state('');
let dropKey = $state('');

// Untyped handler params neutralize to `any` so the native drag-event shapes
// (dataTransfer / preventDefault) typecheck across all six strict leaves — the
// global-filter idiom (see FilterText.rozie). NEVER annotate these params.

// A palette CHIP started dragging → this is an ADD-a-new-column drag.
const onChipDragStart = (e: any, id: any) => {
  draggingId = id;
  dragKind = 'chip';
  if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
};
// An active TOKEN started dragging → this is a REORDER drag.
const onTokenDragStart = (e: any, gk: any) => {
  draggingId = gk;
  dragKind = 'token';
  if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', gk);
};
// MUST preventDefault — native HTML5 DnD never fires @drop on a zone that does not
// cancel the dragover default. Also raises the drop-target highlight.
const onDragOver = (e: any) => {
  if (e) e.preventDefault();
  isOver = true;
};
// While reordering, record the token under the pointer as the insertion anchor
// (we drop BEFORE it). preventDefault so the zone still accepts the drop. Ignored
// for chip drags — those just append at the end.
const onTokenDragOver = (e: any, gk: any) => {
  if (e) e.preventDefault();
  if (dragKind === 'token') dropKey = gk;
};
// Clear the highlight only on a REAL leave: dragleave ALSO fires when the pointer
// crosses onto a child token, so ignore leaves whose relatedTarget is still inside
// the zone (prevents flicker as you hover over existing grouping tokens).
const onDragLeave = (e: any) => {
  if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
  isOver = false;
  dropKey = '';
};
// Single reset for all ephemeral drag bookkeeping — called on drop AND on dragend
// (so an aborted drag, dropped outside the zone, still clears the marker/highlight).
const resetDrag = () => {
  draggingId = '';
  dragKind = '';
  dropKey = '';
  isOver = false;
};
const onDragEnd = () => {
  resetDrag();
};
const onDrop = (e: any) => {
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
    if (grouping.indexOf(id) === -1) return;
    const without = grouping.filter((k: any) => k !== id);
    let to = without.length;
    if (anchor && anchor !== id) {
      const j = without.indexOf(anchor);
      if (j !== -1) to = j;
    }
    const next = without.slice(0, to).concat([id]).concat(without.slice(to));
    applyGrouping && applyGrouping(next);
    return;
  }
  // APPEND (chip): add the dragged column IF not already grouped — read the order
  // from $props.grouping, write the NEW order through applyGrouping.
  if (grouping.indexOf(id) !== -1) return;
  const next = grouping.concat([id]);
  applyGrouping && applyGrouping(next);
};
const removeKey = (key: any) => {
  applyGrouping && applyGrouping(grouping.filter((k: any) => k !== key));
};
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
const toggleKey = (id: any) => {
  if (!id) return;
  if (grouping.indexOf(id) !== -1) {
    removeKey(id);
    return;
  }
  applyGrouping && applyGrouping(grouping.concat([id]));
};
// Move a grouping key one position left/right. No-op at the ends (never wraps: a wrap would
// make a held key cycle forever with no signal that the end was reached).
const moveKey = (key: any, delta: any) => {
  const cur = grouping;
  const from = cur.indexOf(key);
  if (from === -1) return;
  const to = from + delta;
  if (to < 0 || to >= cur.length) return;
  const next = cur.slice();
  next.splice(from, 1);
  next.splice(to, 0, key);
  applyGrouping && applyGrouping(next);
};
const onTokenKeydown = (e: any, gk: any) => {
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
};
const clearAll = () => {
  clearGrouping && clearGrouping();
};
// Resolve a grouping key to its column's friendly label (falls back to the raw
// key). Used for both the token text and the remove button's aria-label so the
// bar reads in human terms, not internal column ids. Untyped like the handlers.
const labelFor = (key: any) => {
  const col = groupableColumns.find((c: any) => c.id === key);
  return col && col.label || key;
};
</script>

<div class="rdt-group-bar" data-rozie-s-546c469a>{#each groupableColumns as col (col.id)}<button type="button" class="rdt-group-token rdt-group-token-add" part="group-token" draggable="true" aria-pressed={rozieAttr(grouping.indexOf(col.id) !== -1 ? 'true' : 'false')} aria-label={rozieAttr('Group by ' + col.label)} ondragstart={($event) => { onChipDragStart($event, col.id); }} ondragend={($event) => { onDragEnd(); }} onclick={($event) => { toggleKey(col.id); }} data-rozie-s-546c469a>{rozieDisplay(col.label)}</button>{/each}<span class={["rdt-group-drop-zone", { 'is-over': isOver }]} data-group-drop-zone="" role="list" aria-label="Active grouping" ondragover={($event) => { onDragOver($event); }} ondragleave={($event) => { onDragLeave($event); }} ondrop={($event) => { onDrop($event); }} data-rozie-s-546c469a>{#if !grouping.length}<span class="rdt-group-drop-hint" data-rozie-s-546c469a>Drag columns here to group</span>{/if}{#each grouping as gk (gk)}<span class={["rdt-group-token", { 'is-drop-target': dragKind === 'token' && dropKey === gk && draggingId !== gk }]} part="group-token" data-group-token="" draggable="true" role="listitem" tabindex="0" aria-label={rozieAttr(labelFor(gk) + ' grouping, position ' + (grouping.indexOf(gk) + 1) + ' of ' + grouping.length + '. Alt+Arrow to reorder, Delete to remove.')} ondragstart={($event) => { onTokenDragStart($event, gk); }} ondragover={($event) => { onTokenDragOver($event, gk); }} ondragend={($event) => { onDragEnd(); }} onkeydown={($event) => { onTokenKeydown($event, gk); }} data-rozie-s-546c469a>{rozieDisplay(labelFor(gk))}<button type="button" class="rdt-group-token-remove" aria-label={rozieAttr('Remove ' + labelFor(gk) + ' grouping')} onclick={($event) => { removeKey(gk); }} data-rozie-s-546c469a>×</button></span>{/each}</span>{#if grouping.length}<button type="button" class="rdt-group-clear" onclick={($event) => { clearAll(); }} data-rozie-s-546c469a>Clear</button>{/if}</div>

<style>
:global {
  .rdt-group-drop-zone[data-rozie-s-546c469a] {
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
  .rdt-group-token-add[data-rozie-s-546c469a] {
    font: inherit;
    color: inherit;
    border: none;
    background: none;
    cursor: pointer;
  }
  .rdt-group-token-add[data-rozie-s-546c469a]:focus-visible,
  .rdt-group-drop-zone[data-rozie-s-546c469a] [data-group-token][data-rozie-s-546c469a]:focus-visible {
    outline: var(--rdt-focus-ring, 2px solid #2563eb);
    outline-offset: 1px;
  }
  .rdt-group-drop-hint[data-rozie-s-546c469a] {
    opacity: 0.55;
    font-size: 0.8125em;
    user-select: none;
    pointer-events: none;
  }
  .rdt-group-bar[data-rozie-s-546c469a] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--rdt-group-bar-gap, 0.375rem);
  }
  .rdt-group-token-remove[data-rozie-s-546c469a] {
    display: inline-flex;
    align-items: center;
    margin-inline-start: 0.125rem;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    line-height: 1;
    cursor: pointer;
    opacity: 0.6;
  }
  .rdt-group-token-remove[data-rozie-s-546c469a]:hover {
    opacity: 1;
  }
  .rdt-group-clear[data-rozie-s-546c469a] {
    cursor: pointer;
  }
  .rdt-group-token-remove[data-rozie-s-546c469a]:focus-visible,
  .rdt-group-clear[data-rozie-s-546c469a]:focus-visible {
    outline: var(--rdt-focus-ring, 2px solid rgba(37, 99, 235, 0.7));
    outline-offset: 1px;
    border-radius: 2px;
  }
  .rdt-group-token.is-drop-target[data-rozie-s-546c469a] {
    box-shadow: inset 3px 0 0 0 var(--rdt-group-drop-marker, rgba(37, 99, 235, 0.9));
  }
}
</style>
