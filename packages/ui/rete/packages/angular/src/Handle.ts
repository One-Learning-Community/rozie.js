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
  }

  ngAfterViewInit() {
    // register this port against the enclosing node's id+side; the parent's
    // reconcileNodes re-runs buildNode with the updated input/output spec.
    if (this.nd) this.nd.addPort(this.side(), this.port(), this.label(), this.multiple());
  }

  nd: any = null;
}

export default Handle;
