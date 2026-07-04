import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-group-bar')
export default class GroupBar extends SignalWatcher(LitElement) {
  static styles = css`
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
  
  ${repeat<any>(this.groupableColumns, (col, _idx) => col.id, (col, _idx) => html`<span class="rdt-group-token" part="group-token" key=${rozieAttr(col.id)} draggable="true" @dragstart=${($event: Event) => { this.onDragStart($event, col.id); }} data-rozie-s-546c469a>${rozieDisplay(col.label)}</span>`)}

  
  <span class="${Object.entries({ "rdt-group-drop-zone": true, 'is-over': this._isOver.value }).filter(([, v]) => v).map(([k]) => k).join(' ')}" data-group-drop-zone="" @dragover=${($event: Event) => { this.onDragOver($event); }} @dragleave=${($event: Event) => { this.onDragLeave($event); }} @drop=${($event: Event) => { this.onDrop($event); }} data-rozie-s-546c469a>
    
    ${!this.grouping.length ? html`<span class="rdt-group-drop-hint" data-rozie-s-546c469a>Drag columns here to group</span>` : nothing}${repeat<any>(this.grouping, (gk, _idx) => gk, (gk, _idx) => html`<span class="rdt-group-token" part="group-token" data-group-token="" key=${rozieAttr(gk)} data-rozie-s-546c469a>
      ${rozieDisplay(gk)}
      <button class="rdt-group-token-remove" type="button" aria-label=${rozieAttr(gk)} @click=${($event: Event) => { this.removeKey(gk); }} data-rozie-s-546c469a>×</button>
    </span>`)}
  </span>

  
  ${this.grouping.length ? html`<button class="rdt-group-clear" type="button" @click=${($event: Event) => { this.clearAll(); }} data-rozie-s-546c469a>Clear</button>` : nothing}</div>
`;
  }

  onDragStart = (e: any, id: any) => {
  this._draggingId.value = id;
  if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
};

  onDragOver = (e: any) => {
  if (e) e.preventDefault();
  this._isOver.value = true;
};

  onDragLeave = (e: any) => {
  if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
  this._isOver.value = false;
};

  onDrop = (e: any) => {
  this._isOver.value = false;
  const id = e && e.dataTransfer && e.dataTransfer.getData('text/plain') || this._draggingId.value;
  this._draggingId.value = '';
  if (!id) return;
  // Append the dragged column id IF not already in the grouping — read the order
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
}
