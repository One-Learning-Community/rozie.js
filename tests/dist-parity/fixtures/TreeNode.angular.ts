import { Component, ViewEncapsulation, forwardRef, input } from '@angular/core';

@Component({
  selector: 'rozie-tree-node',
  standalone: true,
  imports: [forwardRef(() => TreeNode)],
  template: `

    <div class="tree-node">
      <span class="tree-node__label">{{ node().label }}</span>
      @if (node().children && node().children.length > 0) {
    <ul class="tree-node__children">
        @for (child of node().children; track child.id) {
    <li>
          <rozie-tree-node [node]="child"></rozie-tree-node>
        </li>
    }
      </ul>
    }</div>

  `,
  styles: [`
    .tree-node { font-family: system-ui; padding-left: 0.5rem; }
    .tree-node__label { display: inline-block; }
    .tree-node__children { list-style: none; margin: 0.25rem 0 0 0; padding-left: 1rem; border-left: 1px dashed currentColor; }
  `],
})
export class TreeNode {
  node = input<Record<string, unknown>>((() => ({
    id: '',
    label: '',
    children: []
  }))());
}

export default TreeNode;
