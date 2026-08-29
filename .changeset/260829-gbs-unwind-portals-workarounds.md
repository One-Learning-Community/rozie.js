---
"@rozie-ui/tiptap": patch
"@rozie-ui/tiptap-react": patch
"@rozie-ui/tiptap-vue": patch
"@rozie-ui/tiptap-svelte": patch
"@rozie-ui/tiptap-angular": patch
"@rozie-ui/tiptap-solid": patch
"@rozie-ui/tiptap-lit": patch
"@rozie-ui/rete": patch
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-vue": patch
"@rozie-ui/rete-svelte": patch
"@rozie-ui/rete-angular": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-lit": patch
"@rozie-ui/maplibre": patch
"@rozie-ui/codemirror": patch
"@rozie-ui/codemirror-react": patch
"@rozie-ui/codemirror-vue": patch
"@rozie-ui/codemirror-svelte": patch
"@rozie-ui/codemirror-angular": patch
"@rozie-ui/codemirror-solid": patch
"@rozie-ui/codemirror-lit": patch
"@rozie-ui/chartjs": patch
"@rozie-ui/chartjs-react": patch
"@rozie-ui/chartjs-vue": patch
"@rozie-ui/chartjs-svelte": patch
"@rozie-ui/chartjs-angular": patch
"@rozie-ui/chartjs-solid": patch
"@rozie-ui/chartjs-lit": patch
---

No API change. Internal helpers that read `$portals.<name>` now live at component scope
instead of inside the mount-phase lifecycle hook, now that quick 260829-cd4 hoists the
emitter-synthesized `$portals` closure to component scope on all six targets.

This unwinds the `$portals` mount-scope workarounds five shipped `@rozie-ui` components
carried before that emitter fix landed:

- **`@rozie-ui/tiptap`** — `makeNodeView`/`makeNodeViewExtensions` read `$portals.nodeView`
  directly instead of taking it as an injected parameter.
- **`@rozie-ui/rete`** (`NodeType`) — the `#body` portal-mount closure is a top-level
  function instead of a null-let bridge assigned inside `$onMount`.
- **`@rozie-ui/maplibre`** — the marker/popup/interactive-layer reconcilers are top-level
  functions (guarded by `if (!instance) return`, the actual pre-mount fence) instead of
  null-let bridges.
- **`@rozie-ui/codemirror`** — the panel/topPanel/tooltip/gutter/decoration extension
  factories and `buildState` are top-level; `$onMount` now only constructs the `EditorView`.
- **`@rozie-ui/chartjs`** (and its 8 per-type variants, generated from the same source) —
  `buildConfig` and its click/hover/tooltip helpers are top-level; `$onMount` now only
  captures the canvas ref, constructs the `Chart` instance, and tears it down.

`@rozie-ui/rete`'s sibling `FlowCanvas` component was investigated and found
correct-by-design (its reconcilers are rooted in a `$refs` read that must stay
`$onMount`-scoped under ROZ123) — only its stale comment was corrected, no behavior change.

Several stale comments across these files claimed `$emit` and/or `$slots` also forced mount
scope. Neither ever did, on any target — those comments are corrected too.

No emitter code changed in this patch. `@rozie/core` is not bumped.
