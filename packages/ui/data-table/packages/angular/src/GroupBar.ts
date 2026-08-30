import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-group-bar',
  standalone: true,
  imports: [NgClass],
  template: `

    <div class="rdt-group-bar">
      
      @for (col of groupableColumns(); track col.id) {
    <span class="rdt-group-token" part="group-token" draggable="true" (dragstart)="onChipDragStart($event, col.id)" (dragend)="onDragEnd()">{{ rozieDisplay(col.label) }}</span>
    }

      
      <span class="rdt-group-drop-zone" [ngClass]="{ 'is-over': isOver() }" data-group-drop-zone="" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
        
        @if (!grouping().length) {
    <span class="rdt-group-drop-hint">Drag columns here to group</span>
    }@for (gk of grouping(); track gk) {
    <span class="rdt-group-token" [ngClass]="{ 'is-drop-target': dragKind() === 'token' && dropKey() === gk && draggingId() !== gk }" part="group-token" data-group-token="" draggable="true" (dragstart)="onTokenDragStart($event, gk)" (dragover)="onTokenDragOver($event, gk)" (dragend)="onDragEnd()">
          {{ rozieDisplay(labelFor(gk)) }}
          <button type="button" class="rdt-group-token-remove" [attr.aria-label]="rozieAttr('Remove ' + labelFor(gk) + ' grouping')" (click)="removeKey(gk)">×</button>
        </span>
    }
      </span>

      
      @if (grouping().length) {
    <button type="button" class="rdt-group-clear" (click)="clearAll()">Clear</button>
    }</div>

  `,
  styles: [`
    :host(rozie-group-bar) { display: contents; }
    .rdt-group-drop-zone {
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
    .rdt-group-drop-zone.is-over {
      border-color: var(--rdt-group-drop-zone-border-over, rgba(37, 99, 235, 0.7));
      background: var(--rdt-group-drop-zone-bg-over, rgba(37, 99, 235, 0.08));
    }
    .rdt-group-drop-hint {
      opacity: 0.55;
      font-size: 0.8125em;
      user-select: none;
      pointer-events: none;
    }
    .rdt-group-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--rdt-group-bar-gap, 0.375rem);
    }
    .rdt-group-token-remove {
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
    .rdt-group-token-remove:hover {
      opacity: 1;
    }
    .rdt-group-clear {
      cursor: pointer;
    }
    .rdt-group-token-remove:focus-visible,
    .rdt-group-clear:focus-visible {
      outline: var(--rdt-focus-ring, 2px solid rgba(37, 99, 235, 0.7));
      outline-offset: 1px;
      border-radius: 2px;
    }
    .rdt-group-token.is-drop-target {
      box-shadow: inset 3px 0 0 0 var(--rdt-group-drop-marker, rgba(37, 99, 235, 0.9));
    }
  `],
})
export class GroupBar {
  /**
   * The ordered active grouping key array (read-only source of truth from the `#groupBar` slot scope). This drop-in never keeps its own copy — it always reads this and writes through `applyGrouping` / `clearGrouping`.
   */
  grouping = input<any[]>((() => [])());
  /**
   * The columns offered as grouping targets — `[{ id, label }]` — rendered as draggable chips.
   */
  groupableColumns = input<any[]>((() => [])());
  /**
   * `(cols: string[]) => void` — the only add/reorder writer for the grouping order. Null-guarded at call sites.
   */
  applyGrouping = input<((...args: any[]) => any) | null>(null);
  /**
   * `() => void` — the only clear writer; resets grouping to empty. Null-guarded at call sites.
   */
  clearGrouping = input<((...args: any[]) => any) | null>(null);
  draggingId = signal('');
  isOver = signal(false);
  dragKind = signal('');
  dropKey = signal('');

