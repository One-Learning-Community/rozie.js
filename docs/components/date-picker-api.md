---
title: DatePicker — API reference
---

# DatePicker — API reference

The complete prop / event / slot / imperative-handle surface of `@rozie-ui/date-picker`,
generated from the single `DatePicker.rozie` source. The **Props** table below is a
build-time `rozie-props` fence — it is regenerated from the compiler IR on every docs
build, so it cannot drift from the shipped component. Each prop's prose lives in exactly
one place: the `<props>` `docs.description` in the source.

## Props

```rozie-props DatePicker
```

## Events

| Event | Payload | Description |
| --- | --- | --- |
| `change` | `{ value }` | Fired whenever the selected value changes — selecting a day, dropping a range anchor, or a programmatic `clear()`. In single mode `value` is the new ISO `YYYY-MM-DD` string (or `""`); in range mode it is the current `{ start, end }` object (the anchor-only `{ start, end: "" }` write fires `change` too). Not fired when the picked value equals the current selection. |
| `rangeComplete` | `{ value }` | **Range mode only.** Fires once when the second endpoint lands or a preset is applied — i.e. when a full range is committed. `value` is the ordered `{ start, end }` object (min/max already applied, so `start <= end` regardless of click direction). Does **not** fire on the anchor-only first click. |

The two-way model also fires the framework-native update event (`onValueChange` / `update:value` / `bind:value` / `(valueChange)` / `value-change`) carrying the new value (ISO string in single mode, `{ start, end }` object in range mode) directly.

### Per-target `rangeComplete` consumer-prop casing

`rangeComplete` is a camelCase event, and each framework derives the consumer-facing prop name its own way. Bind the **exact** name for your target — the **Svelte one is lowercase**, and a PascalCase binding there silently never fires:

| Target | Consumer binding |
| --- | --- |
| React / Solid | `onRangeComplete={...}` |
| Vue | `@rangeComplete="..."` (`emit('rangeComplete')`) |
| Angular | `(rangeComplete)="..."` output |
| Lit | `addEventListener('rangeComplete', ...)` — `CustomEvent("rangeComplete")`, case-preserved |
| **Svelte** | **`onrangecomplete={...}`** — ⚠ LOWERCASE (NOT `onRangeComplete`) |

## Slots

The header slot is optional — omit it to get the default token-themed prev / month-year / next row.

| Slot | Scope params | Description |
| --- | --- | --- |
| `header` | `{ label, prev, next, disabled }` | Replace the default month-nav header. `label` is the localized "Month YYYY" heading, `prev`/`next` step the displayed month, `disabled` mirrors the `disabled` prop. |
| `presets` | `{ presets, apply }` | **Range mode only.** Replace the default quick-pick preset rail. `presets` is the resolved `presetRanges` array (`{ label, range }[]`), and `apply(range)` commits a preset's range (firing `change` + `rangeComplete`). Omit the slot to get the default token-themed rail. |

> On React the scoped slots are render-prop callbacks (the `header` and `presets` render-props) — the one documented cross-framework slot divergence.

## Caveats

The polymorphic object `value` (range mode) and the function-form `presetRanges` entries are non-string values, so they must be delivered as **properties**, never string attributes. On Vue, React, Svelte, Angular, and Solid this happens automatically through the framework's binding syntax. On **Lit** you must use a property binding — `.value=${obj}` / `r-model` and `.presetRanges=${[...]}` — never `value="..."` (a string attribute would stringify the object to `'[object Object]'` and never reach the component). This is the **identical rule already in force for `disabledDates`** (an array prop), not a new constraint class.

## Imperative handle

Grab a handle via the framework-native ref mechanism (`useRef` → `DatePickerHandle`, Vue/Svelte/Angular template refs, Solid ref callback, or the Lit custom element itself):

| Method | Description |
| --- | --- |
| `focus()` | Move keyboard focus into the grid — onto the selected day, else today, else the first visible day. |
| `goToToday()` | Swing the displayed month to today (no selection change). |
| `clear()` | Deselect the date (`value` → `""`), emitting `change`. |

## Theming

Every visual value is a `--rozie-datepicker-*` CSS custom property. Import a ready-made
design-system bridge or set the tokens yourself at any ancestor scope:

```ts
import '@rozie-ui/date-picker-react/themes/shadcn.css';   // or material.css, bootstrap.css, base.css
```
