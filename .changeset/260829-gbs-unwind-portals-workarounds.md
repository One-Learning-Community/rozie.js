---
"@rozie-ui/tiptap-react": patch
"@rozie-ui/tiptap-vue": patch
"@rozie-ui/tiptap-svelte": patch
"@rozie-ui/tiptap-angular": patch
"@rozie-ui/tiptap-solid": patch
"@rozie-ui/tiptap-lit": patch
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-vue": patch
"@rozie-ui/rete-svelte": patch
"@rozie-ui/rete-angular": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-lit": patch
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

This unwinds the `$portals` mount-scope workarounds in three shipped `@rozie-ui`
components (of the five originally targeted — see the CodeMirror note below) carried
before that emitter fix landed:

- **`@rozie-ui/tiptap`** — `makeNodeView`/`makeNodeViewExtensions` read `$portals.nodeView`
  directly instead of taking it as an injected parameter.
- **`@rozie-ui/rete`** (`NodeType`) — the `#body` portal-mount closure is a top-level
  function instead of a null-let bridge assigned inside `$onMount`.
- **`@rozie-ui/chartjs`** (and its 8 per-type variants, generated from the same source) —
  `buildConfig` and its click/hover/tooltip helpers are top-level; `$onMount` now only
  captures the canvas ref, constructs the `Chart` instance, and tears it down.

`@rozie-ui/maplibre`'s per-framework leaves are changesets-ignored (deliberately
unpublished) even though the marker/popup/interactive-layer reconcile unwind landed and
is included in the source diff — no leaf version bump applies.

`@rozie-ui/rete`'s sibling `FlowCanvas` component was investigated and found
correct-by-design (its reconcilers are rooted in a `$refs` read that must stay
`$onMount`-scoped under ROZ123) — only its stale comment was corrected, no behavior change.

**`@rozie-ui/codemirror` REVERTED, not shipped.** The relocation was implemented, gated
green (build/test/typecheck), and committed, but the full Docker VR union caught a
React-only regression it introduced: the CM6 `Compartment` instances (`themeCompartment`
et al.) lost their `useMemo(() => new Compartment(), [])` wrapping and became a
per-render `new Compartment()` once `buildState` (which reads them) moved out of
`$onMount` to a top-level `useCallback` — an emitter memoization-heuristic gap, not a
`.rozie`-source-fixable issue (SCOPE FENCE: no emitter code changed in this quick). Two
React `code-mirror.spec.ts` tests failed (theme-toggle class never changing; an
extensions-toggle readOnly reconfigure never taking effect) while all five other targets
stayed green. The commit was reverted; CodeMirror.rozie and its six leaves are unchanged
from `main` before this quick. Recorded as a follow-up for the emitter team, not
worked around here.

Several stale comments across the touched files claimed `$emit` and/or `$slots` also
forced mount scope. Neither ever did, on any target — those comments are corrected too.

No emitter code changed in this patch. `@rozie/core` is not bumped.

**Why no `@rozie-ui/<family>` umbrella entries.** Those six packages are `private: true`, so changesets treats them as ignored; a changeset that mixes ignored and non-ignored packages is rejected outright (`Mixed changesets that contain both ignored and not ignored packages are not allowed`), failing `changeset status` and any release run. Only the published, consumer-installed per-framework leaves are listed.
