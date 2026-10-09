# @rozie-ui/resizable-solid

## 0.1.6

### Patch Changes

- 67902f8: React and Solid: slot props passed to the component are no longer part of the attribute pass-through spread onto its root element. On Solid a slot render function passed as `<name>Slot` (or a `slots` record) was written to the DOM as an attribute holding the function source; on React the slot members (`render<Name>`, `children`, `slots`) were left in the rest bucket. Regenerated with the compiler fix; no API change.
  - @rozie/runtime-solid@0.9.1

## 0.1.5

### Patch Changes

- c362398: The npm package now includes `CHANGELOG.md`. It was written for every release but left out of the tarball, because npm no longer adds a changelog by itself, so a behaviour change recorded there (such as the 0.7.0 combobox Ctrl/Cmd/Alt+Enter change) was invisible to anyone reading the installed package.
- Updated dependencies [c362398]
  - @rozie/runtime-solid@0.9.0

## 0.1.4

### Patch Changes

- a9d67cb: Typed public surface, phase 1: a component can now declare real TypeScript types for its events, slot parameters and imperative handle, and a consumer on any target sees them instead of `any`. See the new guide, "Typed public surface".

  Four opt-in authoring features (a component that uses none of them compiles exactly as before; all are types-only, with no runtime change on any target):
  - `<types>` block: type-only statements (`import type`, `interface`, `type`, and `export` of those) hoisted into every target and re-exported from the package entry. Anything else is an error (ROZ019, ROZ020). A `<types>` import that clashes with a `<script>` import is ROZ024; an identical duplicate is dropped silently. A `<types>` name that collides with a generated name (`<Name>Props`, `<Name>Handle`, `Rozie<Name>EventMap`, slot context interfaces, …), with a name the compiled module imports (a `<components>` key, its `<Local>Handle`, or a framework / `@rozie/runtime-*` import such as `ReactNode` or `TemplateRef`, reserved on every target), or with a top-level `<script>` declaration is ROZ025.
  - `<emits>` block: `{ name: { payload?: '<type>', docs?: {...} } }`. When present it is the complete list: an undeclared `$emit` is an error (ROZ151), reported at the `$emit` call, and a declared event that is never emitted is a warning (ROZ152), reported at its `<emits>` entry. A `$emit` whose argument count does not match the declared payload is a warning (ROZ157), reported at the call. Invalid entries (including a repeated event name or `payload`/`docs` key), types and docs are ROZ021, ROZ022 and ROZ023. React and Solid get `onX?: (payload: P) => void`, Vue a typed `defineEmits`, Svelte a lowercase `onx` callback, Angular `output<P>()`, and Lit a `CustomEvent<P>` with a generated `Rozie<Name>EventMap` and typed `addEventListener`/`removeEventListener` overloads.
  - `<slot :param-types="{ row: 'Row' }">` types a slot parameter (unknown key ROZ153, malformed value ROZ154).
  - `$expose(verbs, signatures)`: a compile-time-only second argument typing the handle (unknown verb ROZ155, malformed ROZ156). The signature strings are stripped from every emitted module. A verb without a signature keeps its implementation's own types when it has them (a return-type annotation or an annotated `const`, in `<script lang="ts">`) on every target; only a fully untyped verb is `(...args: any[]) => any`.

  Also in this release:
  - The component manifest (`rozie-manifest.json`) is schema v2 and carries emit payloads, expose signatures, the `<types>` text and slot `:param-types`. The reader still accepts v1, so composing an already-published v1 package keeps working. Composing a package whose leaves ship a v2 manifest (`@rozie-ui/popover`, `@rozie-ui/combobox`, …) from your own `.rozie` requires `@rozie/*` at or above this release; a compiler that is too old now says so in ROZ988 (upgrade the toolchain) instead of advising a reinstall of the primitive.
  - `.d.rozie.ts` sidecars now carry `<types>` and type slots and events exactly as each compiled module does. Apart from `<types>`, these changes apply to every component, not only to ones that use the new features: Solid `<slot>Slot` props and JSX.Element shapes; Svelte Snippet shapes and lowercase handler names; no spurious `render<X>` props on Vue, Angular and Lit (Lit declares its slot receivers on the element class instead); no `on<X>` props on Lit; and on Angular, every component with events loses its spurious `on<Event>` props, and the declared class gets typed `OutputEmitterRef<T>` outputs from the same derivation as the compiled `output()` fields (`T` is the declared payload, otherwise `void`, or `unknown` when an untyped `$emit` passes a payload). The `<Name>Handle` of an `$expose` component now keeps the type of a verb declared as an annotated `const` (`const add: AddFn = …`) instead of `(...args: any[]) => any` (or the implementation's own signature). A Solid scoped default slot now accepts a function child.
  - Text such as `<script`, `<style`, `<title` or `<textarea` inside a `<types>`, `<emits>`, `<props>`, `<data>`, `<listeners>` or `<components>` body (in a comment, a docs string, or a generic like `Array<Style>`) no longer desynchronises the block splitter. Those bodies are now opaque to the HTML tokenizer.

  Untyped-handler convergence (the one planned typing change for components that do not opt in; the sidecar fixes above reach them too): an untyped event handler is now `(...args: any[]) => void` on every target. The shared `.d.ts` sidecar, Solid and Svelte used to emit `unknown[]`, which rejected handlers written with a concrete parameter type; React already used `any[]`. The generated sources of the Solid and Svelte leaves (and the React `.d.ts`) change accordingly, hence the patch bumps. `@rozie-ui/sortable-list-solid` and `@rozie-ui/switch-solid` also pick up the scoped-default-slot function-child fix.

  `@rozie-ui/popover-*` and `@rozie-ui/fullcalendar-*` adopt the features and are bumped minor, because typed events can reject a previously accepted wrong-typed handler:
  - popover: the `anchor` slot context is typed (including the new `panelId: string`) and the handle (`show`, `hide`, `toggle`, `reposition`) is typed. Its open state's change event is the `open` model's (Lit: `open-change`, now in `RoziePopoverEventMap` as `CustomEvent<boolean>`).
  - fullcalendar: 11 typed events (for example `eventClick` with `jsEvent: MouseEvent | KeyboardEvent`, and `unselect` with `jsEvent: UIEvent | null`), 10 typed portal slot arguments and 16 typed handle verbs. The `<types>` names are re-exported from every package entry, and the package barrels re-export the handle types and Lit event maps.
  - Both families generate their README event tables from `<emits>` and no longer ship `scripts/event-manifest.mjs`.

- a9d67cb: Props types now accept the root element's HTML attributes when a component passes attributes through to a single root element (typed public surface, phase 3).
  - React: `interface XProps extends Omit<React.ComponentPropsWithoutRef<'<tag>'>, …>` — `className`, `style`, `id`, `aria-*`, `data-*`, element-specific attributes (`disabled` on a `<button>` root, …) and DOM listeners typecheck without a cast.
  - Solid: the same with `ComponentProps<'<tag>'>`.
  - Svelte: `interface Props extends Omit<SvelteHTMLElements['<tag>'], …>` replaces `[key: string]: unknown`. **This is stricter:** an attribute the root element does not support, which the old index signature accepted, is now a type error.
  - The component's own props win on a name collision. `children` stays rejected when the component has no default slot, as do the content-replacing `dangerouslySetInnerHTML` (React) and `innerHTML` / `innerText` / `textContent` (Solid).
  - An `<svg>` root gets the SVG element's attributes (`fill`, `stroke`, `viewBox`, …). Any other non-HTML root (a custom element) gets the generic `HTMLAttributes<HTMLElement>` on React and Solid, and Svelte's permissive custom-element entry.
  - Components with `inherit-attrs="false"`, an `r-if` root or a component root are unchanged. Vue, Angular and Lit are unchanged; they already accepted pass-through attributes.

  The `.d.rozie.ts` sidecars (React, Solid, Svelte) carry the same types. Types only — no runtime change.
  - @rozie/runtime-solid@0.8.0

## 0.1.3

### Patch Changes

- 4f2148d: **Debut — the Solid target of eight families publishes for the first time.** The React/Vue/
  Svelte/Lit/Angular targets of these eight families (`dialog`, `listbox`, `maplibre`,
  `number-field`, `pagination`, `resizable`, `slider`, `switch`) remain unpublished for now, held
  back until they get their own dogfooding pass — only the Solid leaf of each debuts in this
  release:
  - `@rozie-ui/dialog-solid` — headless WAI-ARIA modal dialog on the native `<dialog>` element
    (top-layer, `::backdrop` scrim, focus trap, Esc-to-dismiss, scroll-lock).
  - `@rozie-ui/listbox-solid` — a headless WAI-ARIA listbox/combobox primitive (single + multi
    select, type-ahead, virtualized keyboard navigation).
  - `@rozie-ui/maplibre-solid` — MapLibre GL map component.
  - `@rozie-ui/number-field-solid` — an accessible numeric input with stepper controls.
  - `@rozie-ui/pagination-solid` — page-range navigation control.
  - `@rozie-ui/resizable-solid` — resizable split-pane primitive.
  - `@rozie-ui/slider-solid` — an accessible range/slider control.
  - `@rozie-ui/switch-solid` — an accessible on/off switch control.

  Each ships with the same day-one fixes as every other Solid leaf in this release, since none of
  these eight has published before and there is no prior version to compare against:
  - **Compiled-JS-by-default packaging.** `import`/`require` resolve to plain compiled DOM output
    (`dist/index.{mjs,cjs}`); Solid JSX is kept only behind the `solid` export condition
    (`dist/source/<entry>.jsx`), which `vite-plugin-solid`/SolidStart resolve and compile
    themselves. No workaround needed in a default `vite-plugin-solid` setup, and any bundler
    without a Solid plugin still works.
  - **Boolean HTML attributes lower correctly** — a bare attribute like `disabled` emits Solid's
    strict-typed `disabled={true}` JSX boolean form rather than the string `disabled=""`, which
    would otherwise fail typecheck (`TS2322`) in a consumer's own strict build.
  - **Theming — design-system bridges yield to an ancestor's own tokens.** Each of these families'
    `bootstrap`/`material`/`shadcn` theme bridges resolve their mapped CSS custom properties on the
    component itself with the design system's variable as the fallback, so a token set on any
    ancestor (`:root`, `.dark`, a themed wrapper) always wins over the bridge's own mapping — see
    the theming changeset in this same release for the full description of the underlying fix
    applied across the whole component catalogue.

  `solid-js ^1.8` is a required peer on all eight, consistent with every other Solid leaf.

- 4f2148d: Fixed: the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/resizable-solid`, this package's own.
- 4f2148d: **Fixed: a consumer `style` prop on `<Resizable>` no longer wipes the component's own
  `--rozie-resizable-size` custom property.** The root `<div>` computes its pane size as that
  custom property; a consumer's own `style` prop previously replaced that value outright (it was
  applied AFTER Resizable's own style, with no merge) instead of merging with it. A consumer
  `style` now merges with Resizable's own — the consumer can still override any individual
  declaration, but the size custom property survives when the consumer doesn't touch it. No API
  change.
  - @rozie/runtime-solid@0.7.5
- 7f151a8: Adds an `ariaLabel` prop (default `"Resize panels"`) to the `role="separator"` handle, which previously had no accessible name — a screen reader announced it as just "separator" with no indication of what it resizes. `aria-valuenow` now reflects the clamped size instead of the raw, possibly out-of-range `size` prop.

  Also fixes the README's custom-slot example, which showed React's `renderStart`/`renderEnd` render-prop names for the Solid tab too; Solid's actual props for the `start`/`end`/`handle` slots are `startSlot`/`endSlot`/`handleSlot` (plain JSX-element props, not render functions).

- Updated dependencies [4f2148d]
  - @rozie/runtime-solid@0.7.5

## 0.1.2

### Patch Changes

- @rozie/runtime-solid@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-solid@0.2.0
