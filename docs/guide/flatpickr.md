# Flatpickr — the cross-framework date picker

`Flatpickr` is Rozie's data-bound port of [flatpickr](https://flatpickr.js.org/) — the dependency-free vanilla-JS date/time picker. One `.rozie` source file ships idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers, replacing the five hand-maintained per-framework wrappers that exist today — [react-flatpickr](https://github.com/haoxins/react-flatpickr), [vue-flatpickr-component](https://github.com/ankurk91/vue-flatpickr-component), [angularx-flatpickr](https://github.com/mattlewis92/angularx-flatpickr), [svelte-flatpickr](https://github.com/jacobmischka/svelte-flatpickr), [lit-flatpickr](https://github.com/Matsuuu/lit-flatpickr) — plus the Solid wrapper that **does not exist upstream at all**.

This page is the **show-and-tell**: the API surface, per-framework quick starts, and the recipes (forms drop-in, range commit, inline calendars, theming) that cover the long tail of what you'd want from a date picker.

The full source for `Flatpickr.rozie` plus the per-target compiled output lives on the [example page](/examples/flatpickr).

## The `@rozie-ui/flatpickr` packages

`Flatpickr` ships as six pre-compiled, per-framework packages generated from a single `Flatpickr.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step, no `@rozie/*` runtime dependency:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/flatpickr-react` | `npm i @rozie-ui/flatpickr-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/flatpickr/packages/react/README.md) |
| `@rozie-ui/flatpickr-vue` | `npm i @rozie-ui/flatpickr-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/flatpickr/packages/vue/README.md) |
| `@rozie-ui/flatpickr-svelte` | `npm i @rozie-ui/flatpickr-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/flatpickr/packages/svelte/README.md) |
| `@rozie-ui/flatpickr-angular` | `npm i @rozie-ui/flatpickr-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/flatpickr/packages/angular/README.md) |
| `@rozie-ui/flatpickr-solid` | `npm i @rozie-ui/flatpickr-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/flatpickr/packages/solid/README.md) |
| `@rozie-ui/flatpickr-lit` | `npm i @rozie-ui/flatpickr-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/flatpickr/packages/lit/README.md) |

Each package carries `flatpickr ^4.6` plus its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common`, `solid-js`, or `lit`). Import flatpickr's stylesheet once in your app: `import 'flatpickr/dist/flatpickr.css'`. The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `Flatpickr.rozie`, so they cannot drift from the compiled output — the package's `codegen.mjs` asserts the structural columns of this page against `ir.props` on every run.

## Quick start

The two-way value is `date` — the formatted **string** (not a `Date`). The `change` event additionally surfaces `selectedDates: Date[]` for consumers that need the parsed objects.

### React

```tsx
import { useState } from 'react';
import { Flatpickr } from '@rozie-ui/flatpickr-react';
import 'flatpickr/dist/flatpickr.css';

export function Demo() {
  const [date, setDate] = useState('2026-05-17');
  return (
    <Flatpickr
      date={date}
      onDateChange={setDate}
      onChange={(e) => console.log(e.value, e.selectedDates)}
    />
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Flatpickr from '@rozie-ui/flatpickr-vue';
import 'flatpickr/dist/flatpickr.css';

const date = ref('2026-05-17');
</script>

<template>
  <Flatpickr v-model:date="date" @change="(e) => console.log(e.value, e.selectedDates)" />
</template>
```

### Svelte

```svelte
<script lang="ts">
  import Flatpickr from '@rozie-ui/flatpickr-svelte';
  import 'flatpickr/dist/flatpickr.css';

  let date = $state('2026-05-17');
</script>

<Flatpickr bind:date onchange={(e) => console.log(e.value, e.selectedDates)} />
```

### Angular

```ts
import { Component } from '@angular/core';
import { Flatpickr } from '@rozie-ui/flatpickr-angular';
import 'flatpickr/dist/flatpickr.css';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Flatpickr],
  template: `<Flatpickr [(date)]="date" (change)="onChange($event)" />`,
})
export class DemoComponent {
  date = '2026-05-17';
  onChange(e: { value: string; selectedDates: Date[] }) {
    console.log(e.value, e.selectedDates);
  }
}
```

### Solid

```tsx
import { createSignal } from 'solid-js';
import { Flatpickr } from '@rozie-ui/flatpickr-solid';
import 'flatpickr/dist/flatpickr.css';

export function Demo() {
  const [date, setDate] = createSignal('2026-05-17');
  return (
    <Flatpickr
      date={date()}
      onDateChange={setDate}
      onChange={(e) => console.log(e.value, e.selectedDates)}
    />
  );
}
```

### Lit

```ts
import '@rozie-ui/flatpickr-lit';
import 'flatpickr/dist/flatpickr.css';

// <rozie-flatpickr> is a custom element. Bind `date` as a property and listen
// for the `date-change` event to receive the formatted string.
const el = document.querySelector('rozie-flatpickr');
el.date = '2026-05-17';
el.addEventListener('date-change', (e) => { el.date = e.detail; });
el.addEventListener('change', (e) => {
  console.log(e.detail.value, e.detail.selectedDates);
});
```

## API

### Props

| Name | Type | Default | Two-way (model) | Description |
| --- | --- | --- | :---: | --- |
| `date` | `String` | `""` | ✓ | The two-way value — the **formatted string** flatpickr produces. Reorders write back through the two-way path. |
| `mode` | `String` | `"single"` | | `'single'`, `'multiple'`, `'range'`, or `'time'`. Runtime-updatable via `set()`. |
| `dateFormat` | `String` | `"Y-m-d"` | | flatpickr [date format token](https://flatpickr.js.org/formatting/). Runtime-updatable. |
| `altInput` | `Boolean` | `false` | | Show a human-readable alt input while submitting the machine format. **Construction-time** — see [Remount on construction-time-only changes](#remount-on-construction-time-only-changes). |
| `altFormat` | `String` | `"F j, Y"` | | Format string for the alt input. |
| `enableTime` | `Boolean` | `false` | | Add a time picker. **Construction-time**. |
| `enableSeconds` | `Boolean` | `false` | | Add a seconds input to the time picker. |
| `time24hr` | `Boolean` | `false` | | 24-hour time display. |
| `noCalendar` | `Boolean` | `false` | | Time-only picker (hide the calendar). **Construction-time**. |
| `minDate` | `String` | `null` | | Earliest selectable date. Runtime-updatable. |
| `maxDate` | `String` | `null` | | Latest selectable date. Runtime-updatable. |
| `placeholder` | `String` | `"Select a date…"` | | Input placeholder text. |
| `disabled` | `Boolean` | `false` | | Disable the underlying input. Runtime-updatable. |
| `commitOn` | `String` | `"complete"` | | When to commit the two-way `date` in range mode: `'complete'` (only when both ends are picked, the default) or `'change'` (every click). See [Range mode and commit semantics](#range-mode-and-commit-semantics). |
| `options` | `Object` | `{}` | | Verbatim flatpickr options pass-through for anything not covered by the named props. The named props win on conflict, but `options` lands AFTER them so consumers can override. |
| `name` | `String` | `""` | | HTML form-control `name` forwarded onto the rendered input — the forms drop-in. See [Forms drop-in](#forms-drop-in). |
| `inline` | `Boolean` | `false` | | Render an always-visible calendar instead of a popup. **Construction-time**. |
| `staticPosition` | `Boolean` | `false` | | flatpickr's `static` option (positions the calendar relative to the input rather than `position: absolute` off `<body>`). Exposed as `staticPosition` because `static` is a JS reserved word. **Construction-time**. |
| `position` | `String` | `"auto"` | | Calendar position: `'auto'`, `'above'`, `'below'`, or per-axis forms like `'above center'`. **Construction-time**. |
| `appendTo` | `Object` | `null` | | A DOM element to append the calendar to (escape `overflow: hidden` ancestors). **Construction-time**. |
| `showMonths` | `Number` | `1` | | Number of calendar months to render side by side. **Construction-time**. |
| `weekNumbers` | `Boolean` | `false` | | Show ISO week numbers down the left edge. **Construction-time**. |
| `monthSelectorType` | `String` | `"dropdown"` | | `'dropdown'` or `'static'` month selector. **Construction-time**. |
| `prevArrow` | `String` | `null` | | HTML string for the previous-month arrow (overrides flatpickr's built-in SVG). **Construction-time**. |
| `nextArrow` | `String` | `null` | | HTML string for the next-month arrow. **Construction-time**. |
| `allowInput` | `Boolean` | `false` | | Allow the user to type a date directly into the input. **Construction-time**. |

### Emits

| Event | Description |
| --- | --- |
| `change` | The selection committed. Payload: `{ value: string; selectedDates: Date[] }`. |
| `ready` | The picker finished initializing. Payload: `{ value: string; selectedDates: Date[] }`. |
| `open` | The calendar opened. |
| `close` | The calendar closed. |
| `monthChange` | The displayed month changed. |
| `yearChange` | The displayed year changed. |
| `valueUpdate` | flatpickr's `onValueUpdate` — the value changed by any means. Payload: `{ value: string; selectedDates: Date[] }`. |
| `dayCreate` | flatpickr created a day cell (per-day customization hook). Payload: the day element. |

### Imperative handle

Beyond props/events, the component exposes imperative methods declared once in the Rozie source via `$expose`. Grab a handle with your framework's native ref mechanism (React `useRef` / Vue template ref / Svelte `bind:this` / Angular `viewChild` / Solid callback ref / the Lit custom element itself) and call them directly:

| Method | Description |
| --- | --- |
| `clear` | Clear the selection (empties the input). |
| `openPicker` | Open the calendar. Named `openPicker` (not `open`) to dodge a collision with the `open` event — see [Gotchas](#gotchas). |
| `closePicker` | Close the calendar. Named `closePicker` (not `close`) for the same reason. |
| `selectDate` | Programmatically set the selection. Named `selectDate` (not `setDate`) to dodge React's auto-generated model setter — see [Gotchas](#gotchas). |
| `jumpToDate` | Jump the calendar view to a date without selecting it. |

## Recipes

### Forms drop-in

The `name` prop forwards an HTML form-control `name` onto the rendered input, so `Flatpickr` submits like a native control with no `ControlValueAccessor` or controller shim.

**react-hook-form** — `register('field')` returns `{ name, onChange, onBlur, ref }`; the `name` is the load-bearing field for the submitted value:

```tsx
const { register } = useForm<{ birthday: string }>();
const field = register('birthday');
<Flatpickr name={field.name} date={date} onDateChange={setDate} />;
```

(`register`'s `onChange`/`onBlur`/`ref` collide with this component's own `onChange` emit-prop, so prefer wiring the value through `date`/`onDateChange` and forwarding only `name`.)

**Angular reactive forms** — bind `[name]` (or drive it from a `formControlName`) without a custom CVA:

```ts
// the name input is a typed signal: name = input<string>('')
<Flatpickr [(date)]="date" [name]="'birthday'" />
```

When `altInput` is on, flatpickr creates a hidden mirror input and **moves** the `name` onto it automatically, so the submitted value carries `name` whether `altInput` is on or off.

### Range mode and commit semantics

In `mode="range"`, flatpickr fires `onChange` on the **first** click (a partial range). Committing the two-way `date` then is the bug every existing wrapper ships. `Flatpickr` commits the string only when the range is **complete** (two dates) — unless you opt into `commitOn="change"`:

```vue
<Flatpickr v-model:date="picked" mode="range" />            <!-- commits on complete (default) -->
<Flatpickr v-model:date="picked" mode="range" commitOn="change" />  <!-- commits every click -->
```

Either way the `change` event fires every time with both `value` and `selectedDates`, so you can observe partial ranges off the event without polluting the two-way value.

### Inline calendar

`inline` renders an always-visible calendar with no popup — useful for dashboards and embedded date pickers:

```vue
<Flatpickr v-model:date="picked" :inline="true" />
```

`inline` is a **construction-time-only** option (flatpickr reads it once at construction). To toggle it live, re-key the component — see [Remount on construction-time-only changes](#remount-on-construction-time-only-changes).

### Theming

flatpickr ships its base stylesheet plus a set of themes. Import the base once, and optionally a theme variant:

```ts
import 'flatpickr/dist/flatpickr.css';        // required base
import 'flatpickr/dist/themes/dark.css';      // optional theme
// other themes: material_blue, material_green, material_red, material_orange,
// airbnb, confetti
```

You can also override flatpickr's CSS custom properties / class rules in your own global stylesheet — the calendar popup is plain DOM, so global theme CSS reaches it on five of six targets.

**Lit shadow-DOM caveat:** flatpickr's calendar popup renders in the **light DOM** (it appends to `<body>` or `appendTo`), so global theme CSS reaches it even on Lit. The `<input>` itself, however, lives inside the Lit element's **shadow DOM** — style it with `::part()` or by importing the theme CSS into the element's shadow root, not via a global input selector.

## Remount on construction-time-only changes

flatpickr reads the following options **once at construction** and exposes no `set()` path for them. To make them runtime-tunable from the consumer side, re-key the component on a string built from the values so the framework reconciler rebuilds the engine instance:

- `altInput`, `enableTime`, `noCalendar`
- `inline`, `staticPosition`, `position`, `appendTo`, `showMonths`, `weekNumbers`, `monthSelectorType`, `prevArrow`, `nextArrow`
- `allowInput`

```vue
<Flatpickr
  :key="`${inline}-${showMonths}-${weekNumbers}`"
  v-model:date="picked"
  :inline="inline"
  :showMonths="showMonths"
  :weekNumbers="weekNumbers"
/>
```

When any of those values change, the reconciler unmounts the old `<Flatpickr>` and mounts a fresh one. The bound `date` survives the remount (it's bound to the parent's state), so only the engine instance is rebuilt. `mode`, `minDate`, `maxDate`, `dateFormat`, and `disabled` are runtime-updatable via flatpickr's `set()` path and need no re-key.

## Gotchas

### Round-trip-guarded reconcile

The #1 cross-framework bug class (React "input can't be controlled", Vue "infinite update loop") is fixed uniformly: the `date` watcher writes back to flatpickr only when the new value actually differs from the live input value, so a user pick → `$model.date` write → watcher does **not** re-fire `onChange`.

### `selectDate`, not `setDate`

The handle method is `selectDate`, not flatpickr's own `setDate`. The `date` prop is `model: true`, so the React emitter auto-generates a `setDate` setter for it; a user method named `setDate` collides (ROZ524). `selectDate` wraps `instance.setDate`.

### `openPicker` / `closePicker`, not `open` / `close`

The handle methods are `openPicker` / `closePicker`, not `open` / `close`. This component emits `open` and `close` **events**; on targets that materialize events as named members (Angular `output()`), a method named `open`/`close` would collide with the event member (a ROZ121 follow-up class). Prefixing sidesteps it.

### React class-hashing and selector-style options

React's CSS-Modules pipeline hashes class names in your `<style>` block, so any flatpickr option that takes a class **selector** string won't match the rendered hashed class. Use [`$classSelector`](/guide/features#classselector-—-handing-a-class-name-to-a-vanilla-js-engine) when authoring such a selector, or prefer a `data-*` attribute selector that survives hashing.

## Cross-references

- [Flatpickr example & per-target output](/examples/flatpickr) — the live source plus compiled React/Vue/Svelte/Angular/Solid/Lit output side by side.
- [`Flatpickr.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/flatpickr/src/Flatpickr.rozie) — the canonical wrapper.
- [`$classSelector()` — class-name-as-selector for vanilla-JS engines](/guide/features#classselector-—-handing-a-class-name-to-a-vanilla-js-engine)
- [`$expose` and the imperative handle](/guide/features#expose-→-a-consumer-callable-imperative-handle-everywhere)
- [`r-model` — two-way binding everywhere](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere)
