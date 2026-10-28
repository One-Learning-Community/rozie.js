# @rozie-ui/pagination-angular

## 0.1.8

### Patch Changes

- 05cb9db: Regenerated with the compiler fixes found while building `@rozie-ui/select`. Depending on the target and the component:
  - Angular: a two-way (`model: true`) prop is now controlled while the consumer binds a value — a write by the component only emits `<name>Change`, so a consumer that refuses the change keeps the control on its value. The prop keeps its `ModelSignal` type. `$onUpdate` hooks now run (after every render); they never ran before. An output named like a native bubbling event (`change`, `submit`, `reset`, `select`) no longer also delivers the native event to a consumer's binding.
  - Vue: a two-way prop bound one-way (`:value` without `v-model`) is now controlled too: the component's write emits `update:value` and the control keeps the consumer's value.
  - React: an `$expose` verb now runs in `flushSync`, so calls made in one tick each see what the call before left; primitive script constants are plain `const`s; a body statement no longer reads a binding declared after it on the first render.
  - Svelte, Solid: a `$watch` now sees a `$data` write made in `$onMount`.
  - Lit: a `$watch` whose getter reads both props and `$data` re-runs when only the prop changes; duplicated comments in lifecycle bodies are gone.

- 05cb9db: First release of `@rozie-ui/pagination` on React, Vue, Svelte, Angular and Lit. The Solid leaf has been on npm since the 2026-09-26 wave; all six targets of the family now ship at the same version, so one version number means one component revision everywhere.

  The headless, WAI-ARIA pagination control has a windowed page-item model (page numbers and ellipses with `siblingCount` / `boundaryCount`), a page count from either `totalPages` or `total` + `pageSize`, prev/next bounds, roving keyboard navigation, four scoped slots (`item`, `ellipsis`, `prevControl`, `nextControl`), a two-way `modelValue` (a `ControlValueAccessor` on Angular), a typed `change` event (`{ page }`), `goto` / `next` / `prev` / `first` / `last` handle verbs, and design-system token bridges for shadcn/ui, Material 3 and Bootstrap 5.

  The Vue leaf ships a `web-types.json` and the Lit leaf a `custom-elements.json`, so JetBrains IDEs and `lit-plugin` complete the props, events and slots.

- 05cb9db: Pagination fixes found by the pre-release audit (all six targets):
  - Activating a page from the keyboard (`Enter` on a page button) dropped focus to `<body>` on React, Vue, Svelte, Angular and Lit, because the list key included the item's position and every window shift re-created the button. Page numbers are now keyed by value, so focus stays on the page just chosen.
  - Lit: the arrow keys always jumped to "Previous page", because the focused control was read from the document, which stops at the shadow host. It is read from the pager's own root now.
  - `change` now has a declared payload, `PaginationChangePayload` (`{ page: number }`, exported from the package entry). Before, the Angular output was `unknown` (so `p.page` failed to compile) and Lit had no typed `addEventListener('change')`. A handler written against a different payload shape may now be rejected by the type checker.
  - The four slot contexts and the handle are typed: `item` / `ellipsis` / `prevControl` / `nextControl` receive `page: number`, `selected: boolean`, `disabled: boolean`, `index: number` and `goto: () => void`; `goto(page: number)`, `next()`, `prev()`, `first()` and `last()` are typed on the handle (they were `any`). A call with a wrong argument is now a type error.

- Updated dependencies [05cb9db]
  - @rozie/runtime-angular@0.10.1
