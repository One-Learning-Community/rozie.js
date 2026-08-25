---
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-vue": patch
"@rozie-ui/rete-svelte": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-lit": patch
"@rozie-ui/rete-angular": patch
---

Connections now follow a node whose box changes size. They used to stay pinned to wherever
the sockets were at first paint.

A node auto-sizes to its `#body`, so body content that changes width changes the node box,
and the sockets move with it. But a socket's position was measured exactly once — on the
render path that builds a node from scratch. Nothing re-measured when an existing node's
box changed, so the stored coordinates went stale and every attached edge kept pointing at
the old spot. On a graph where five of seven nodes narrowed, not one of eight connection
paths moved.

The same defect hit the `resizable` corner handles: dragging a node bigger or smaller left
its edges behind. That half was never reachable through `#body` content before, so it is
not new in 0.2.1 — it has been there since resizing shipped.

`<FlowCanvas>` now watches each node's box and re-measures that node's sockets whenever it
changes size, which pushes fresh coordinates into the connections and redraws them.
Watching the box rather than hooking one specific trigger means this covers every way a
node changes size, including ones the library never sees directly:

- `#body` content that grows or shrinks — a badge, a status line, a count
- a `resizable` node dragged by its corner handles
- an image or webfont that lands after first paint
- a component you put in the `#body` slot that resizes itself later

There is no API change and nothing to opt into.

If you worked around this by pinning your nodes to a fixed width so the box could never
resize, you can stop. That workaround is what it looks like — uniform-width nodes adopted
to dodge a rendering bug — and it is no longer needed.

One thing worth knowing, unchanged by this release: the `#body` slot scope is
`{ node, selected, emit }`. Content driven from your own component state, read from
outside that scope, is still snapshot when the body is first projected. Route it through
the node's own `data` and it stays live.
