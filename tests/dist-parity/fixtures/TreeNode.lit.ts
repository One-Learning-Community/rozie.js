import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
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
<div class="tree-node" data-rozie-s-a7176a6e>
  <span class="tree-node__label" data-rozie-s-a7176a6e>${this.node.label}</span>
  ${this.node.children && this.node.children.length > 0 ? html`<ul class="tree-node__children" data-rozie-s-a7176a6e>
    ${repeat<any>(this.node.children, (child, childIndex) => child.id, (child, childIndex) => html`<li key=${child.id} data-index=${childIndex} data-rozie-s-a7176a6e>
      <rozie-tree-node .node=${child}></rozie-tree-node>
    </li>`)}
  </ul>` : nothing}</div>
`;
  }
}
