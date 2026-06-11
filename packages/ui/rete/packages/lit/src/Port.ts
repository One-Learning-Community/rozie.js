import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, createContext } from '@lit/context';

const __rozieCtx_rete_nodeType = createContext(Symbol.for("rozie:rete:nodeType"));

@customElement('rozie-port')
export default class Port extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) output: string = undefined;
  @property({ type: String, reflect: true }) input: string = undefined;
  @property({ type: String, reflect: true }) type: string = undefined;
  @property({ type: Object }) label: unknown = undefined;
  @property({ type: Object }) multiple: unknown = undefined;
private __rozieCtxConsumer_rete_nodeType = new ContextConsumer(this, { context: __rozieCtx_rete_nodeType, subscribe: true });
private get injectedType() { return this.__rozieCtxConsumer_rete_nodeType.value; }

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this.nt = this.injectedType;

    // Derive side + key from which of output=/input= is set. output wins if both are
    // (mis)set. `output`/`input` are ordinary identifiers (NOT reserved words) so they
    // read normally — no member-access-only workaround needed. null key (neither set) ⇒
    // addPort no-ops on the canvas side (key == null guard).

    // register this typed port against the enclosing node TYPE's schema; the canvas's
    // reconcileNodes builds buildNode with the updated input/output spec for every node
    // of that type. On Lit the injected nodeType ctx may still be undefined here (async
    // context, REQ-30) — the $onUpdate below adds the port once it resolves.
    if (this.nt && !this.added) {
      this.added = true;
      this.nt.addPort(this.portSide(), this.portKey(), this.type, this.label, this.multiple);
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.added) return;
    const live = this.injectedType;
    if (live == null) return;
    this.nt = live;
    this.added = true;
    this.nt.addPort(this.portSide(), this.portKey(), this.type, this.label, this.multiple);
  }

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
    return html``;
  }

  nt: any = null;

  portSide = () => this.output != null ? 'output' : 'input';

  portKey = () => this.output != null ? this.output : this.input;

  added = false;
}
