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
  <Popover r-model:open="$data.open" trigger="click" placement="bottom" :offset="8" arrow>
    <template #anchor="{ open, toggle, panelId }">
      <button @click="toggle" :aria-expanded="open" :aria-controls="panelId">Menu</button>
    </template>
    <div class="menu">Floating content</div>
  </Popover>
</template>
```

`r-model:open` is Rozie's [two-way bind](/guide/props-and-two-way#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `Popover` a boolean, and `Popover` writes the new state back whenever the trigger or a dismissal toggles it, with no `onChange → setState` wiring. The model's change event is Popover's only change signal. The `anchor` slot exposes `{ open, toggle, show, hide, panelId }` so you can build any trigger element and give it the matching ARIA.

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `open` | `Boolean` | `false` | yes (via `r-model`) | Whether the floating content is open — the sole `model: true` prop, and its change event is the only change signal `Popover` fires (see [Events](#events)). Two-way bind it; `Popover` writes the new state back on every trigger/dismissal/programmatic toggle. |
| `placement` | `String` | `"bottom"` | yes | Floating UI placement (`top`/`right`/`bottom`/`left`, optionally `-start`/`-end`). Flips to the opposite side on overflow unless `disableFlip` is set; a `left`/`right` placement with no room on either side falls back to below or above the anchor. See [Staying inside the viewport](#staying-inside-the-viewport). |
| `trigger` | `String` | `"click"` | no | Open gesture: `'click'` (toggle, popover dialog), `'hover'` or `'focus'` (tooltip), or `'manual'` for a composing component that drives `open` itself — every gesture handler no-ops. Also drives the ARIA: only `'click'` claims a popup on the anchor (`aria-haspopup`/`aria-expanded`/`aria-controls`); tooltips get `aria-describedby`; `'manual'` makes no anchor claim. See [Accessibility](#accessibility). |
| `offset` | `Number` | `8` | yes | Gap in pixels between anchor and content (the `offset` middleware). |
| `disableFlip` | `Boolean` | `false` | yes | Disable the `flip` middleware (keep the content pinned to `placement`, including the below/above fallback of a `left`/`right` placement). |
| `disableShift` | `Boolean` | `false` | yes | Disable the `shift` middleware (keep the content strictly aligned to the anchor). Also drops the measured width cap (`--rozie-popover-available-width`). |
| `arrow` | `Boolean` | `false` | yes | Opt in to a positioned arrow element + the `arrow` middleware. |
| `disabled` | `Boolean` | `false` | yes | Disable the control entirely: the trigger no longer opens, and open content is suppressed. |
| `modal` | `Boolean` | `false` | yes | Opt in to modal dialog semantics for a `click` popover. Off by default: a click popover is a non-modal, click-outside-dismissable layer, rendered role-neutral (the slot content owns its ARIA role) with no `aria-modal`. Set `modal` for a true modal dialog (`role="dialog"` + `aria-modal="true"`) — Popover ships no focus trap, so supply your own focus containment. Ignored for `hover`/`focus` (always tooltip). |
| `strategy` | `String` | `"absolute"` | yes | Floating UI positioning strategy — `'absolute'` (default) or `'fixed'`. Use `'fixed'` to escape a scrollable/overflow-clipping ancestor (e.g. a sticky table header). |
| `bare` | `Boolean` | `false` | yes | Suppress the floating panel's own chrome (background, border, border-radius, box-shadow, padding) so a composing component can supply its own instead. |
| `disablePositioning` | `Boolean` | `false` | yes | Render the floating panel in normal document flow instead of computing a floating position — no `computePosition` call and no `autoUpdate` tracking is ever started. For a composing component that already controls the panel's layout. |
| `keepMounted` | `Boolean` | `false` | yes | Render the floating panel hidden instead of unmounting it while closed, so a composing component whose panel content owns scroll state (e.g. a virtualizer) keeps its DOM across a close/open cycle. A one-shot position computation runs once at mount so the hidden panel already carries correct coordinates before the first open. |
| `matchWidth` | `Boolean` | `false` | yes | Match the floating panel's width exactly to the anchor's width, via the Floating UI `size` middleware. Writes the panel's `width` style only — never touches height. |
| `disableDismiss` | `Boolean` | `false` | yes | Suppress Popover's own Escape-key and click-outside dismissal listeners while `true`. For a composing component that drives `open` itself and needs to temporarily veto Popover's independent dismissal — e.g. while a host sub-surface anchored to (but not nested inside) the composed control legitimately holds focus. Existing `trigger="manual"` consumers relying on real click-outside dismissal are unaffected unless they opt in. |
| `popupRole` | `String` | `"dialog"` | yes | The `aria-haspopup` value a `click` popover's anchor announces: `'dialog'` (default), `'menu'`, `'listbox'`, `'tree'` or `'grid'`. Set `'menu'` when the panel hosts a `role="menu"`, so a menu button keeps the click trigger and its focus return. Also passed to the `anchor` slot as `popupRole` (`null` for a tooltip) for your own trigger's `aria-haspopup`. |
| `idBase` | `String` | `''` | yes | Id base for the floating panel, whose id is `idBase + '-panel'` — also passed to the `anchor` slot as `panelId`, so your trigger can point `aria-controls` (click) or `aria-describedby` (tooltip) at it. Empty (the default): each instance generates a unique base after mount (`rozie-popover-<n>`), so open popovers never share a panel id. Set it when you need a stable, predictable id. On Lit the panel is in the shadow root, so a light-DOM id reference cannot reach it. |
| `reference` | `Element \| Object` | `null` | yes | Position the content against an external reference instead of the built-in anchor wrapper: a DOM Element another component owns (e.g. a calendar event element) or a Floating UI virtual element (an object with `getBoundingClientRect()` and an optional `contextElement`), e.g. to open at a pointer position. Measured and tracked with `autoUpdate` and reconciled at runtime; `null` keeps the built-in anchor. A click on a referenced Element is not an outside click; a virtual element adds no inside region. A referenced Element removed from the document while open closes the panel. You own the trigger ARIA on your own element. Pass a stable value. See [External and virtual reference elements](#external-and-virtual-reference-elements). |

### Events

`Popover` declares no events of its own. The `open` model's change event is the only change signal: it fires whenever the open state changes — a trigger gesture, an Escape / click-outside dismissal, or a programmatic `show`/`hide`/`toggle` — with the new `open` boolean.

| Target | Change event |
| --- | --- |
| Vue | `update:open` (`v-model:open`) |
| React / Solid | `onOpenChange` (with `open`) |
| Svelte | `bind:open` (no separate event) |
| Angular | `openChange` (`[(open)]`) |
| Lit | `open-change` (`CustomEvent<boolean>`, state in `event.detail`) |

Until 0.3.0 there was also a `change` event carrying the same boolean. It was removed because on Angular and Lit a native `change` event from any input inside the panel bubbles to the host under the same name. Listen to the model event instead.

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `show` | Open the floating content (no-op when `disabled`). Fires the `open` model's change event. |
| `hide` | Close the floating content. Fires the `open` model's change event. |
| `toggle` | Flip the open state (no-op when `disabled`). Fires the `open` model's change event. |
| `reposition` | Recompute the floating position immediately (`computePosition`). **Named `reposition`, not `update`**, because `update` is a reserved Lit `ReactiveElement` lifecycle method. |

## External and virtual reference elements

By default `Popover` positions its content against the built-in anchor wrapper, which holds whatever you project into the `anchor` slot. When the element the panel should point at is owned by **another** component (for example an event element rendered by a calendar library), pass it through the `reference` prop instead. You no longer need a `position: fixed` stand-in sized to the element's rect. Pair it with `trigger="manual"` and a two-way-bound `open`, because your own element drives the gesture:

```rozie
<data>
{
  open: false,
  target: null,
}
</data>

