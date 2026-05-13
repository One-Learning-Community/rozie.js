import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { repeat } from 'lit/directives/repeat.js';

@customElement('rozie-tree-node')
export default class TreeNode extends SignalWatcher(LitElement) {
  static styles = css`
.tree-node { font-family: system-ui; padding-left: 0.5rem; }
.tree-node__label { display: inline-block; }
.tree-node__children { list-style: none; margin: 0.25rem 0 0 0; padding-left: 1rem; border-left: 1px dashed currentColor; }
`;

  @property({ type: Object }) node: object = {
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
<div class="tree-node">
  <span class="tree-node__label">${this.node.label}</span>
  ${this.node.children && this.node.children.length > 0 ? html`<ul class="tree-node__children">
    ${repeat(this.node.children, (child) => child.id, (child, _idx) => html`<li key=${child.id}>
      <rozie-tree-node .node=${child}></rozie-tree-node>
    </li>`)}
  </ul>` : nothing}</div>
`;
  }
}
