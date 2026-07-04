import { Component, ViewEncapsulation, input, signal } from '@angular/core';

function __rozieDisplay(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      // Circular structure or a non-serialisable value (BigInt nested in an
      // object). Degrade to a non-throwing form so the wrap never crashes the
      // render — that is the entire point of "safe" interpolation (SPEC-1).
      return String(v);
    }
  }
  return String(v);
}

function __rozieAttr(v: unknown): string | null {
  return v == null ? null : __rozieDisplay(v);
}

@Component({
  selector: 'rozie-group-bar',
  standalone: true,
  template: `

    <div class="rdt-group-bar">
      
      @for (col of groupableColumns(); track col.id) {
    <span class="rdt-group-token" part="group-token" draggable="true" (dragstart)="onDragStart($event, col.id)">{{ rozieDisplay(col.label) }}</span>
    }

      
      <span class="rdt-group-drop-zone" data-group-drop-zone="" (dragover)="onDragOver($event)" (drop)="onDrop($event)">
        @for (gk of grouping(); track gk) {
    <span class="rdt-group-token" part="group-token" data-group-token="">
          {{ rozieDisplay(gk) }}
          <button type="button" class="rdt-group-token-remove" [attr.aria-label]="rozieAttr(gk)" (click)="removeKey(gk)">×</button>
        </span>
    }
      </span>

      
      @if (grouping().length) {
    <button type="button" class="rdt-group-clear" (click)="clearAll()">Clear</button>
    }</div>

  `,
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
  applyGrouping = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * `() => void` — the only clear writer; resets grouping to empty. Null-guarded at call sites.
   */
  clearGrouping = input<((...args: unknown[]) => unknown) | null>(null);
  draggingId = signal('');

  onDragStart = (e: any, id: any) => {
    this.draggingId.set(id);
    if (e && e.dataTransfer) e.dataTransfer.setData('text/plain', id);
  };
  onDragOver = (e: any) => {
    if (e) e.preventDefault();
  };
  onDrop = (e: any) => {
    const __grouping = this.grouping();
    const __applyGrouping = this.applyGrouping();
    const id = e && e.dataTransfer && e.dataTransfer.getData('text/plain') || this.draggingId();
    this.draggingId.set('');
    if (!id) return;
    // Append the dragged column id IF not already in the grouping — read the order
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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default GroupBar;