<script>
// e.g. from a calendar's eventClick callback: the element the library rendered.
// Toggle when it is the current reference; otherwise move there and (re)open.
const onEventClick = (info) => {
  if ($data.target === info.el && $data.open) {
    $data.open = false
    return
  }
  $data.target = info.el
  $data.open = true
}
</script>

<template>
  <Popover r-model:open="$data.open" trigger="manual" placement="bottom" :reference="$data.target">
    <div class="event-details">…</div>
  </Popover>
</template>
```

`reference` also accepts a Floating UI [virtual element](https://floating-ui.com/docs/virtual-elements): any object with a `getBoundingClientRect()` method, plus an optional `contextElement` for scroll and resize tracking. Use one to open the panel at a pointer position:

```rozie
<script>
const openAtPointer = (event) => {
  const x = event.clientX
  const y = event.clientY
  $data.target = {
    getBoundingClientRect: () => ({ x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 }),
  }
  $data.open = true
}
</script>
```

Behavior notes:

- The reference is measured and tracked with Floating UI's `autoUpdate`, and changing `reference` while open repositions the panel against the new one. Pass a **stable** value: a new object on every render restarts tracking.
- A click on (or inside) a referenced **Element** does not count as an outside click, so a toggle on that element closes the panel instead of dismissing and reopening it. A **virtual** element adds no inside region: only the anchor wrapper and the panel count as inside, and any other click dismisses. Escape dismisses in both cases.
- The outside-click dismissal is decided **after** your own click handlers have run, against the `reference` as it is then. So when clicking a second element while the panel is open, a handler that repoints `reference` there (keeping `open` true) moves the panel, as in the move-or-toggle example above; a click anywhere else still dismisses.
- If a referenced Element is removed from the document while open (for example a calendar re-rendering its event elements), the panel closes: there is nothing left to point at.
- The `anchor` slot may stay empty. The (zero-content) anchor wrapper still renders.
- `null` (the default) restores the built-in anchor. `Popover` behaves exactly as it did before the prop existed.

## Staying inside the viewport

By default the panel stays inside the viewport. It flips to the opposite side of the anchor when it would overflow, and a `left` / `right` placement that fits on neither side goes below the anchor, then above it, where `shift` brings it in horizontally. When nothing fits at all (a narrow *and* short viewport), `shift` slides the panel back over the anchor, so its controls stay reachable. `top` / `bottom` placements behave as they always did: a dropdown never jumps beside its trigger.

The panel is also never wider than the area it is positioned in. While it tracks the anchor, `Popover` measures the width available to the panel and sets it on the panel as `--rozie-popover-available-width`. The built-in `max-width` is the smaller of that and `--rozie-popover-max-width`, and the panel is `box-sizing: border-box`, so the cap includes its padding and border.

A `bare` popover has no chrome of its own, so its content can use the same measurement to cap itself:

```css
.event-card {
  max-width: var(--rozie-popover-available-width, 100vw);
}
```

- The property is set by `Popover`. It is not a theming token: do not set it yourself.
- `disableShift` turns the measurement off, and `disablePositioning` never measures; the stylesheet then caps the panel at the viewport width.

## Layout: the root has no box

The `.rozie-popover` root is `display: contents`, so Popover adds no box of its own to your layout: the anchor wrapper (`display: inline-block`) is what sits in the flow, and the panel floats. A `class` or `style` you pass to `Popover` reaches the root, which is enough for **inherited** properties (`color`, `font`, `--rozie-popover-*` tokens), but **box** properties such as `margin`, `width`, `flex`, `position` or `grid-area` have nothing to act on there. To place a popover in a flex row or grid, wrap it in your own element and style the wrapper:

```html
<div class="toolbar-end">  <!-- margin-left: auto, etc. -->
  <Popover …>…</Popover>
