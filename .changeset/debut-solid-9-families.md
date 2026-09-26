---
"@rozie-ui/dialog-solid": patch
"@rozie-ui/listbox-solid": patch
"@rozie-ui/maplibre-solid": patch
"@rozie-ui/number-field-solid": patch
"@rozie-ui/pagination-solid": patch
"@rozie-ui/resizable-solid": patch
"@rozie-ui/slider-solid": patch
"@rozie-ui/switch-solid": patch
---

**Debut — the Solid target of eight families publishes for the first time.** The React/Vue/
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
