import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, createContext } from '@lit/context';

const __rozieCtx_rete_node = createContext(Symbol.for("rozie:rete:node"));

@customElement('rozie-handle')
export default class Handle extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) side: string = 'output';
  @property({ type: String, reflect: true }) port!: string;
  @property({ type: Object }) label: unknown = undefined;
  @property({ type: Object }) multiple: unknown = undefined;
private __rozieCtxConsumer_rete_node = new ContextConsumer(this, { context: __rozieCtx_rete_node, subscribe: true });
private get node() { return this.__rozieCtxConsumer_rete_node.value; }

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this.nd = this.node;

    // register this port against the enclosing node's id+side; the parent's
    // reconcileNodes re-runs buildNode with the updated input/output spec.
    if (this.nd) this.nd.addPort(this.side, this.port, this.label, this.multiple);
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

  nd: any = null;
}
