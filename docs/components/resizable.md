# Resizable — the cross-framework headless split pane

`Resizable` is Rozie's **headless, accessible** two-panel splitter / resizable pane — a `@rozie-ui` family with **no third-party engine** behind it. Everything (pointer-drag resizing with pointer capture, `role="separator"` keyboard control, a `[min, max]` clamp, the two-way `size` percent, and the `start` / `end` / `handle` slots) is authored once in `Resizable.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

Under the hood the "engine" is the **platform itself**: native Pointer Events (with pointer capture so the drag keeps tracking even when the cursor leaves the handle) plus the keyboard. The component is **fully controlled with no draft state** — the first panel's percent *is* `size` (the sole `model: true` prop), and the second panel takes the remainder via CSS. There is no measured-geometry state to reconcile: the drag converts the pointer position within the container rect into a percent, clamps it to `[min, max]`, and writes it straight back. Rozie owns the author-side API: the two-way `r-model:size`, the clamp / percent-from-pointer math (unit-tested once and shared by every leaf), and the token-themed skin.

And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/resizable` packages

`Resizable` ships as six pre-compiled, per-framework packages generated from a single `Resizable.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/resizable-react` | `npm i @rozie-ui/resizable-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/resizable/packages/react/README.md) |
| `@rozie-ui/resizable-vue` | `npm i @rozie-ui/resizable-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/resizable/packages/vue/README.md) |
| `@rozie-ui/resizable-svelte` | `npm i @rozie-ui/resizable-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/resizable/packages/svelte/README.md) |
| `@rozie-ui/resizable-angular` | `npm i @rozie-ui/resizable-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/resizable/packages/angular/README.md) |
| `@rozie-ui/resizable-solid` | `npm i @rozie-ui/resizable-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/resizable/packages/solid/README.md) |
| `@rozie-ui/resizable-lit` | `npm i @rozie-ui/resizable-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/resizable/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The per-leaf READMEs and the [API reference](/components/resizable-api) **Props** table are generated from the same IR parse of `Resizable.rozie`, so they cannot drift from the compiled output.

## Quick start

Two-way bind `size` and project the two panes into the `start` / `end` slots. Drag the handle (or focus it and use the Arrow keys) to resize; `@resize` fires on every committed change:

```rozie
<components>
{
  Resizable: './Resizable.rozie',
}
</components>

<data>
{
  split: 30,
}
</data>

<template>
  <div style="height: 320px">
    <Resizable r-model:size="$data.split" :min="20" :max="80" direction="horizontal" @resize="onResize">
      <template #start><nav>Sidebar</nav></template>
      <template #end><main>Content</main></template>
    </Resizable>
  </div>
</template>
```

`r-model:size` is Rozie's [two-way bind](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `Resizable` a percent, `Resizable` writes the clamped new percent back on every drag / keyboard nudge, and the framework reconciler picks it up — no `onChange → setState` wiring. Because `size` is the component's sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor` — the splitter position **is** a form control (`[formControl]` / `[(ngModel)]` bind directly).

For the full prop / event / handle / slot reference, see the [API page](/components/resizable-api). For the per-framework consumption code, see the [usage page](/components/resizable-usage).

## Drag, no measured geometry

The deepest design choice in a split pane is **where the state lives**. `@rozie-ui/resizable` keeps a single number — `size`, the first panel's percent — and nothing else. There is no measured-pixel state to reconcile:

- **Pointer-drag** uses native Pointer Events on the handle plus **pointer capture** (`setPointerCapture`), so `pointermove` / `pointerup` keep firing on the handle even when the cursor races past it — no document-level listeners, no global `mousemove` cleanup. (Rozie authors this with template `@pointerdown` / `@pointermove` / `@pointerup`, the typed-`$event` path.)
- Each `pointermove` reads the container's `getBoundingClientRect()`, converts the pointer coordinate into a first-panel percent, and clamps it to `[min, max]`. The math (`clampPercent` / `percentFromPointer`) is a tiny pure module unit-tested once and vendored verbatim into all six leaves.
- The panels are positioned purely by CSS off one custom property (`--rozie-resizable-size`): the first panel is `width`/`height: var(--rozie-resizable-size)`, the second flexes into the remainder. No JS layout, no `ResizeObserver`.

## Keyboard

Focus the handle (`Tab`), then drive it from the keyboard — the WAI-ARIA window-splitter pattern:

| Key | Action |
| --- | --- |
| `←` / `→` (horizontal) · `↑` / `↓` (vertical) | Nudge `size` by 1% toward / away from the start panel. |
| `Home` | Jump to `min` (smallest first panel). |
| `End` | Jump to `max` (largest first panel). |

The handle is a `role="separator"` with `tabindex="0"`, `aria-orientation` (perpendicular to the split axis), and live `aria-valuenow` / `aria-valuemin` / `aria-valuemax`. When `disabled`, the handle sets `aria-disabled` and ignores both pointer and keyboard.

## Theming

Every value the component renders is a `--rozie-resizable-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. Override tokens at any ancestor scope:

```css
.rozie-resizable {
  --rozie-resizable-accent: #16a34a;
  --rozie-resizable-handle-size: 0.75rem;
  --rozie-resizable-grip-bg: rgba(0, 0, 0, 0.5);
}
```

The full token vocabulary — the handle (`handle-size`, `handle-bg`, `handle-hover-bg`, `handle-active-bg`), the default grip (`grip-bg`, `grip-thickness`, `grip-length`), the accent, the focus ring (`focus-ring-width`, `focus-ring-color`), and the disabled state (`disabled-opacity`) — has documented defaults in `themes/base.css`. Only cosmetic values flow through tokens; the structural rules (the flex container, the `--size`-driven first-panel basis, the remainder second panel, the vertical column variant) compile per-leaf and are not consumer-overridable.

### Design-system bridges

Each package ships token presets that map the resizable tokens onto a known design system's published CSS variables — so the splitter automatically follows that system's light/dark theme and accent:

```ts
import '@rozie-ui/resizable-react/themes/shadcn.css';    // shadcn/ui (Radix) — reads --primary/--ring/--border…
import '@rozie-ui/resizable-react/themes/material.css';  // Material 3 — reads --md-sys-color-*
import '@rozie-ui/resizable-react/themes/bootstrap.css'; // Bootstrap 5 — reads --bs-*
import '@rozie-ui/resizable-react/themes/base.css';      // the documented default token set
```

The full token vocabulary is in [`themes/base.css`](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/resizable/src/themes/base.css).

## Accessibility

- The handle is a `role="separator"` with `tabindex="0"` and `aria-orientation` set perpendicular to the split axis (`vertical` for a horizontal split, `horizontal` for a vertical split — matching the WAI-ARIA window-splitter contract).
- Live `aria-valuenow` / `aria-valuemin` / `aria-valuemax` report the first panel's percent and bounds; `aria-disabled` reflects the `disabled` prop.
- The drag uses pointer capture, so a resize started on the handle keeps tracking through the whole gesture regardless of where the pointer travels — no lost-pointer dead zones.
- Reading the container rect happens only inside post-mount pointer handlers and the imperative handle (never eagerly), so the behavior is identical on all six targets, including inside Lit's shadow root.

## See also

- [API reference](/components/resizable-api) — every prop, event, handle verb, and slot.
- [Usage examples](/components/resizable-usage) — per-framework consumption snippets.
- [Split pane / resizable comparison](/components/resizable-comparison) — vs the per-framework split-pane libraries.
- [Live demo](/components/resizable-demo) — the real Vue package running in the page.
