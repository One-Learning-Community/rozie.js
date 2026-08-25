---
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-vue": patch
"@rozie-ui/rete-svelte": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-lit": patch
"@rozie-ui/rete-angular": patch
---

A `<NodeType>` `#body` now repaints when the bound graph changes. It used to render once
and freeze for the life of the node.

`<FlowCanvas>` projects each node's `#body` through the type's registered renderer and
keeps the resulting handle so the projection can be re-rendered with a fresh scope. Its
in-place re-render path refreshed the low-level `#node` portal handle and the default
title chrome — but never the render-by-type body handle. Since a `<NodeType>`-templated
node has neither of the other two, that path refreshed nothing at all: the graph
reconciled, the engine re-rendered the node, and the body kept whatever it painted first.

So a node whose `data` changed kept showing its old `data`. Re-binding the graph with a
new label, a new status, a new count — all correctly reconciled everywhere except inside
the one template that was supposed to display them. `selected` travels in the same scope,
so a body that styled itself on selection never saw the selection change either.

What changes for you:

- Re-binding `graph` with changed node `data` now updates the rendered `#body`, on all six
  targets. This is the supported way to change node data — `<FlowCanvas>` watches the bound
  `graph` by reference, so a fresh object is what drives a reconcile.
- The `{ node, selected, emit }` slot scope is re-delivered on every re-render, so `selected`
  is live in the body too.
- If you worked around this by putting a component in the `#body` slot and mutating a
  reactive object in place, that keeps working — nothing about it was wrong, it is just no
  longer necessary.

Note on scope: a `#body` re-renders when it is handed a new scope, which is the reactive
portal contract on every target. Reactive values read inside the slot from OUTSIDE that
scope are still snapshot at projection time.
