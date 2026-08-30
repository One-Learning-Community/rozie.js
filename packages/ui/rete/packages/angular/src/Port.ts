import { Component, DestroyRef, ViewEncapsulation, effect, inject, input } from '@angular/core';
import { rozieToken } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-port',
  standalone: true,
  template: `

  `,
  styles: [`
    :host(rozie-port) { display: contents; }
  `],
})
export class Port {
  /**
   * Declares an OUTPUT port and names its key — set this (not `input`) so the port direction resolves to `output`. The attribute is `output`, not `out`: `out`/`in` are awkward bare identifiers, so `output`/`input` are used across all six targets.
   * @example
   * <rozie-port output="num" type="number" />
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

  // $inject is typed `unknown` (Phase 36 D-4), which the STRICT BUNDLED-LEAF tsc
  // rejects on `.addPort(...)` (TS2339). The .rozie-native fix is the null-let → `any`
  // typeNeutralize idiom: alias through a MODULE-SCOPE `let nt = null` so it is in
  // scope from the Solid hoisted onCleanup teardown (the MapLibre Source/Layer
  // lesson). ZERO emitter change.
  nt: any = null;
  // Derive side + key from which of output=/input= is set. output wins if both are
  // (mis)set. `output`/`input` are ordinary identifiers (NOT reserved words) so they
  // read normally — no member-access-only workaround needed. null key (neither set) ⇒
  // addPort no-ops on the canvas side (key == null guard).
  portSide = () => this.output() != null ? 'output' : 'input';
  portKey = () => this.output() != null ? this.output() : this.input();
  // idempotency flag so the $onMount addPort and the late-context $onUpdate path
  // (Lit async, REQ-30) never double-add the port. (addTypePort is also idempotent —
  // same `type::side::key` key, same value — so this is belt-and-suspenders.)
  added = false;
}

export default Port;
