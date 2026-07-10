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
  @property({ type: Array }) groupableColumns: any[] = [];
  /**
   * `(cols: string[]) => void` — the only add/reorder writer for the grouping order. Null-guarded at call sites.
   */
  @property({ type: Function }) applyGrouping: ((...args: unknown[]) => unknown) | null = null;
  /**
   * `() => void` — the only clear writer; resets grouping to empty. Null-guarded at call sites.
   */
  @property({ type: Function }) clearGrouping: ((...args: unknown[]) => unknown) | null = null;
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
  
  ${repeat<any>(this.groupableColumns, (col, _idx) => col.id, (col, _idx) => html`<span class="rdt-group-token" part="group-token" key=${rozieAttr(col.id)} draggable="true" @dragstart=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onChipDragStart($event, col.id); }} @dragend=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onDragEnd(); }} data-rozie-s-546c469a>${rozieDisplay(col.label)}</span>`)}

  
  <span class="${Object.entries({ "rdt-group-drop-zone": true, 'is-over': this._isOver.value }).filter(([, v]) => v).map(([k]) => k).join(' ')}" data-group-drop-zone="" @dragover=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onDragOver($event); }} @dragleave=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onDragLeave($event); }} @drop=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onDrop($event); }} data-rozie-s-546c469a>
    
    ${!this.grouping.length ? html`<span class="rdt-group-drop-hint" data-rozie-s-546c469a>Drag columns here to group</span>` : nothing}${repeat<any>(this.grouping, (gk, _idx) => gk, (gk, _idx) => html`<span class="${Object.entries({ "rdt-group-token": true, 'is-drop-target': this._dragKind.value === 'token' && this._dropKey.value === gk && this._draggingId.value !== gk }).filter(([, v]) => v).map(([k]) => k).join(' ')}" part="group-token" data-group-token="" key=${rozieAttr(gk)} draggable="true" @dragstart=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onTokenDragStart($event, gk); }} @dragover=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onTokenDragOver($event, gk); }} @dragend=${($event: Event & { currentTarget: HTMLSpanElement; target: HTMLSpanElement }) => { this.onDragEnd(); }} data-rozie-s-546c469a>
      ${rozieDisplay(this.labelFor(gk))}
      <button class="rdt-group-token-remove" type="button" aria-label=${rozieAttr('Remove ' + this.labelFor(gk) + ' grouping')} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.removeKey(gk); }} data-rozie-s-546c469a>×</button>
    </span>`)}
  </span>

  
  ${this.grouping.length ? html`<button class="rdt-group-clear" type="button" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.clearAll(); }} data-rozie-s-546c469a>Clear</button>` : nothing}</div>
`;
  }

  onChipDragStart = (e: any, id: any) => {
  this._draggingId.value = id;
  this._dragKind.value = 'chip';
  if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
};

  onTokenDragStart = (e: any, gk: any) => {
  this._draggingId.value = gk;
  this._dragKind.value = 'token';
  if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', gk);
};

  onDragOver = (e: any) => {
  if (e) e.preventDefault();
  this._isOver.value = true;
};

  onTokenDragOver = (e: any, gk: any) => {
  if (e) e.preventDefault();
  if (this._dragKind.value === 'token') this._dropKey.value = gk;
};

  onDragLeave = (e: any) => {
  if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
  this._isOver.value = false;
  this._dropKey.value = '';
};

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

  clearAll = () => {
  this.clearGrouping && this.clearGrouping();
};

  labelFor = (key: any) => {
  const col = this.groupableColumns.find((c: any) => c.id === key);
  return col && col.label || key;
};
}
