<script setup>
import FlatpickrDemo from '../../examples/demos/FlatpickrDemo.rozie';
</script>

# Flatpickr (date picker)

A data-bound port of [flatpickr](https://flatpickr.js.org/), the vanilla-JS date picker. flatpickr does its real work in plain JavaScript — it owns an `<input>` and a popover calendar the host framework never renders. That is exactly the kind of library that today ships a separate hand-maintained wrapper for every framework: `react-flatpickr`, `vue-flatpickr-component`, `ngx-flatpickr-wrapper`, `svelte-flatpickr`, plus Solid and Lit forks. `Flatpickr.rozie` is one source that compiles to all six.

The wrapper is a compact tour of the engine-binding pattern:

- **`model: true` two-way bind on a *scalar*** — the picked date is exposed as a string; consumers write `r-model:date="…"` and read it back without wiring an `onChange` handler.
- **`$onMount` with a teardown return** — `flatpickr(...)` is constructed on mount and `instance.destroy()` is returned as cleanup.
- **`$watch`-based reconciliation** — changing `mode`, `minDate`, `maxDate`, `dateFormat`, or `disabled` is pushed into the *live* instance via flatpickr's `set()` API rather than re-creating it. A guard in the `date` watcher skips the onChange → write → watch → setDate round-trip.
- **`$emit`** for `change` / `open` / `close`, and **`$refs`** to hand flatpickr the bare input element.

## Live demo

`FlatpickrDemo.rozie` is the companion consumer — itself a `.rozie` file, so the demo is its own six-way "wire flatpickr into your app" proof. Click the field to open the calendar; the bound state on the right updates live. Switch the mode buttons (Single / Range / Multiple) to watch `$watch` reshape the *live* picker — no remount.

<div class="rozie-demo">
  <ClientOnly>
    <FlatpickrDemo />
  </ClientOnly>
</div>

## Source — Flatpickr.rozie

```rozie-src Flatpickr
```

## Compiled output

::: code-group

```rozie-out Flatpickr vue
```

```rozie-out Flatpickr react
```

```rozie-out Flatpickr svelte
```

```rozie-out Flatpickr angular
```

```rozie-out Flatpickr solid
```

```rozie-out Flatpickr lit
```

:::

## Demo source — FlatpickrDemo.rozie

```rozie-src FlatpickrDemo
```
