import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-tree-node')
export default class TreeNode extends SignalWatcher(LitElement) {
  static styles = css`
.tree-node[data-rozie-s-a7176a6e] { font-family: system-ui; padding-left: 0.5rem; }
.tree-node__label[data-rozie-s-a7176a6e] { display: inline-block; }
.tree-node__children[data-rozie-s-a7176a6e] { list-style: none; margin: 0.25rem 0 0 0; padding-left: 1rem; border-left: 1px dashed currentColor; }
`;

  @property({ type: Object }) node: any = {
  id: '',
  label: '',
  children: []
};

  private _disconnectCleanups: Array<() => void> = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._disconnectCleanups) fn();
    this._disconnectCleanups = [];
  }

  render() {
    return html`
<div class="tree-node" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-a7176a6e>
  <span class="tree-node__label" data-rozie-s-a7176a6e>${this.node.label}</span>
  ${this.node.children && this.node.children.length > 0 ? html`<ul class="tree-node__children" data-rozie-s-a7176a6e>
    ${repeat<any>(this.node.children, (child, childIndex) => child.id, (child, childIndex) => html`<li key=${child.id} data-index=${childIndex} data-rozie-s-a7176a6e>
      <rozie-tree-node .node=${child}></rozie-tree-node>
    </li>`)}
  </ul>` : nothing}</div>
`;
  }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   */
  private get $attrs(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) out[a.name] = a.value;
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}
