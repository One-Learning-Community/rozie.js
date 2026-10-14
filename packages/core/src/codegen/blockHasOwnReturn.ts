/**
 * Does `block` `return` from its own function — not from a function or class
 * nested inside it? A lifecycle body that does cannot be spliced, statement by
 * statement, into a method shared with other hooks: its `return` would skip
 * every hook after it.
 */
import * as t from '@babel/types';

export function blockHasOwnReturn(block: t.BlockStatement): boolean {
  let found = false;
  const visit = (node: t.Node | null | undefined): void => {
    if (!node || found) return;
    if (t.isReturnStatement(node)) {
      found = true;
      return;
    }
    if (t.isFunction(node) || t.isClass(node)) return;
    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) for (const c of child) visit(c as t.Node);
      else visit(child as t.Node);
    }
  };
  for (const stmt of block.body) visit(stmt);
  return found;
}
