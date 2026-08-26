---
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-vue": patch
"@rozie-ui/rete-svelte": patch
"@rozie-ui/rete-angular": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-lit": patch
---

Fixed `autoArrange()` producing a fixed per-hop y offset (a "staircase") on a
source→target chain, which also dragged intermediate nodes into a skip
edge's reserved lane so that edge visually cut through them. `autoArrange()`
now reports each socket's real measured geometry to elk instead of the
built-in preset's engine-default offsets (which matched rete's own default
node view, not FlowCanvas's, and could not be corrected via layout options
once elk pinned the port positions). A node whose sockets are not yet
measurable still arranges via a symmetric, vertically-centred fallback port
instead of throwing or collapsing.

`opts.options` passed to `autoArrange(opts)` now overrides the component's
tuned elk layout defaults (spacing / node placement strategy) key-by-key,
rather than replacing them outright — a caller-supplied key wins, and every
other tuned default still applies.
