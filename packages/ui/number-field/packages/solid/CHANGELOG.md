# @rozie-ui/number-field-solid

## 0.1.3

### Patch Changes

- Fixed: the `themes/*.css` design-token bridge files' example `import` line named the wrong package (`@rozie-ui/<family>-react`) on every non-React target — copied byte-for-byte from one canonical source. It now names `@rozie-ui/number-field-solid`, this package's own.
- 57607be: **Debut — the Solid target of nine families publishes for the first time.** The React/Vue/
  Svelte/Lit/Angular targets of these nine families (`dialog`, `lexical`, `listbox`, `maplibre`,
  `number-field`, `pagination`, `resizable`, `slider`, `switch`) remain unpublished for now, held
  back until they get their own dogfooding pass — only the Solid leaf of each debuts in this
  release:
  - `@rozie-ui/dialog-solid` — headless WAI-ARIA modal dialog on the native `<dialog>` element
    (top-layer, `::backdrop` scrim, focus trap, Esc-to-dismiss, scroll-lock).
  - `@rozie-ui/lexical-solid` — a rich-text editor wrapping Meta's Lexical engine (RichText/
    History/List/Link plugins, a selection-reading toolbar, and an `@mention` decorator node).
  - `@rozie-ui/listbox-solid` — a headless WAI-ARIA listbox/combobox primitive (single + multi
    select, type-ahead, virtualized keyboard navigation).
  - `@rozie-ui/maplibre-solid` — MapLibre GL map component.
  - `@rozie-ui/number-field-solid` — an accessible numeric input with stepper controls.
  - `@rozie-ui/pagination-solid` — page-range navigation control.
  - `@rozie-ui/resizable-solid` — resizable split-pane primitive.
  - `@rozie-ui/slider-solid` — an accessible range/slider control.
  - `@rozie-ui/switch-solid` — an accessible on/off switch control.

  Each ships with the same day-one fixes as every other Solid leaf in this release, since none of
  these nine has published before and there is no prior version to compare against:
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

  `solid-js ^1.8` is a required peer on all nine, consistent with every other Solid leaf.
  - @rozie/runtime-solid@0.7.5

## 0.1.2

### Patch Changes

- @rozie/runtime-solid@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-solid@0.2.0
