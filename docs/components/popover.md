# Popover — the cross-framework headless floating primitive

`Popover` is a headless floating primitive for tooltips and popovers. It wraps [`@floating-ui/dom`](https://floating-ui.com), the de-facto vanilla-JS positioning engine behind Radix Popover, Headless UI, MUI, Mantine, Floating Vue, Tippy, and shadcn/ui, and ships for React, Vue, Svelte, Angular, Solid, and Lit.

You bring the **anchor** (the `anchor` slot, or a trigger element) and the **floating content** (the default slot); `Popover` owns everything else: collision-aware placement (offset → flip → shift → arrow middleware), live `autoUpdate` tracking on scroll / resize / layout shift, the open/close gesture (`trigger`: click, hover, or focus), dismissal (Escape + click-outside), the WAI-ARIA wiring (`role="tooltip"` for hover/focus; a click popover is role-neutral by default, or `role="dialog"` + `aria-modal` when you opt into `modal`; plus `aria-expanded` / `aria-describedby`), and a two-way `open` model.

Unlike DOM-creating engines (Cropper.js, flatpickr), Floating UI creates **no DOM of its own** — it only writes `left` / `top` position styles onto *your* floating element. So there is no engine-created-node styling problem: the scoped `<style>` reaches everything, every visual value is a `--rozie-popover-*` CSS custom property, and there is no `:root {}` escape hatch.

Positioning itself is opt-out: `disablePositioning` renders the floating panel in normal document flow with no `computePosition`/`autoUpdate` at all, for a composing component that already owns the panel's own layout — this is what `Combobox`'s `inline` mode relies on to lay its popup out itself instead of letting Popover float it.

## The `@rozie-ui/popover` packages

`Popover` ships as six pre-compiled, per-framework packages. Install the one for your framework plus the `@floating-ui/dom` engine peer; there is no build step and no Rozie toolchain to set up:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/popover-react` | `npm i @rozie-ui/popover-react @floating-ui/dom` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/popover/packages/react/README.md) |
| `@rozie-ui/popover-vue` | `npm i @rozie-ui/popover-vue @floating-ui/dom` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/popover/packages/vue/README.md) |
| `@rozie-ui/popover-svelte` | `npm i @rozie-ui/popover-svelte @floating-ui/dom` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/popover/packages/svelte/README.md) |
| `@rozie-ui/popover-angular` | `npm i @rozie-ui/popover-angular @floating-ui/dom` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/popover/packages/angular/README.md) |
| `@rozie-ui/popover-solid` | `npm i @rozie-ui/popover-solid @floating-ui/dom` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/popover/packages/solid/README.md) |
| `@rozie-ui/popover-lit` | `npm i @rozie-ui/popover-lit @floating-ui/dom` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/popover/packages/lit/README.md) |

Each package carries its framework peer plus the shared `@floating-ui/dom` engine peer.

## Quick start

Two-way bind `open`, project a trigger into the `anchor` slot and the content into the default slot. `Popover` positions the content, tracks it, and toggles `open` on the chosen gesture:

```rozie
<components>
{
  Popover: './Popover.rozie',
}
</components>

<data>
{
  open: false,
}
</data>

<template>
  <Popover r-model:open="$data.open" trigger="click" placement="bottom" :offset="8" arrow @change="onChange">
    <template #anchor="{ toggle }">
      <button @click="toggle">Menu</button>
    </template>
    <div class="menu">Floating content</div>
  </Popover>
</template>
```

`r-model:open` is Rozie's [two-way bind](/guide/props-and-two-way#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `Popover` a boolean, and `Popover` writes the new state back whenever the trigger or a dismissal toggles it, with no `onChange → setState` wiring. The `anchor` slot exposes `{ open, toggle, show, hide }` so you can build any trigger element.

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `open` | `Boolean` | `false` | yes (via `r-model`) | Whether the floating content is open — the sole `model: true` prop. Two-way bind it; `Popover` writes the new state back on every trigger/dismissal/programmatic toggle. |
| `placement` | `String` | `"bottom"` | yes | Floating UI placement (`top`/`right`/`bottom`/`left`, optionally `-start`/`-end`). May flip to the opposite side on overflow unless `disableFlip` is set. |
| `trigger` | `String` | `"click"` | no | Open gesture: `'click'` (toggle, popover dialog), `'hover'` or `'focus'` (tooltip), or `'manual'` for a composing component that drives `open` itself — every gesture handler no-ops and the anchor omits `aria-haspopup`/`aria-expanded`. Also drives the floating `role`. |
| `offset` | `Number` | `8` | yes | Gap in pixels between anchor and content (the `offset` middleware). |
| `disableFlip` | `Boolean` | `false` | yes | Disable the `flip` middleware (keep the content pinned to `placement`). |
| `disableShift` | `Boolean` | `false` | yes | Disable the `shift` middleware (keep the content strictly aligned to the anchor). |
| `arrow` | `Boolean` | `false` | yes | Opt in to a positioned arrow element + the `arrow` middleware. |
| `disabled` | `Boolean` | `false` | yes | Disable the control entirely: the trigger no longer opens, and open content is suppressed. |
| `modal` | `Boolean` | `false` | yes | Opt in to modal dialog semantics for a `click` popover. Off by default: a click popover is a non-modal, click-outside-dismissable layer, rendered role-neutral (the slot content owns its ARIA role) with no `aria-modal`. Set `modal` for a true modal dialog (`role="dialog"` + `aria-modal="true"`) — Popover ships no focus trap, so supply your own focus containment. Ignored for `hover`/`focus` (always tooltip). |
| `strategy` | `String` | `"absolute"` | yes | Floating UI positioning strategy — `'absolute'` (default) or `'fixed'`. Use `'fixed'` to escape a scrollable/overflow-clipping ancestor (e.g. a sticky table header). |
| `bare` | `Boolean` | `false` | yes | Suppress the floating panel's own chrome (background, border, border-radius, box-shadow, padding) so a composing component can supply its own instead. |
| `disablePositioning` | `Boolean` | `false` | yes | Render the floating panel in normal document flow instead of computing a floating position — no `computePosition` call and no `autoUpdate` tracking is ever started. For a composing component that already controls the panel's layout. |
| `keepMounted` | `Boolean` | `false` | yes | Render the floating panel hidden instead of unmounting it while closed, so a composing component whose panel content owns scroll state (e.g. a virtualizer) keeps its DOM across a close/open cycle. A one-shot position computation runs once at mount so the hidden panel already carries correct coordinates before the first open. |
| `matchWidth` | `Boolean` | `false` | yes | Match the floating panel's width exactly to the anchor's width, via the Floating UI `size` middleware. Writes the panel's `width` style only — never touches height. |
| `disableDismiss` | `Boolean` | `false` | yes | Suppress Popover's own Escape-key and click-outside dismissal listeners while `true`. For a composing component that drives `open` itself and needs to temporarily veto Popover's independent dismissal — e.g. while a host sub-surface anchored to (but not nested inside) the composed control legitimately holds focus. Existing `trigger="manual"` consumers relying on real click-outside dismissal are unaffected unless they opt in. |

### Events

| Event | Description |
| --- | --- |
| `change` | Fired whenever the open state changes — a trigger gesture, an Escape / click-outside dismissal, or a programmatic `show`/`hide`/`toggle`. Payload is the new `open` boolean. (Named `change`, not `open`, to avoid the model-prop==emit-name collapse.) |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `show` | Open the floating content (no-op when `disabled`). Emits `change`. |
| `hide` | Close the floating content. Emits `change`. |
| `toggle` | Flip the open state (no-op when `disabled`). Emits `change`. |
| `reposition` | Recompute the floating position immediately (`computePosition`). **Named `reposition`, not `update`**, because `update` is a reserved Lit `ReactiveElement` lifecycle method. |

## Theming

Every value the component renders is a `--rozie-popover-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. Override tokens at any ancestor scope (`:root`, `.dark`, a wrapper, or the `.rozie-popover` element — custom properties inherit through `display:contents`):

```css
.rozie-popover {
  --rozie-popover-bg: #0b1220;
  --rozie-popover-color: #e5e7eb;
  --rozie-popover-border: 1px solid rgba(255, 255, 255, 0.12);
  --rozie-popover-radius: 10px;
  --rozie-popover-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
```

The complete token table and the design-system bridges live on the [dedicated theming page](/components/popover-theming).

## Accessibility

The floating element carries `role="tooltip"` when `trigger` is `hover`/`focus`. A `click` popover is **non-modal and role-neutral by default** — it advertises no `role` and no `aria-modal`, so the slot content owns its own ARIA role (e.g. a `role="menu"`); this keeps a dismissable, non-modal layer from falsely telling assistive tech that sibling content is inert. Opt into `modal` to make it a real modal dialog (`role="dialog"` + `aria-modal="true"`) — Popover ships **no focus trap** (it stays a minimal, headless primitive), so when you set `modal` you must supply your own focus containment for the claim to hold. The anchor carries `aria-haspopup="dialog"` and `aria-expanded` (stringified, never dropped on `false`) whenever `trigger` is a real gesture (`click`/`hover`/`focus`); under `trigger="manual"` neither attribute is rendered, since a composing component driving `open` itself owns its own ARIA claim. In tooltip mode the anchor also gains `aria-describedby` pointing at the open content. Project an interactive, focusable element (e.g. a `<button>`) into the `anchor` slot so the keyboard story works; Escape dismisses while open.
