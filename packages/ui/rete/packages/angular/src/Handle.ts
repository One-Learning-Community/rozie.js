import { Component, DestroyRef, InjectionToken, ViewEncapsulation, effect, inject, input } from '@angular/core';

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
  selector: 'rozie-handle',
  standalone: true,
  template: `

  `,
})
export class Handle {
  side = input<string>('output');
  port = input.required<string>();
  label = input<unknown>(undefined);
  multiple = input<unknown>(undefined);
  node = inject(rozieToken('rete:node'));

  constructor() {
    this.nd = this.node;

    // idempotency flag so the $onMount addPort and the late-context $onUpdate path
    // (Lit async, REQ-30) never double-add the port. (FlowCanvas.addPort is also
    // de-duped, so this is belt-and-suspenders.)
    effect(() => () => {
      if (this.added) return;
      const live = this.node;
      if (live == null) return;
      this.nd = live;
      this.added = true;
      this.nd.addPort(this.side(), this.port(), this.label(), this.multiple());
    });
  }

  ngAfterViewInit() {
    // register this port against the enclosing node's id+side; the parent's
    // reconcileNodes re-runs buildNode with the updated input/output spec. On Lit
    // the injected node ctx may still be undefined here (async context, REQ-30) —
    // the $onUpdate below adds the port once it resolves.
    if (this.nd && !this.added) {
      this.added = true;
      this.nd.addPort(this.side(), this.port(), this.label(), this.multiple());
    }
  }

  nd: any = null;
  added = false;
}

export default Handle;
