# @rozie-ui/pagination-lit

## 0.1.8

### Patch Changes

- 115e395: First release of `@rozie-ui/pagination` on React, Vue, Svelte, Angular and Lit. The Solid leaf has been on npm since the 2026-09-26 wave; all six targets of the family now ship at the same version, so one version number means one component revision everywhere.

  The headless, WAI-ARIA pagination control has a windowed page-item model (page numbers and ellipses with `siblingCount` / `boundaryCount`), a page count from either `totalPages` or `total` + `pageSize`, prev/next bounds, roving keyboard navigation, four scoped slots (`item`, `ellipsis`, `prevControl`, `nextControl`), a two-way `modelValue` (a `ControlValueAccessor` on Angular), a typed `change` event (`{ page }`), `goto` / `next` / `prev` / `first` / `last` handle verbs, and design-system token bridges for shadcn/ui, Material 3 and Bootstrap 5.

  The Vue leaf ships a `web-types.json` and the Lit leaf a `custom-elements.json`, so JetBrains IDEs and `lit-plugin` complete the props, events and slots.

- 115e395: Pagination fixes found by the pre-release audit (all six targets):
  - Activating a page from the keyboard (`Enter` on a page button) dropped focus to `<body>` on React, Vue, Svelte, Angular and Lit, because the list key included the item's position and every window shift re-created the button. Page numbers are now keyed by value, so focus stays on the page just chosen.
  - Lit: the arrow keys always jumped to "Previous page", because the focused control was read from the document, which stops at the shadow host. It is read from the pager's own root now.
  - `change` now has a declared payload, `PaginationChangePayload` (`{ page: number }`, exported from the package entry). Before, the Angular output was `unknown` (so `p.page` failed to compile) and Lit had no typed `addEventListener('change')`. A handler written against a different payload shape may now be rejected by the type checker.
  - The four slot contexts and the handle are typed: `item` / `ellipsis` / `prevControl` / `nextControl` receive `page: number`, `selected: boolean`, `disabled: boolean`, `index: number` and `goto: () => void`; `goto(page: number)`, `next()`, `prev()`, `first()` and `last()` are typed on the handle (they were `any`). A call with a wrong argument is now a type error.

- 115e395: Regenerated with kebab-case attributes for multi-word props: a prop such as `idBase` is now observed as `id-base` (it was the lowercased `idbase`), matching the model props and what a Rozie consumer writes. These packages are new, so the kebab attribute (or the property) is the only form there is.
  - @rozie/runtime-lit@0.10.1

## 0.1.2

### Patch Changes

- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
