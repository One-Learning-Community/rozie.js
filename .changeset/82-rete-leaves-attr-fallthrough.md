---
"@rozie-ui/rete-vue": patch
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-svelte": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-angular": patch
"@rozie-ui/rete-lit": patch
---

`FlowCanvas` now forwards a consumer-passed `class` and `style` (and any other consumer attribute
or listener) onto its own root element, merged alongside the component's own class — not replacing
it. Before this release, `FlowCanvas` carried the documented `inherit-attrs="false"
inherit-listeners="false"` opt-out with no hand-written spread behind it, so a consumer `class` or
`style` reached nothing. Verified via a live-DOM render across all six targets: the consumer class
appears alongside `rozie-flow-canvas` on the root div, and a consumer CSS custom property resolves
there too.

**`NodeType` is unchanged — its shipped output is byte-identical to the previous release.** It
briefly gained the same fallthrough behavior mid-phase, but its only real element is a
`.rozie-node-type-children` container that is permanently `display:none` / 0×0 (it exists solely so
nested renderless `<Port>` children mount, never paints, and never receives interaction) — so
forwarding attrs onto it would be a silent no-op. `NodeType` kept its opt-out for the same reason
`Port` already documents its own.

Not included in this changeset: `@rozie-ui/maplibre-*` also gains the same `class`/`style`
forwarding on its root, but every `@rozie-ui/maplibre-*` package is listed in
`.changeset/config.json`'s `ignore` array — none has ever been published (each is a 404 on the
npm registry today), matching the other unreleased-family entries already in that list. No version
bump is expected or needed for an unreleased package; this is the pre-existing convention working
as intended, not a gap introduced by this phase.
