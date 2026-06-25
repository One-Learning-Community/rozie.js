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
| `change` | `{ value }` | Fired whenever the selected date changes — selecting a day, or a programmatic `clear()`. `value` is the new selected ISO `YYYY-MM-DD` string, or `""` when cleared. Not fired when the picked date equals the current selection. |

The two-way model also fires the framework-native update event (`onValueChange` / `update:value` / `bind:value` / `(valueChange)` / `value-change`) carrying the new ISO string directly.

## Slots

The header slot is optional — omit it to get the default token-themed prev / month-year / next row.

| Slot | Scope params | Description |
| --- | --- | --- |
| `header` | `{ label, prev, next, disabled }` | Replace the default month-nav header. `label` is the localized "Month YYYY" heading, `prev`/`next` step the displayed month, `disabled` mirrors the `disabled` prop. |

> On React the scoped slot is a render-prop callback (a `header` render-prop) — the one documented cross-framework slot divergence.

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
