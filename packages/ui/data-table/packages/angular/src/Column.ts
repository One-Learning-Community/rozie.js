import { Component, DestroyRef, InjectionToken, ViewEncapsulation, effect, inject, input, untracked } from '@angular/core';

const __rozieTokenRegistry: Map<string, InjectionToken<unknown>> =
  ((globalThis as Record<string, unknown>).__rozieCtx ??= new Map()) as Map<
    string,
    InjectionToken<unknown>
  >;
function rozieToken(key: string): InjectionToken<unknown> {
  let token = __rozieTokenRegistry.get(key);
  if (!token) {
    token = new InjectionToken<unknown>('rozie:' + key);
    __rozieTokenRegistry.set(key, token);
  }
  return token;
}

@Component({
  selector: 'rozie-column',
  standalone: true,
  template: `


    <div class="rozie-data-table-column" style="display:none"></div>

  `,
})
export class Column {
  id = input<string>('');
  field = input<string>('');
  header = input<string>('');
  sortable = input<boolean>(false);
  filterable = input<boolean>(false);
  pinned = input<string>('');
  width = input<string | number>('');
  registry = inject(rozieToken('data-table:columns'));
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;

  constructor() {
    this.reg = this.registry;

    // idempotency flag so a reactive late-context registration (Lit async first paint,
    // REQ-30) and the $onMount registration never double-register the column.
    effect(() => () => {
      if (this.registered) return;
      const live = this.registry;
      if (live == null) return;
      this.reg = live;
      this.registered = true;
      this.reg.registerColumn(this.colId(), this.buildSpec());
    });
    effect(() => { const __watchVal = (() => [this.id(), this.field(), this.header(), this.sortable(), this.filterable(), this.pinned(), this.width()])(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      if (this.reg) this.reg.registerColumn(this.colId(), this.buildSpec());
    })(); }); });
  }

  ngAfterViewInit() {
    // register this column's spec. On Lit the injected registry may still be undefined
    // here (REQ-30 async context); the $onUpdate below performs the registration once
    // the value arrives.
    if (this.reg && !this.registered) {
      this.registered = true;
      this.reg.registerColumn(this.colId(), this.buildSpec());
    }
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.reg) this.reg.unregisterColumn(this.colId());
    });
  }

  reg: any = null;
  registered = false;
  colId = () => this.id() !== '' ? this.id() : this.field();
  buildSpec = () => ({
    id: this.colId(),
    field: this.field() !== '' ? this.field() : this.colId(),
    header: this.header(),
    sortable: this.sortable(),
    filterable: this.filterable(),
    pinned: this.pinned(),
    width: this.width()
  });
}

export default Column;
