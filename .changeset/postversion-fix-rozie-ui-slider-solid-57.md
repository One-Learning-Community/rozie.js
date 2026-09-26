---
"@rozie-ui/slider-solid": patch
---

**Fixed: a consumer `style` prop on `<Slider>` no longer wipes the component's own fill custom
properties.** The root `<div>` computes its fill extent as
`--rozie-slider-fill-start`/`--rozie-slider-fill-end` custom properties; a consumer's own `style`
prop previously replaced that value outright (it was applied AFTER Slider's own style, with no
merge) instead of merging with it. A consumer `style` now merges with Slider's own — the
consumer can still override any individual declaration, but the fill custom properties survive
when the consumer doesn't touch them. No API change.
- @rozie/runtime-solid@0.7.5
