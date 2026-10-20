---
"@rozie-ui/number-field-lit": patch
---

Regenerated with the Lit nullable model prop typing fix: the two-way `modelValue` property is now typed `number | null` (its default is `null`, so the narrower `number` was never true), which a strict TypeScript consumer reading `element.modelValue` now sees. Rendered markup and runtime behaviour are unchanged.