</div>
```

Popover keeps the root box-less on purpose: it lets a popover sit inside inline text, a table cell or a flex row without changing that layout, and the same root is used by components that compose Popover (Combobox, DataTable).

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

The floating element carries `role="tooltip"` when `trigger` is `hover`/`focus`. A `click` popover is **non-modal and role-neutral by default** — it advertises no `role` and no `aria-modal`, so the slot content owns its own ARIA role (e.g. a `role="menu"`); this keeps a dismissable, non-modal layer from falsely telling assistive tech that sibling content is inert. Opt into `modal` to make it a real modal dialog (`role="dialog"` + `aria-modal="true"`) — Popover ships **no focus trap** (it stays a minimal, headless primitive), so when you set `modal` you must supply your own focus containment for the claim to hold. For `trigger="click"` the anchor wrapper carries `aria-haspopup` (the `popupRole` prop, `"dialog"` by default; set `popupRole="menu"` for a menu button), `aria-expanded` (stringified, never dropped on `false`) and, while open, `aria-controls` pointing at the panel. Tooltips (`hover`/`focus`) claim no popup; while open the wrapper gets `aria-describedby` pointing at the panel. Under `trigger="manual"` the wrapper renders none of these, since a composing component driving `open` itself owns its own ARIA claim.

The wrapper itself is not focusable, so assistive tech reads the ARIA on the focusable element you project into the `anchor` slot. The slot passes `open`, `panelId` (the panel's id, `idBase + '-panel'`) and `popupRole` (the `aria-haspopup` value, `null` for a tooltip) so your trigger can carry the same claim: `:aria-haspopup="popupRole"`, `:aria-expanded="open"` and `:aria-controls="panelId"` for a click popover, or `:aria-describedby="open ? panelId : undefined"` for a tooltip. Each popover generates its own `idBase` after mount, so the ids stay unique without configuration; `panelId` reflects it. On Lit the panel lives in the element's shadow root, where a light-DOM id reference cannot reach it; there the wrapper's own attributes carry it. Escape dismisses while open.

Focus returns to where it was when the popover opened (the trigger) whenever the popover closes and focus would otherwise be lost: Escape or a click on a non-focusable spot while focus is inside the panel. It is never pulled back from an element the user moved to, such as another input they clicked into. Tooltips never move focus.

With `reference`, the element you position against is yours, and so is its ARIA. Use `trigger="manual"`, and put `aria-haspopup`, `aria-expanded` and `aria-controls` (pointing at `idBase + '-panel'`) on your own trigger element, kept in sync with the `open` state you bind.
