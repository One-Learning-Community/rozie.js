---
"@rozie-ui/resizable-solid": patch
---

**Fixed: a consumer `style` prop on `<Resizable>` no longer wipes the component's own
`--rozie-resizable-size` custom property.** The root `<div>` computes its pane size as that
custom property; a consumer's own `style` prop previously replaced that value outright (it was
applied AFTER Resizable's own style, with no merge) instead of merging with it. A consumer
`style` now merges with Resizable's own — the consumer can still override any individual
declaration, but the size custom property survives when the consumer doesn't touch it. No API
change.
- @rozie/runtime-solid@0.7.5
