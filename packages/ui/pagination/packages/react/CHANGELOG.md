# @rozie-ui/pagination-react

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

- 05cb9db: React and Solid: slot props passed to the component are no longer part of the attribute pass-through spread onto its root element. On Solid a slot render function passed as `<name>Slot` (or a `slots` record) was written to the DOM as an attribute holding the function source; on React the slot members (`render<Name>`, `children`, `slots`) were left in the rest bucket. Regenerated with the compiler fix; no API change.
- 05cb9db: Props types now accept the root element's HTML attributes when a component passes attributes through to a single root element (typed public surface, phase 3).
  - React: `interface XProps extends Omit<React.ComponentPropsWithoutRef<'<tag>'>, …>` — `className`, `style`, `id`, `aria-*`, `data-*`, element-specific attributes (`disabled` on a `<button>` root, …) and DOM listeners typecheck without a cast.
  - Solid: the same with `ComponentProps<'<tag>'>`.
  - Svelte: `interface Props extends Omit<SvelteHTMLElements['<tag>'], …>`; an attribute the root element does not support is a type error.
  - The component's own props win on a name collision. `children` stays rejected when the component has no default slot, as do the content-replacing `dangerouslySetInnerHTML` (React) and `innerHTML` / `innerText` / `textContent` (Solid).
  - An `<svg>` root gets the SVG element's attributes (`fill`, `stroke`, `viewBox`, …). Any other non-HTML root (a custom element) gets the generic `HTMLAttributes<HTMLElement>` on React and Solid, and Svelte's permissive custom-element entry.
  - Components with `inherit-attrs="false"`, an `r-if` root or a component root are unchanged. Vue, Angular and Lit are unchanged; they already accepted pass-through attributes.

  The `.d.rozie.ts` sidecars (React, Solid, Svelte) carry the same types. Types only — no runtime change.

- 05cb9db: React: a consumer's DOM listener now fires alongside the component's own handler when the component's root element binds its own `@event` and passes attributes through (the default). Before, the root emitted `<el {...attrs} onClick={own}>`, and JSX's last-wins rule silently dropped the consumer's `onClick` — while Vue, Svelte, Solid and Lit already fired both. The root now emits `{...mergeListeners({ onClick: own }, pickListeners(attrs))}` after its merged `className`, so both handlers fire (own first) and the merged class is never re-applied.

  `@rozie/runtime-react` gains `pickListeners`, the React port of the Solid helper: it filters the pass-through bucket down to function-valued `on*` keys before the merge.

  Every React `mergeListeners(...)` events partial is now typed with `satisfies <element props> & Record<string, unknown>`, so its handlers get the same `$event` type they would have as JSX props — previously the listener-merge partial (e.g. `r-on="$listeners"` plus a local `@click` with `inherit-attrs="false"`) emitted an untyped `$event`, an implicit-`any` error under a strict consumer tsconfig.

- Updated dependencies [b52bd14]
  - @rozie/runtime-react@0.10.1

## 0.1.2

### Patch Changes

- @rozie/runtime-react@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-react@0.2.0
