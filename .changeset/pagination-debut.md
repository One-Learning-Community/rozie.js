---
"@rozie-ui/pagination-react": patch
"@rozie-ui/pagination-vue": patch
"@rozie-ui/pagination-svelte": patch
"@rozie-ui/pagination-angular": patch
"@rozie-ui/pagination-lit": patch
---

First release of `@rozie-ui/pagination` on React, Vue, Svelte, Angular and Lit. The Solid leaf has been on npm since the 2026-09-26 wave; all six targets of the family now ship at the same version, so one version number means one component revision everywhere.

The headless, WAI-ARIA pagination control has a windowed page-item model (page numbers and ellipses with `siblingCount` / `boundaryCount`), a page count from either `totalPages` or `total` + `pageSize`, prev/next bounds, roving keyboard navigation, four scoped slots (`item`, `ellipsis`, `prevControl`, `nextControl`), a two-way `modelValue` (a `ControlValueAccessor` on Angular), a typed `change` event (`{ page }`), `goto` / `next` / `prev` / `first` / `last` handle verbs, and design-system token bridges for shadcn/ui, Material 3 and Bootstrap 5.

The Vue leaf ships a `web-types.json` and the Lit leaf a `custom-elements.json`, so JetBrains IDEs and `lit-plugin` complete the props, events and slots.
