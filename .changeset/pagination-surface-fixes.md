---
"@rozie-ui/pagination-react": patch
"@rozie-ui/pagination-vue": patch
"@rozie-ui/pagination-svelte": patch
"@rozie-ui/pagination-angular": patch
"@rozie-ui/pagination-solid": patch
"@rozie-ui/pagination-lit": patch
---

Pagination fixes found by the pre-release audit (all six targets):

- Activating a page from the keyboard (`Enter` on a page button) dropped focus to `<body>` on React, Vue, Svelte, Angular and Lit, because the list key included the item's position and every window shift re-created the button. Page numbers are now keyed by value, so focus stays on the page just chosen.
- Lit: the arrow keys always jumped to "Previous page", because the focused control was read from the document, which stops at the shadow host. It is read from the pager's own root now.
- `change` now has a declared payload, `PaginationChangePayload` (`{ page: number }`, exported from the package entry). Before, the Angular output was `unknown` (so `p.page` failed to compile) and Lit had no typed `addEventListener('change')`. A handler written against a different payload shape may now be rejected by the type checker.
- The four slot contexts and the handle are typed: `item` / `ellipsis` / `prevControl` / `nextControl` receive `page: number`, `selected: boolean`, `disabled: boolean`, `index: number` and `goto: () => void`; `goto(page: number)`, `next()`, `prev()`, `first()` and `last()` are typed on the handle (they were `any`). A call with a wrong argument is now a type error.
