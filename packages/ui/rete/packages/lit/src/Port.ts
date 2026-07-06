import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, createContext } from '@lit/context';

const __rozieCtx_rete_nodeType = createContext(Symbol.for("rozie:rete:nodeType"));

@customElement('rozie-port')
export default class Port extends SignalWatcher(LitElement) {
  /**
   * Declares an OUTPUT port and names its key — set this (not `input`) so the port direction resolves to `output`. The attribute is `output`, not `out`: `out`/`in` are awkward bare identifiers, so `output`/`input` are used across all six targets.
   * @example
   * <Port output="num" type="number" />
   */
  @property({ type: String, reflect: true }) output: string = undefined;
  /**
   * Declares an INPUT port and names its key — set this (not `output`) so the port direction resolves to `input`. The attribute is `input`, not `in`: `in` is a JS reserved word that Svelte's mandatory `$props()` destructure rejects, so `input`/`output` are used instead.
   */
  @property({ type: String, reflect: true }) input: string = undefined;
  /**
   * The port TYPE — drives the canvas's typed-socket `:validate-types` (a type-mismatched connection is auto-rejected). It is the typed layer, NOT socket identity (a single shared Socket gates identity). Optional: an untyped port imposes no type constraint and connects to anything.
   */
  @property({ type: String, reflect: true }) type: string = undefined;
  /**
   * Optional socket label shown next to the port (defaults to the port key when omitted).
   */
  @property({ type: String, reflect: true }) label: string = undefined;
  /**
   * Allow multiple connections into/out of this socket. Left undefined by default to preserve the canvas's side asymmetry: outputs default to multi, inputs default to single. To force an explicit multi input, use the bare `multiple` attribute (`<Port ... multiple />`) — it resolves to `true` on all six targets.
   */
  @property({ type: Object }) multiple: unknown = undefined;
  /**
   * Visual placement of the socket on the node: `left`, `right`, `top`, or `bottom`. Defaults by direction (input → left, output → right). `top`/`bottom` enable vertical flows (decision trees, top-down pipelines) — the canvas lays the socket out on that edge and the connection anchor shifts onto the matching axis.
   */
  @property({ type: String, reflect: true }) position: string = undefined;
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
      this.nt.addPort(this.portSide(), this.portKey(), this.type, this.label, this.multiple, this.position);
    }
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.added) return;
    const live = this.injectedType;
    if (live == null) return;
    this.nt = live;
    this.added = true;
    this.nt.addPort(this.portSide(), this.portKey(), this.type, this.label, this.multiple, this.position);
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
