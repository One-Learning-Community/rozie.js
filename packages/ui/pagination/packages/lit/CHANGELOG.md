# @rozie-ui/pagination-lit

## 0.1.10

### Patch Changes

- a46443a: Lit: a component that is removed from the page and added back works again. Its mount code (`$onMount`) runs again after a real teardown, as on the other targets, so listeners, observers and engine instances are set up again instead of staying torn down. Moving an element within the same task (remove and re-append before it has torn down) keeps the running instance, as before. Mount code and top-level script statements that run again see the element's retained property values.

  Lit: a prop typed with a `<types>` alias made only of string literals (or only of number literals) is now a plain reflected attribute, so `<my-el mode="compact">` works in HTML. It used to be an `Object` property whose attribute value was parsed as JSON, which failed and left the prop `null`.

  Lit: a plain-HTML or Lit consumer (not compiled by Rozie) can fill ANY slot that passes params through the element's `rozieSlots` property, keyed by the slot name (`default` for the default slot): ``el.rozieSlots = { default: ({ item }) => html`<span>${item.label}</span>` }``. The record was only read for dynamically named slots and names that are not identifiers, so an entry for an ordinary scoped slot was silently ignored. It is now tried first for every scoped slot (portal slots excepted), and a component's `$slots.<name>` check counts a record fill as filled, so content gated by `r-if="$slots.<name>"` (for example command-palette's `icon` / `actions` / `trailing` row slots) renders for a record-only fill. A Rozie consumer's fill and the native `<slot>` fallback work as before.

  Changed — Lit: a component's events no longer bubble or cross shadow roots, as on the other targets. `$emit('name', payload)` now dispatches `new CustomEvent('name', { detail: payload, bubbles: false, composed: false })` on the element. A listener on the element itself (`@name=${…}` in a Lit template, `el.addEventListener('name', …)`, a Rozie consumer's `@name`) works as before. A listener on an ancestor element, or outside the shadow root the element sits in, no longer hears it: listen on the element itself. This also means an outer `@rozie-ui/sortable-list` no longer hears the `start` / `add` / `remove` / `reorder` / `end` events of a list nested inside its rows, so the `e.composedPath()[0]` check is no longer needed. Model `*-change` events already behaved this way.

  Lit: a wrapper that forwards `r-on="$listeners"` to a child Rozie component re-dispatches the child's events on its host for the event types its consumer listens for (`@name=${…}`, `addEventListener`), and keeps doing so after the wrapper is moved in the DOM. More generally, an `r-on` listener object re-attaches as soon as its element reconnects, instead of at the element's next render. Listeners added before the component was defined are not seen (the DOM cannot list them); see Cross-Framework Parity.

  Lit: a component whose first render ran after it had already been removed from the page no longer runs its mount code (`$onMount`, document listeners) while detached, where nothing would tear it down; it mounts when it is added back.

  The `@rozie-ui/*-lit` packages listed here are rebuilt with one or more of these fixes; none of them has a string-union prop.

- Updated dependencies [a46443a]
  - @rozie/runtime-lit@0.10.3

## 0.1.9

### Patch Changes

- 3c4b293: README fixes: Angular examples use the component's `<rozie-pagination>` selector (the PascalCase tag they showed fails to compile with NG8001); the Svelte theming import is shown as a TypeScript snippet.

## 0.1.8

### Patch Changes

- 05cb9db: First release of `@rozie-ui/pagination` on React, Vue, Svelte, Angular and Lit. The Solid leaf has been on npm since the 2026-09-26 wave; all six targets of the family now ship at the same version, so one version number means one component revision everywhere.

  The headless, WAI-ARIA pagination control has a windowed page-item model (page numbers and ellipses with `siblingCount` / `boundaryCount`), a page count from either `totalPages` or `total` + `pageSize`, prev/next bounds, roving keyboard navigation, four scoped slots (`item`, `ellipsis`, `prevControl`, `nextControl`), a two-way `modelValue` (a `ControlValueAccessor` on Angular), a typed `change` event (`{ page }`), `goto` / `next` / `prev` / `first` / `last` handle verbs, and design-system token bridges for shadcn/ui, Material 3 and Bootstrap 5.

  The Vue leaf ships a `web-types.json` and the Lit leaf a `custom-elements.json`, so JetBrains IDEs and `lit-plugin` complete the props, events and slots.

- 05cb9db: Pagination fixes found by the pre-release audit (all six targets):
  - Activating a page from the keyboard (`Enter` on a page button) dropped focus to `<body>` on React, Vue, Svelte, Angular and Lit, because the list key included the item's position and every window shift re-created the button. Page numbers are now keyed by value, so focus stays on the page just chosen.
  - Lit: the arrow keys always jumped to "Previous page", because the focused control was read from the document, which stops at the shadow host. It is read from the pager's own root now.
  - `change` now has a declared payload, `PaginationChangePayload` (`{ page: number }`, exported from the package entry). Before, the Angular output was `unknown` (so `p.page` failed to compile) and Lit had no typed `addEventListener('change')`. A handler written against a different payload shape may now be rejected by the type checker.
  - The four slot contexts and the handle are typed: `item` / `ellipsis` / `prevControl` / `nextControl` receive `page: number`, `selected: boolean`, `disabled: boolean`, `index: number` and `goto: () => void`; `goto(page: number)`, `next()`, `prev()`, `first()` and `last()` are typed on the handle (they were `any`). A call with a wrong argument is now a type error.

- 05cb9db: Regenerated with kebab-case attributes for multi-word props: a prop such as `idBase` is now observed as `id-base` (it was the lowercased `idbase`), matching the model props and what a Rozie consumer writes. These packages are new, so the kebab attribute (or the property) is the only form there is.
  - @rozie/runtime-lit@0.10.1

## 0.1.2

### Patch Changes

- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
