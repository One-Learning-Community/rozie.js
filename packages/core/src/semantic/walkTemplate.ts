/**
 * Recursive walker over TemplateAST nodes (Plan 02-02 Task 3).
 *
 * Visits every TemplateElement in the tree (DFS pre-order). Skips text
 * and interpolation nodes — they have no attributes to validate.
 *
 * Used by rForKeyValidator to find every element with `r-for` and check
 * its `:key` shape. Future Phase 2 / Phase 3 walkers (slot lowering,
 * conditional-rendering analysis) can compose on top of this helper.
 */
import type {
  TemplateAST,
  TemplateNode,
  TemplateElement,
} from '../ast/blocks/TemplateAST.js';

function isElement(node: TemplateNode): node is TemplateElement {
  return node.type === 'TemplateElement';
}

/**
 * Walk every TemplateElement in `template`, calling `visit` on each.
 * Recurses into element children; ignores TemplateText and
 * TemplateInterpolation nodes (callers extend the walker if those need
 * visiting).
 */
export function walkTemplateElements(
  template: TemplateAST,
  visit: (el: TemplateElement) => void,
): void {
  const recur = (nodes: TemplateNode[]): void => {
    for (const node of nodes) {
      if (!isElement(node)) continue;
      visit(node);
      recur(node.children);
    }
  };
  recur(template.children);
}
