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
  selector: 'rozie-port',
  standalone: true,
  template: `

  `,
})
export class Port {
  out = input<string>(undefined);
  in = input<string>(undefined);
  type = input<string>(undefined);
  label = input<unknown>(undefined);
  multiple = input<unknown>(undefined);
  injectedType = inject(rozieToken('rete:nodeType'));

  constructor() {
    this.nt = this.injectedType;

    // Derive side + key from which of out=/in= is set. out wins if both are (mis)set;
    // `in` is read ONLY via $props.in (reserved word — never destructured bare). null
    // key (neither set) ⇒ addPort no-ops on the canvas side (key == null guard).
    effect(() => () => {
      if (this.added) return;
      const live = this.injectedType;
      if (live == null) return;
      this.nt = live;
      this.added = true;
      this.nt.addPort(this.portSide(), this.portKey(), this.type(), this.label(), this.multiple());
    });
  }

  ngAfterViewInit() {
    // register this typed port against the enclosing node TYPE's schema; the canvas's
    // reconcileNodes builds buildNode with the updated input/output spec for every node
    // of that type. On Lit the injected nodeType ctx may still be undefined here (async
    // context, REQ-30) — the $onUpdate below adds the port once it resolves.
    if (this.nt && !this.added) {
      this.added = true;
      this.nt.addPort(this.portSide(), this.portKey(), this.type(), this.label(), this.multiple());
    }
  }

  nt: any = null;
  portSide = () => this.out() != null ? 'output' : 'input';
  portKey = () => this.out() != null ? this.out() : this.in();
  added = false;
}

export default Port;
