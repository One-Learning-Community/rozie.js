---
"@rozie/core": minor
"@rozie-ui/captcha-react": patch
"@rozie-ui/captcha-solid": patch
"@rozie-ui/captcha-svelte": patch
"@rozie-ui/chartjs-react": patch
"@rozie-ui/chartjs-solid": patch
"@rozie-ui/chartjs-svelte": patch
"@rozie-ui/combobox-react": patch
"@rozie-ui/combobox-solid": patch
"@rozie-ui/combobox-svelte": patch
"@rozie-ui/command-palette-react": patch
"@rozie-ui/command-palette-solid": patch
"@rozie-ui/command-palette-svelte": patch
"@rozie-ui/cropper-react": patch
"@rozie-ui/cropper-solid": patch
"@rozie-ui/cropper-svelte": patch
"@rozie-ui/data-table-react": patch
"@rozie-ui/data-table-solid": patch
"@rozie-ui/data-table-svelte": patch
"@rozie-ui/date-picker-react": patch
"@rozie-ui/date-picker-solid": patch
"@rozie-ui/date-picker-svelte": patch
"@rozie-ui/dialog-solid": patch
"@rozie-ui/embla-react": patch
"@rozie-ui/embla-solid": patch
"@rozie-ui/embla-svelte": patch
"@rozie-ui/flatpickr-react": patch
"@rozie-ui/flatpickr-solid": patch
"@rozie-ui/flatpickr-svelte": patch
"@rozie-ui/fullcalendar-angular": minor
"@rozie-ui/fullcalendar-lit": minor
"@rozie-ui/fullcalendar-react": minor
"@rozie-ui/fullcalendar-solid": minor
"@rozie-ui/fullcalendar-svelte": minor
"@rozie-ui/fullcalendar-vue": minor
"@rozie-ui/listbox-solid": patch
"@rozie-ui/maplibre-solid": patch
"@rozie-ui/number-field-solid": patch
"@rozie-ui/otp-react": patch
"@rozie-ui/otp-solid": patch
"@rozie-ui/otp-svelte": patch
"@rozie-ui/pagination-solid": patch
"@rozie-ui/pdf-react": patch
"@rozie-ui/pdf-solid": patch
"@rozie-ui/pdf-svelte": patch
"@rozie-ui/popover-angular": minor
"@rozie-ui/popover-lit": minor
"@rozie-ui/popover-react": minor
"@rozie-ui/popover-solid": minor
"@rozie-ui/popover-svelte": minor
"@rozie-ui/popover-vue": minor
"@rozie-ui/resizable-solid": patch
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-svelte": patch
"@rozie-ui/slider-solid": patch
"@rozie-ui/sortable-list-react": patch
"@rozie-ui/sortable-list-solid": patch
"@rozie-ui/sortable-list-svelte": patch
"@rozie-ui/switch-solid": patch
"@rozie-ui/tags-react": patch
"@rozie-ui/tags-solid": patch
"@rozie-ui/tags-svelte": patch
"@rozie-ui/tiptap-react": patch
"@rozie-ui/tiptap-solid": patch
"@rozie-ui/tiptap-svelte": patch
"@rozie-ui/toast-react": patch
"@rozie-ui/toast-solid": patch
"@rozie-ui/toast-svelte": patch
"@rozie-ui/wavesurfer-react": patch
"@rozie-ui/wavesurfer-solid": patch
"@rozie-ui/wavesurfer-svelte": patch
---

Typed public surface, phase 1: a component can now declare real TypeScript types for its events, slot parameters and imperative handle, and a consumer on any target sees them instead of `any`. See the new guide, "Typed public surface".

Four opt-in authoring features (a component that uses none of them compiles exactly as before; all are types-only, with no runtime change on any target):

