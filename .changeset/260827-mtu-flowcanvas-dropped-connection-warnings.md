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

`connection-rejected` now also fires when an explicit `addConnection()` handle
call is rejected by a connection rule, carrying the same `reason` discriminator
(`'type-mismatch'` / `'can-connect'`) the drag path already carried. Previously
that path was suppressed by the same echo-guard that silences props-driven
reconcile, which conflated a deliberate consumer call with the canvas echoing
its own pass. Reconcile stays suppressed and is unchanged. A consumer already
handling `connection-rejected` may therefore see events from imperative calls
that were previously swallowed — the payload shape is unchanged.

The warnings themselves are a console-only diagnostic channel.
