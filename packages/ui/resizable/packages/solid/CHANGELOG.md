# @rozie-ui/resizable-solid

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
