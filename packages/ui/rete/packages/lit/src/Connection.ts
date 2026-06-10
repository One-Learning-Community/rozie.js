import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, createContext } from '@lit/context';

const __rozieCtx_rete_canvas = createContext(Symbol.for("rozie:rete:canvas"));

@customElement('rozie-connection')
export default class Connection extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) id: string = undefined;
  @property({ type: String, reflect: true }) source!: string;
  @property({ type: String, reflect: true }) sourceOutput: string = undefined;
  @property({ type: String, reflect: true }) target!: string;
  @property({ type: String, reflect: true }) targetInput: string = undefined;
private __rozieCtxConsumer_rete_canvas = new ContextConsumer(this, { context: __rozieCtx_rete_canvas, subscribe: true });
private get canvas() { return this.__rozieCtxConsumer_rete_canvas.value; }

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this.cv = this.canvas;

    // Effective edge id: explicit prop wins, else the source:out->target:in default
    // (mirrors reconcileConnections so collision dedup is consistent).

    this._disconnectCleanups.push((() => {
      if (this.cv) this.cv.unregisterConnection(this.connId);
    }));

    this.connId = this.edgeId();
    // On Lit the injected canvas may still be undefined here (async context, REQ-30);
    // the $onUpdate below registers once it resolves.
    // On Lit the injected canvas may still be undefined here (async context, REQ-30);
    // the $onUpdate below registers once it resolves.
    if (this.cv && !this.registered) {
      this.registered = true;
      this.cv.registerConnection(this.connId, this.buildConn());
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.registered) return;
    const live = this.canvas;
    if (live == null) return;
    this.cv = live;
    if (this.connId == null) this.connId = this.edgeId();
    this.registered = true;
    this.cv.registerConnection(this.connId, this.buildConn());
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

  cv: any = null;

  edgeId = () => {
  if (this.id != null) return this.id;
  const srcOut = this.sourceOutput != null ? this.sourceOutput : 'out';
  const tgtIn = this.targetInput != null ? this.targetInput : 'in';
  return `${this.source}:${srcOut}->${this.target}:${tgtIn}`;
};

  connId: any = null;

  registered = false;

  buildConn = () => ({
  id: this.connId,
  source: this.source,
  sourceOutput: this.sourceOutput,
  target: this.target,
  targetInput: this.targetInput
});
}
