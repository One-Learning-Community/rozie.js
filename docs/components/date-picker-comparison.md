---
title: DatePicker — comparison
---

# DatePicker vs the per-framework date libraries

Date pickers are one of the most-reimplemented widgets in every ecosystem — and each framework has its own incompatible set. `@rozie-ui/date-picker` is **one accessible headless calendar**, authored once and compiled to all six frameworks, so a design system ships a single date-picker behavior everywhere instead of binding (or rebuilding) a different library per framework.

## What it replaces

| Framework | Common choices today | `@rozie-ui/date-picker` |
| --- | --- | --- |
| React | `react-day-picker`, `react-datepicker`, Radix/Headless wrappers | `@rozie-ui/date-picker-react` |
| Vue | `@vuepic/vue-datepicker`, `v-calendar` | `@rozie-ui/date-picker-vue` |
| Svelte | `svelte-calendar`, bespoke | `@rozie-ui/date-picker-svelte` |
| Angular | `@angular/material` datepicker, `ngx-bootstrap` | `@rozie-ui/date-picker-angular` |
| Solid | bespoke / Kobalte | `@rozie-ui/date-picker-solid` |
| Lit | bespoke / Shoelace | `@rozie-ui/date-picker-lit` |

The point is not that any one of these is bad — it is that a cross-framework design system has to learn, bind, and maintain a *different* one per target. Rozie collapses that to a single source.

## Where it fits

| | `@rozie-ui/date-picker` | Heavyweight per-framework pickers | Hand-rolled `<input type="date">` |
| --- | --- | --- | --- |
| Cross-framework parity | ✅ one source → 6 idiomatic packages | ❌ a different library per framework | ➖ native, but inconsistent UI per browser |
| Headless / restyleable | ✅ token-themed + `#header` slot | ➖ varies; often opinionated CSS | ❌ browser-controlled UI |
| `min` / `max` / disabled dates | ✅ built in | ✅ usually | ➖ `min`/`max` only |
| Roving-grid keyboard a11y | ✅ WAI-ARIA grid pattern | ✅ usually | ➖ browser-dependent |
| Localized labels | ✅ `Intl.DateTimeFormat` | ✅ usually (often via a date lib) | ✅ native |
| Form binding | ✅ Angular `ControlValueAccessor` + two-way model on all six | ➖ varies | ✅ native form control |
| Bundle weight | ✅ no engine, no date library | ❌ often pulls a date library | ✅ zero |
| Date math dependency | ✅ none (UTC-safe internal helper) | ➖ frequently `date-fns` / `dayjs` / `luxon` | ✅ none |

## What it deliberately is **not**

- **Not a date-time / range / multi-date picker.** v1 is a single calendar date (`YYYY-MM-DD`). Time-of-day, ranges, and multi-select are out of scope.
- **Not a popover/input combo.** It is the **calendar surface** — compose it inside your own field + popover (e.g. `@rozie-ui/popover`) when you want a dropdown date field. Keeping it headless is what lets it drop into any field pattern.
- **Not a date library.** It carries a tiny UTC-safe internal grid helper, not a general date toolkit — bring `date-fns` / `dayjs` / `Temporal` for arithmetic elsewhere in your app.

See the [showcase](/components/date-picker), the [API reference](/components/date-picker-api), and the [live demo](/components/date-picker-demo).