  // Untyped handler params neutralize to `any` so the native drag-event shapes
  // (dataTransfer / preventDefault) typecheck across all six strict leaves — the
  // global-filter idiom (see FilterText.rozie). NEVER annotate these params.
  // A palette CHIP started dragging → this is an ADD-a-new-column drag.
  onChipDragStart = (e: any, id: any) => {
    this.draggingId.set(id);
    this.dragKind.set('chip');
    if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
  };
  // An active TOKEN started dragging → this is a REORDER drag.
  onTokenDragStart = (e: any, gk: any) => {
    this.draggingId.set(gk);
    this.dragKind.set('token');
    if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', gk);
  };
  // MUST preventDefault — native HTML5 DnD never fires @drop on a zone that does not
  // cancel the dragover default. Also raises the drop-target highlight.
  onDragOver = (e: any) => {
    if (e) e.preventDefault();
    this.isOver.set(true);
  };
  // While reordering, record the token under the pointer as the insertion anchor
  // (we drop BEFORE it). preventDefault so the zone still accepts the drop. Ignored
  // for chip drags — those just append at the end.
  onTokenDragOver = (e: any, gk: any) => {
    if (e) e.preventDefault();
    if (this.dragKind() === 'token') this.dropKey.set(gk);
  };
  // Clear the highlight only on a REAL leave: dragleave ALSO fires when the pointer
  // crosses onto a child token, so ignore leaves whose relatedTarget is still inside
  // the zone (prevents flicker as you hover over existing grouping tokens).
  onDragLeave = (e: any) => {
    if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    this.isOver.set(false);
    this.dropKey.set('');
  };
  // Single reset for all ephemeral drag bookkeeping — called on drop AND on dragend
  // (so an aborted drag, dropped outside the zone, still clears the marker/highlight).
  resetDrag = () => {
    this.draggingId.set('');
    this.dragKind.set('');
    this.dropKey.set('');
    this.isOver.set(false);
  };
  onDragEnd = () => {
    this.resetDrag();
  };
  onDrop = (e: any) => {
    const __grouping = this.grouping();
    const __applyGrouping = this.applyGrouping();
    if (e) e.preventDefault();
    const kind = this.dragKind();
    const anchor = this.dropKey();
    const id = e && e.dataTransfer && e.dataTransfer.getData('text/plain') || this.draggingId();
    this.resetDrag();
    if (!id) return;
    if (kind === 'token') {
      // REORDER: pull the dragged key out, then splice it back in BEFORE the anchor
      // token (or at the end when dropped on empty zone space). Shift-safe because we
      // resolve the anchor by KEY inside the already-filtered array, not by raw index.
      if (__grouping.indexOf(id) === -1) return;
      const without = __grouping.filter((k: any) => k !== id);
      let to = without.length;
      if (anchor && anchor !== id) {
        const j = without.indexOf(anchor);
        if (j !== -1) to = j;
      }
      const next = without.slice(0, to).concat([id]).concat(without.slice(to));
      __applyGrouping && __applyGrouping(next);
      return;
    }
    // APPEND (chip): add the dragged column IF not already grouped — read the order
    // from $props.grouping, write the NEW order through applyGrouping.
    if (__grouping.indexOf(id) !== -1) return;
    const next = __grouping.concat([id]);
    __applyGrouping && __applyGrouping(next);
  };
  removeKey = (key: any) => {
    const __applyGrouping = this.applyGrouping();
    __applyGrouping && __applyGrouping(this.grouping().filter((k: any) => k !== key));
  };
  clearAll = () => {
    const __clearGrouping = this.clearGrouping();
    __clearGrouping && __clearGrouping();
  };
  // Resolve a grouping key to its column's friendly label (falls back to the raw
  // key). Used for both the token text and the remove button's aria-label so the
  // bar reads in human terms, not internal column ids. Untyped like the handlers.
  labelFor = (key: any) => {
    const col = this.groupableColumns().find((c: any) => c.id === key);
    return col && col.label || key;
  };

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default GroupBar;
