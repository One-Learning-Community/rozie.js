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
  /**
   * Declares an OUTPUT port and names its key — set this (not `input`) so the port direction resolves to `output`. The attribute is `output`, not `out`: `out`/`in` are awkward bare identifiers, so `output`/`input` are used across all six targets.
   * @example
   * <Port output="num" type="number" />
   */
  output = input<string>(undefined);
  /**
   * Declares an INPUT port and names its key — set this (not `output`) so the port direction resolves to `input`. The attribute is `input`, not `in`: `in` is a JS reserved word that Svelte's mandatory `$props()` destructure rejects, so `input`/`output` are used instead.
   */
  input = input<string>(undefined);
  /**
   * The port TYPE — drives the canvas's typed-socket `:validate-types` (a type-mismatched connection is auto-rejected). It is the typed layer, NOT socket identity (a single shared Socket gates identity). Optional: an untyped port imposes no type constraint and connects to anything.
   */
  type = input<string>(undefined);
  /**
   * Optional socket label shown next to the port (defaults to the port key when omitted).
   */
  label = input<string>(undefined);
  /**
   * Allow multiple connections into/out of this socket. Left undefined by default to preserve the canvas's side asymmetry: outputs default to multi, inputs default to single. To force an explicit multi input, use the bare `multiple` attribute (`<Port ... multiple />`) — it resolves to `true` on all six targets.
   */
  multiple = input<unknown>(undefined);
  /**
   * Visual placement of the socket on the node: `left`, `right`, `top`, or `bottom`. Defaults by direction (input → left, output → right). `top`/`bottom` enable vertical flows (decision trees, top-down pipelines) — the canvas lays the socket out on that edge and the connection anchor shifts onto the matching axis.
   */
  position = input<string>(undefined);
  injectedType = inject(rozieToken('rete:nodeType'));

  constructor() {
    this.nt = this.injectedType;

    // Derive side + key from which of output=/input= is set. output wins if both are
    // (mis)set. `output`/`input` are ordinary identifiers (NOT reserved words) so they
    // read normally — no member-access-only workaround needed. null key (neither set) ⇒
    // addPort no-ops on the canvas side (key == null guard).
    effect(() => () => {
      if (this.added) return;
      const live = this.injectedType;
      if (live == null) return;
      this.nt = live;
      this.added = true;
      this.nt.addPort(this.portSide(), this.portKey(), this.type(), this.label(), this.multiple(), this.position());
    });
  }

  ngAfterViewInit() {
    // register this typed port against the enclosing node TYPE's schema; the canvas's
    // reconcileNodes builds buildNode with the updated input/output spec for every node
    // of that type. On Lit the injected nodeType ctx may still be undefined here (async
    // context, REQ-30) — the $onUpdate below adds the port once it resolves.
    if (this.nt && !this.added) {
      this.added = true;
      this.nt.addPort(this.portSide(), this.portKey(), this.type(), this.label(), this.multiple(), this.position());
    }
  }

  nt: any = null;
  portSide = () => this.output() != null ? 'output' : 'input';
  portKey = () => this.output() != null ? this.output() : this.input();
  added = false;
}

export default Port;
