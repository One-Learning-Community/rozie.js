---
"@rozie-ui/data-table-lit": patch
---

Regenerated with the Lit nullable model prop typing fix: the two-way `grouping` property is now typed `any[] | null` (its default is `null`, so the narrower `any[]` was never true), which a strict TypeScript consumer reading `element.grouping` now sees. Rendered markup and runtime behaviour are unchanged.
