# @rozie-ui/resizable-lit

Idiomatic **lit** `Resizable` — a headless, accessible two-panel splitter / resizable pane (pointer-drag + pointer capture, `role="separator"` keyboard control with Arrow / Home / End, a `[min, max]` clamp, a two-way `size` percent, and `start` / `end` / `handle` slots) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The interaction engine IS the browser's native Pointer Events plus the keyboard; every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/resizable-lit
```

Peer dependencies: `lit + @lit-labs/preact-signals + @preact/signals-core`. Install them alongside this package.

## Usage

```ts
import '@rozie-ui/resizable-lit';

// <rozie-resizable> is a custom element. Bind `size`/`min`/`max`/`direction`
// as properties; project the two panels into the `start` / `end` slots; listen
// for `resize` to receive the new first-panel percent (and `size-change` for the
// two-way value).
//   <rozie-resizable size="30" min="20" max="80" direction="horizontal">
//     <nav slot="start">Sidebar</nav>
//     <main slot="end">Content</main>
//   </rozie-resizable>
const el = document.querySelector('rozie-resizable');
el.addEventListener('size-change', (e) => {
  el.size = e.detail;
});
el.addEventListener('resize', (e) => {
  console.log('split:', e.detail.size);
});
```

## Theming

Every visual value is a `--rozie-resizable-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/resizable-lit/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `size` | `Number` | `50` | ✓ |  | The first (`start`) panel's size as a percent of the container along the split axis (its width when `direction="horizontal"`, its height when `"vertical"`). Two-way via `r-model:size`. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so the splitter position **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Every commit (drag, keyboard, or a programmatic `applySize`) is clamped to `[min, max]` and written back. |
| `direction` | `String` | `"horizontal"` |  |  | The split axis. `'horizontal'` (default) lays the two panels out side-by-side with a vertical drag handle between them (`size` is the first panel's **width**); `'vertical'` stacks them with a horizontal handle (`size` is the first panel's **height**). Also sets the handle's `aria-orientation`. |
| `min` | `Number` | `10` |  |  | The minimum `size` percent — the first panel can never be dragged or nudged below this. Clamps every commit. |
| `max` | `Number` | `90` |  |  | The maximum `size` percent — the first panel can never be dragged or nudged beyond this (so the second panel keeps at least `100 - max` percent). Clamps every commit. |
| `disabled` | `Boolean` | `false` |  |  | Disable resizing — the handle becomes non-interactive (pointer drag and keyboard are ignored) and the panels lock at the current `size`. Also sets the Angular `ControlValueAccessor` disabled state. |

## Events

| Event | Description |
| --- | --- |
| `resize` | Fired on every committed size change (pointer drag, Arrow/Home/End keyboard nudge, or a programmatic `applySize` / `reset`). Payload `{ size }` — the new first-panel percent, already clamped to `[min, max]`. Funneled through one `commitSize` wrapper so the React prop-destructure hoists exactly once. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `applySize` | Set the split position programmatically to `percent` (the first-panel size); clamped to `[min, max]` and emits `resize`. Named `applySize` rather than `setSize` to avoid the React state-setter generated for the `size` model prop (ROZ524). |
| `reset` | Recentre the split to the midpoint of `[min, max]` (emits `resize`). |

```ts
// The custom element IS the handle — exposed methods are public element
// methods.
const el = document.querySelector('rozie-resizable');
el.applySize(40);
el.reset();
```

## Slots

| Slot | Params |
| --- | --- |
| start |  |
| handle |  |
| end |  |

Project the two panes into the `start` and `end` slots; the optional `handle` slot replaces the default grip while keeping the drag/keyboard behavior. On React/Solid the slots are `render*` props (`renderStart` / `renderEnd` / `renderHandle`) — the documented cross-framework slot divergence.
