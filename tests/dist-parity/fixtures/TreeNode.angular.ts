import { Component, ElementRef, Renderer2, ViewEncapsulation, effect, forwardRef, inject, input, viewChild } from '@angular/core';

@Component({
  selector: 'rozie-tree-node',
  standalone: true,
  imports: [forwardRef(() => TreeNode)],
  template: `

    <div class="tree-node" #rozieSpread_0>
      <span class="tree-node__label">{{ node().label }}</span>
      @if (node().children && node().children.length > 0) {
    <ul class="tree-node__children">
        @for (child of node().children; track child.id; let childIndex = $index) {
    <li [attr.data-index]="childIndex">
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
  node = input<Record<string, any>>((() => ({
    id: '',
    label: '',
    children: []
  }))());

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (v === null || v === false) renderer.removeAttribute(el, k);
        else renderer.setAttribute(el, k, String(v));
      }
      prevKeysByElement.set(el, Object.keys(safeObj));
    };
  })();

  private __rozieGetHostAttrs = (() => {
    const host = inject(ElementRef);
    return () => {
      const el = host.nativeElement as HTMLElement;
      const out: Record<string, unknown> = {};
      for (const a of Array.from(el.attributes)) out[a.name] = a.value;
      return out;
    };
  })();

  private __rozieSpread_0_effect = effect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });
}

export default TreeNode;
