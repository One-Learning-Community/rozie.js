---
"@rozie-ui/rete-react": minor
"@rozie-ui/rete-vue": minor
"@rozie-ui/rete-svelte": minor
"@rozie-ui/rete-angular": minor
"@rozie-ui/rete-solid": minor
"@rozie-ui/rete-lit": minor
---

The auto-layout verb now keeps the route the layout engine computed for an edge and draws
the edge along it, instead of discarding that route and drawing a straight curve directly
between the two sockets. Previously, an edge that had to route around an in-between node
(for example, a "skip" connection spanning several nodes in a flow) would still be drawn as
a straight line cutting through whatever sat between its endpoints, even though the
underlying layout engine had already computed a path around it.

A connection may now carry an optional route on the bound graph model. Because the route
lives in the model the consumer owns and persists, it survives a page reload instead of
reverting to a straight line the next time the graph is loaded.

The layout engine's edge-routing mode has changed as part of this fix, which changes what
auto-layout produces visually: an edge the engine had to route around something now renders
as a segmented (elbow-cornered) path after auto-layout, where it previously rendered as a
straight or gently curved line. An edge the engine left straight is unchanged, and a graph
that never calls the auto-layout verb is unchanged. If you need the previous edge-routing
behavior for any reason, pass `elk.edgeRouting: 'POLYLINE'` in the auto-layout verb's own
options to restore it for that call.

Moving or resizing a node now drops the stored route of every connection attached to that
node, so those edges fall back to the plain straight-line style rather than continuing to
point at where the node used to be. A route is only ever dropped for a connection whose
endpoint actually moved or resized; every other connection's route is left untouched.
