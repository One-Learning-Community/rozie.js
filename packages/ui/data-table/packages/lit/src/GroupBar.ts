import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-group-bar')
export default class GroupBar extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
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
`;

  /**
   * The ordered active grouping key array (read-only source of truth from the `#groupBar` slot scope). This drop-in never keeps its own copy — it always reads this and writes through `applyGrouping` / `clearGrouping`.
   */
  @property({ type: Array }) grouping: any[] = [];
  /**
   * The columns offered as grouping targets — `[{ id, label }]` — rendered as draggable chips.
   */
  @property({ type: Array, attribute: 'groupable-columns' }) groupableColumns: any[] = [];
  /**
   * `(cols: string[]) => void` — the only add/reorder writer for the grouping order. Null-guarded at call sites.
   */
  @property({ type: Function, attribute: 'apply-grouping' }) applyGrouping: ((...args: any[]) => any) | null = null;
  /**
   * `() => void` — the only clear writer; resets grouping to empty. Null-guarded at call sites.
   */
  @property({ type: Function, attribute: 'clear-grouping' }) clearGrouping: ((...args: any[]) => any) | null = null;
  private _draggingId = signal('');
  private _isOver = signal(false);
  private _dragKind = signal('');
  private _dropKey = signal('');

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  render() {
    return html`
<div class="rdt-group-bar" data-rozie-s-546c469a>
  
  ${repeat<any>(this.groupableColumns, (col, _idx) => col.id, (col, _idx) => html`<button class="rdt-group-token rdt-group-token-add" type="button" part="group-token" draggable="true" aria-pressed=${rozieAttr(this.grouping.indexOf(col.id) !== -1 ? 'true' : 'false')} aria-label=${rozieAttr('Group by ' + col.label)} @dragstart=${($event: Event & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onChipDragStart($event, col.id); }} @dragend=${($event: Event & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onDragEnd(); }} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.toggleKey(col.id); }} data-rozie-s-546c469a>${rozieDisplay(col.label)}</button>`)}

  
  <span class="${Object.entries({ "rdt-group-drop-zone": true, 'is-over': this._isOver.value }).filter(([, v]) => v).map(([k]) => k).join(' ')}" data-group-drop-zone="" role="list" aria-label="Active grouping" @dragover=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onDragOver($event); }} @dragleave=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onDragLeave($event); }} @drop=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onDrop($event); }} data-rozie-s-546c469a>
    
    ${!this.grouping.length ? html`<span class="rdt-group-drop-hint" data-rozie-s-546c469a>Drag columns here to group</span>` : nothing}${repeat<any>(this.grouping, (gk, _idx) => gk, (gk, _idx) => html`<span class="${Object.entries({ "rdt-group-token": true, 'is-drop-target': this._dragKind.value === 'token' && this._dropKey.value === gk && this._draggingId.value !== gk }).filter(([, v]) => v).map(([k]) => k).join(' ')}" part="group-token" data-group-token="" draggable="true" role="listitem" tabindex="0" aria-label=${rozieAttr(this.labelFor(gk) + ' grouping, position ' + (this.grouping.indexOf(gk) + 1) + ' of ' + this.grouping.length + '. Alt+Arrow to reorder, Delete to remove.')} @dragstart=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onTokenDragStart($event, gk); }} @dragover=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onTokenDragOver($event, gk); }} @dragend=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onDragEnd(); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onTokenKeydown($event, gk); }} data-rozie-s-546c469a>
      ${rozieDisplay(this.labelFor(gk))}
      <button class="rdt-group-token-remove" type="button" aria-label=${rozieAttr('Remove ' + this.labelFor(gk) + ' grouping')} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.removeKey(gk); }} data-rozie-s-546c469a>×</button>
    </span>`)}
  </span>

  
  ${this.grouping.length ? html`<button class="rdt-group-clear" type="button" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.clearAll(); }} data-rozie-s-546c469a>Clear</button>` : nothing}</div>
`;
  }

  // Untyped handler params neutralize to `any` so the native drag-event shapes
  // (dataTransfer / preventDefault) typecheck across all six strict leaves — the
  // global-filter idiom (see FilterText.rozie). NEVER annotate these params.
  // A palette CHIP started dragging → this is an ADD-a-new-column drag.
  onChipDragStart = (e: any, id: any) => {
  this._draggingId.value = id;
  this._dragKind.value = 'chip';
  if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
};

  // An active TOKEN started dragging → this is a REORDER drag.
  onTokenDragStart = (e: any, gk: any) => {
  this._draggingId.value = gk;
  this._dragKind.value = 'token';
  if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', gk);
};

  // MUST preventDefault — native HTML5 DnD never fires @drop on a zone that does not
  // cancel the dragover default. Also raises the drop-target highlight.
  onDragOver = (e: any) => {
  if (e) e.preventDefault();
  this._isOver.value = true;
};

  // While reordering, record the token under the pointer as the insertion anchor
  // (we drop BEFORE it). preventDefault so the zone still accepts the drop. Ignored
  // for chip drags — those just append at the end.
  onTokenDragOver = (e: any, gk: any) => {
  if (e) e.preventDefault();
  if (this._dragKind.value === 'token') this._dropKey.value = gk;
};

  // Clear the highlight only on a REAL leave: dragleave ALSO fires when the pointer
  // crosses onto a child token, so ignore leaves whose relatedTarget is still inside
  // the zone (prevents flicker as you hover over existing grouping tokens).
  onDragLeave = (e: any) => {
  if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
  this._isOver.value = false;
  this._dropKey.value = '';
};

  // Single reset for all ephemeral drag bookkeeping — called on drop AND on dragend
  // (so an aborted drag, dropped outside the zone, still clears the marker/highlight).
  resetDrag = () => {
  this._draggingId.value = '';
  this._dragKind.value = '';
  this._dropKey.value = '';
  this._isOver.value = false;
};

  onDragEnd = () => {
  this.resetDrag();
};

  onDrop = (e: any) => {
  if (e) e.preventDefault();
  const kind = this._dragKind.value;
  const anchor = this._dropKey.value;
  const id = e && e.dataTransfer && e.dataTransfer.getData('text/plain') || this._draggingId.value;
  this.resetDrag();
  if (!id) return;
  if (kind === 'token') {
    // REORDER: pull the dragged key out, then splice it back in BEFORE the anchor
    // token (or at the end when dropped on empty zone space). Shift-safe because we
    // resolve the anchor by KEY inside the already-filtered array, not by raw index.
    if (this.grouping.indexOf(id) === -1) return;
    const without = this.grouping.filter((k: any) => k !== id);
    let to = without.length;
    if (anchor && anchor !== id) {
      const j = without.indexOf(anchor);
      if (j !== -1) to = j;
    }
    const next = without.slice(0, to).concat([id]).concat(without.slice(to));
    this.applyGrouping && this.applyGrouping(next);
    return;
  }
  // APPEND (chip): add the dragged column IF not already grouped — read the order
  // from $props.grouping, write the NEW order through applyGrouping.
  if (this.grouping.indexOf(id) !== -1) return;
  const next = this.grouping.concat([id]);
  this.applyGrouping && this.applyGrouping(next);
};

  removeKey = (key: any) => {
  this.applyGrouping && this.applyGrouping(this.grouping.filter((k: any) => k !== key));
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
  toggleKey = (id: any) => {
  if (!id) return;
  if (this.grouping.indexOf(id) !== -1) {
    this.removeKey(id);
    return;
  }
  this.applyGrouping && this.applyGrouping(this.grouping.concat([id]));
};

  // Move a grouping key one position left/right. No-op at the ends (never wraps: a wrap would
  // make a held key cycle forever with no signal that the end was reached).
  moveKey = (key: any, delta: any) => {
  const cur = this.grouping;
  const from = cur.indexOf(key);
  if (from === -1) return;
  const to = from + delta;
  if (to < 0 || to >= cur.length) return;
  const next = cur.slice();
  next.splice(from, 1);
  next.splice(to, 0, key);
  this.applyGrouping && this.applyGrouping(next);
};

  onTokenKeydown = (e: any, gk: any) => {
  if (!e) return;
  const key = e.key;
  if (key === 'Delete' || key === 'Backspace') {
    e.preventDefault();
    this.removeKey(gk);
    return;
  }
  if (!e.altKey) return;
  if (key === 'ArrowLeft') {
    e.preventDefault();
    this.moveKey(gk, -1);
  } else if (key === 'ArrowRight') {
    e.preventDefault();
    this.moveKey(gk, 1);
  }
};

  clearAll = () => {
  this.clearGrouping && this.clearGrouping();
};

  // Resolve a grouping key to its column's friendly label (falls back to the raw
  // key). Used for both the token text and the remove button's aria-label so the
  // bar reads in human terms, not internal column ids. Untyped like the handlers.
  labelFor = (key: any) => {
  const col = this.groupableColumns.find((c: any) => c.id === key);
  return col && col.label || key;
};
}
