---
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-vue": patch
"@rozie-ui/rete-svelte": patch
"@rozie-ui/rete-angular": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-lit": patch
---

A `graph.connections` edge that cannot be placed — an unknown node id, a port
key the node does not have, or one a connection rule rejects — now logs a
one-time developer warning naming that edge, instead of vanishing silently.
The warning is deferred until the graph settles, so an edge that lands on a
later reconcile pass (for example, one whose target node or port registers
just after the edge itself) stays silent.

The imperative `addConnection()` handle verb now returns `null` and logs a
warning when the connection is rejected by connection validation or names a
port key that does not exist on the endpoint node, instead of returning an
id for an edge the canvas never actually took — which previously left a
phantom entry in the canvas's internal connection map that desynchronised
the next graph reconcile. A bad port key no longer surfaces as a raw,
unhandled rete exception.

The `connection-rejected` event contract is unchanged — these new warnings
are a console-only diagnostic channel. Consumers relying on that event see
no difference in behavior.
