# API reference

The full `Resizable` surface: props, the two-way `size` model, the `resize` event, the imperative handle, and the three slots. For the per-framework consumption code see the [usage page](/components/resizable-usage); for the live widget see the [demo](/components/resizable-demo).

## Props

The full prop surface. `size` is the sole `model: true` prop — the first panel's percent of the container along the split axis — so the Angular output emits a `ControlValueAccessor` (the splitter position **is** a form control). `disabled` defaults `false` (negative opt-out).

```rozie-props Resizable
```

## Events

The single `resize` event fires on every committed size change — pointer drag, keyboard nudge, or a programmatic `applySize` / `reset` — so you can observe the split without two-way binding.

| Event | Description |
| --- | --- |
| `resize` | Fired on every committed size change (pointer drag, Arrow/Home/End keyboard nudge, or a programmatic `applySize` / `reset`). Payload `{ size }` — the new first-panel percent, already clamped to `[min, max]`. Funneled through one `commitSize` wrapper so the React prop-destructure hoists exactly once. |

## Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `applySize` | Set the split position programmatically to `percent` (the first-panel size); clamped to `[min, max]` and emits `resize`. **Deliberately named `applySize`, not `setSize`** — the model prop is `size`, so the React emitter auto-generates a `setSize` state setter; an `$expose` verb named `setSize` collapses onto it and trips ROZ524 (the deconfliction pass does not reach inside an `$expose`-verb closure). `apply<X>` is the listbox / data-table precedent. |
| `reset` | Recentre the split to the midpoint of `[min, max]` (emits `resize`). Collision-safe — not a host-element member. |

## Slots

| Slot | Params | Description |
| --- | --- | --- |
| `start` | — | The first panel — sized to `size` percent along the split axis (its width when horizontal, height when vertical). |
| `end` | — | The second panel — takes the remaining space. |
| `handle` | — | Optional. Replaces the default grip (a short centered bar) while keeping the drag and keyboard behavior on the wrapping `role="separator"` element. |

On React / Solid the slots are `render*` props (`renderStart` / `renderEnd` / `renderHandle`) — the documented cross-framework slot divergence. None of the slot names equals a prop key (ROZ127 — a slot/prop name collision is a hard error because Svelte 5 collapses snippets and props into one `$props()` bag).