- `<types>` block: type-only statements (`import type`, `interface`, `type`, and `export` of those) hoisted into every target and re-exported from the package entry. Anything else is an error (ROZ019, ROZ020). A `<types>` import that clashes with a `<script>` import is ROZ024; an identical duplicate is dropped silently. A `<types>` name that collides with a generated name (`<Name>Props`, `<Name>Handle`, `Rozie<Name>EventMap`, slot context interfaces, …), with a name the compiled module imports (a `<components>` key, its `<Local>Handle`, or a framework / `@rozie/runtime-*` import such as `ReactNode` or `TemplateRef`, reserved on every target), or with a top-level `<script>` declaration is ROZ025.
- `<emits>` block: `{ name: { payload?: '<type>', docs?: {...} } }`. When present it is the complete list: an undeclared `$emit` is an error (ROZ151) and a declared event that is never emitted is a warning (ROZ152); both point at the offending call. A `$emit` whose argument count does not match the declared payload is a warning (ROZ157). Invalid entries (including a repeated event name or `payload`/`docs` key), types and docs are ROZ021, ROZ022 and ROZ023. React and Solid get `onX?: (payload: P) => void`, Vue a typed `defineEmits`, Svelte a lowercase `onx` callback, Angular `output<P>()`, and Lit a `CustomEvent<P>` with a generated `Rozie<Name>EventMap` and typed `addEventListener`/`removeEventListener` overloads.
- `<slot :param-types="{ row: 'Row' }">` types a slot parameter (unknown key ROZ153, malformed value ROZ154).
- `$expose(verbs, signatures)`: a compile-time-only second argument typing the handle (unknown verb ROZ155, malformed ROZ156). The signature strings are stripped from every emitted module. A verb without a signature keeps its implementation's own types when it has them (a return-type annotation or an annotated `const`, in `<script lang="ts">`) on every target; only a fully untyped verb is `(...args: any[]) => any`.

Also in this release:

- The component manifest (`rozie-manifest.json`) is schema v2 and carries emit payloads, expose signatures, the `<types>` text and slot `:param-types`. The reader still accepts v1, so composing an already-published v1 package keeps working. Composing a package whose leaves ship a v2 manifest (`@rozie-ui/popover`, `@rozie-ui/combobox`, …) from your own `.rozie` requires `@rozie/*` at or above this release; a compiler that is too old now says so in ROZ988 (upgrade the toolchain) instead of advising a reinstall of the primitive.
- `.d.rozie.ts` sidecars now carry `<types>` and type slots exactly as each compiled module does: Solid `<slot>Slot` props and JSX.Element shapes, Svelte Snippet shapes and lowercase handler names, no spurious `render<X>` props on Vue, Angular and Lit, and no `on<X>` props on Lit. A Solid scoped default slot now accepts a function child.
- Text such as `<script`, `<style`, `<title` or `<textarea` inside a `<types>`, `<emits>`, `<props>`, `<data>`, `<listeners>` or `<components>` body (in a comment, a docs string, or a generic like `Array<Style>`) no longer desynchronises the block splitter. Those bodies are now opaque to the HTML tokenizer.

Untyped-handler convergence (the one intentional change for components that do not opt in): an untyped event handler is now `(...args: any[]) => void` on every target. The shared `.d.ts` sidecar, Solid and Svelte used to emit `unknown[]`, which rejected handlers written with a concrete parameter type; React already used `any[]`. The generated sources of the Solid and Svelte leaves (and the React `.d.ts`) change accordingly, hence the patch bumps. `@rozie-ui/sortable-list-solid` and `@rozie-ui/switch-solid` also pick up the scoped-default-slot function-child fix.

`@rozie-ui/popover-*` and `@rozie-ui/fullcalendar-*` adopt the features and are bumped minor, because typed events can reject a previously accepted wrong-typed handler:

- popover: `change` is typed `boolean`, the `anchor` slot context is typed, and the handle (`show`, `hide`, `toggle`, `reposition`) is typed.
- fullcalendar: 11 typed events (for example `eventClick` with `jsEvent: MouseEvent | KeyboardEvent`, and `unselect` with `jsEvent: UIEvent | null`), 10 typed portal slot arguments and 16 typed handle verbs. The `<types>` names are re-exported from every package entry, and the package barrels re-export the handle types and Lit event maps.
- Both families generate their README event tables from `<emits>` and no longer ship `scripts/event-manifest.mjs`.
