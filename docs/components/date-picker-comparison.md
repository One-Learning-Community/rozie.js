---
title: DatePicker — comparison
---

# DatePicker vs the per-framework date pickers

Date pickers are one of the most-reimplemented widgets in front-end — and almost
every option a design-system author can reach for is **single-framework**. The
accessible, headless ones (React Aria, Melt/Bits UI) are *locked to one
framework*; the styled, feature-deep ones (MUI X, @vuepic/vue-datepicker,
flatpickr) are likewise React-only, Vue-only, or a vanilla engine you re-wrap
per target. So a team shipping a design system across React + Vue + Svelte +
Angular (+ Solid + Lit) adopts and maintains a **different** date picker per
framework — with divergent APIs, divergent theming, and **wildly divergent
accessibility quality**.

[`@rozie-ui/date-picker`](/components/date-picker) takes the other path: one
`.rozie` source → six idiomatic, accessible packages with **one** API
(`value` model, `min`/`max`/`disabledDates`, roving-grid keyboard nav, a
`#header` slot, a `focus`/`goToToday`/`clear` handle). It does **less** than the
feature-deep incumbents on purpose — single calendar date, headless,
token-themed — and that scope is stated plainly below, not hidden.

> Research snapshot: **2026-06-24**. Versions, publish dates, and weekly-download
> figures were verified live against the npm registry (`registry.npmjs.org`) and
> the npm downloads API. The date-picker landscape moves; re-check before relying
> on a specific number. Download counts are a single-week sample and bounce week
> to week — treat them as rough order-of-magnitude, not a quality verdict.

## The landscape at a glance

Cell legend: **✓** = yes / documented · **✗** = no / not present · **~** =
partial / stale / lightly-documented.

| Library | Framework(s) | Headless? | WAI-ARIA a11y | Maintained (latest / date) | Range / time | Notes |
| --- | --- | :---: | :---: | --- | :---: | --- |
| **[`@rozie-ui/date-picker`](/components/date-picker)** | **React + Vue + Svelte + Angular + Solid + Lit** | ✓ token-themed | ✓ ARIA grid + roving keyboard | this repo (2026-06) | ✗ single-date only | One source → six idiomatic packages, one API. |
| [react-datepicker](https://github.com/Hacker0x01/react-datepicker) | React | ✗ styled | ~ keyboard, partial ARIA | 9.1.0 / 2025-12 | ✓ / ✓ | ~4.7M wk. The popular default; opinionated CSS. |
| [react-day-picker](https://daypicker.dev) | React | ~ restyleable | ✓ follows APG | 10.0.1 / 2026-05 | range ✓ / time ✗ | Strong a11y; non-Gregorian calendars. Powers shadcn/ui's calendar. |
| [@mui/x-date-pickers](https://mui.com/x/react-date-pickers/) | React | ✗ Material | ✓ documented WCAG/ARIA | 9.6.0 / 2026-06 | time ✓ / **range Pro-only** | Date/time/datetime free; **range pickers are commercial**. |
| [react-aria](https://react-spectrum.adobe.com/react-aria/useDatePicker.html) (`useDatePicker`/`useCalendar`) | React | ✓ hooks | ✓ best-in-class | 1.19.0 / 2026-06 | ✓ / ✓ | Adobe; the accessibility gold standard. React-only. |
| [Ariakit](https://ariakit.com/components) | React | ✓ | n/a | 0.4.30 / 2026-06 | — | **No date/calendar primitive at all** — build it from Popover yourself. |
| [@vuepic/vue-datepicker](https://vue3datepicker.com) | Vue 3 | ✗ styled | ✓ documented | 14.0.0 / 2026-06 | ✓ / ✓ | Deepest Vue option: range, time, month/year/week, multi-cal. |
| [v-calendar](https://vcalendar.io) | Vue (3.x via `@next`) | ✗ styled | ~ weak | 3.1.2 / 2023-10 | range ✓ / time ✗ | Vue-3 build **~2.5 yrs stale**; a11y long-flagged. |
| [vue-datepicker-next](https://github.com/mengxiong10/vue-datepicker-next) | Vue 3 | ✗ styled | ✗ undocumented | 1.0.3 / 2023-03 | ✓ / ✓ | Unmaintained (>3 yrs). |
| [bits-ui](https://bits-ui.com/docs/components/date-picker) | Svelte 5 | ✓ headless | ✓ (on `@internationalized/date`) | 2.18.1 / 2026-05 | ✓ / ✓ | The live, maintained Svelte choice; wraps Melt internally. |
| [@melt-ui/svelte](https://www.melt-ui.com/docs/builders/calendar) | Svelte 3/4/5 | ✓ builders | ✓ strongest Svelte a11y docs | 0.86.6 / 2025-03 | ✓ / ✓ | Builder API; momentum shifted to bits-ui. |
| [date-picker-svelte](https://date-picker-svelte.kasper.space) | Svelte 3/4/5 | ✗ styled | ~ undocumented | 2.17.0 / 2025-11 | time ✓ / range ✗ | Small, single-date + time. |
| [svelty-picker](https://github.com/mskocik/svelty-picker) | Svelte 5 | ~ themable | ~ keyboard claimed | 6.1.6 / 2025-09 | range ✓ / time ✓ | Niche (~5k wk), Bootstrap-flavored. |
| [@angular/material](https://material.angular.dev/components/datepicker) (MatDatepicker) | Angular | ✗ Material | ✓ documented | 22.0.2 / 2026-06 | range ✓ / sep. timepicker | First-party; tracks the Angular release train. |
| [PrimeNG](https://primeng.org/datepicker) DatePicker | Angular | ✗ themed | ✓ documented | 21.1.9 / 2026-06 | ✓ / ✓ | Deepest Angular feature set (range/time/month/year). |
| [ng-bootstrap](https://ng-bootstrap.github.io) (NgbDatepicker) | Angular | ✗ Bootstrap | ~ gaps reported | 21.0.0 / 2026-06 | range ✓ / time ✗ | Needs Bootstrap CSS; documented screen-reader gaps. |
| [flatpickr](https://flatpickr.js.org) | vanilla (re-wrapped) | ✗ styled | ✗ known weak spot | 4.6.13 / **2022-04** | ✓ / ✓ | Huge usage (~1.7M wk) but **~4 yrs stale**; a11y a known pain point. |
| [air-datepicker](https://air-datepicker.com) | vanilla | ✗ styled | ~ thin | 3.6.0 / 2025-05 | ✓ / ✓ | Dependency-free; ARIA not comprehensively documented. |
| [duet-date-picker](https://github.com/duetds/date-picker) | web component | ✗ themable | ✓ a11y was its pitch | 1.4.0 / 2021-06 | ✗ single-date | **Repo archived read-only 2024-09** — not maintained. |
| [Cally](https://wicky.nillia.ms/cally/) | framework-agnostic WC | ~ CSS parts | ✓ a11y a core goal | 0.9.2 / 2026-02 | range ✓ / time ✗ | The modern up-and-comer; pre-1.0, framework-independent. |

These libraries are **good** — on its home framework, most are the obvious pick,
and Rozie does not claim to out-feature MUI X on React or @vuepic on Vue. The
wedge is **coverage and consistency**, addressed next.

## The cross-framework parity argument

Line the landscape up by framework and the gap is structural, not cosmetic:

- **React** has the richest set — but the accessible *headless* one
  ([react-aria](https://react-spectrum.adobe.com/react-aria/useDatePicker.html))
  is React-only, and even the popular default
  ([react-datepicker](https://github.com/Hacker0x01/react-datepicker)) ships
  opinionated CSS. [Ariakit](https://ariakit.com/components) — a headless
  accessible toolkit you might assume covers this — has **no date primitive at
  all**.
- **Vue's** only actively-maintained, a11y-documented option is
  [@vuepic/vue-datepicker](https://vue3datepicker.com); the other two are stale
  (v-calendar's Vue-3 build last shipped 2023-10; vue-datepicker-next over three
  years ago). Different API, different theming model than anything on React.
- **Svelte** is its *own* ecosystem again —
  [bits-ui](https://bits-ui.com/docs/components/date-picker) (headless,
  built on Adobe's `@internationalized/date`) with
  [Melt](https://www.melt-ui.com/docs/builders/calendar) beneath it. Builders and
  snippets, nothing like the React or Vue surface.
- **Angular** hands you styled, framework-locked components
  ([Material](https://material.angular.dev/components/datepicker),
  [PrimeNG](https://primeng.org/datepicker),
  [ng-bootstrap](https://ng-bootstrap.github.io)) wired through
  `ControlValueAccessor` — a fourth API and a fourth theming story.
- **Solid and Lit** have essentially nothing first-class. The closest
  cross-framework answer is a vanilla engine like
  [flatpickr](https://flatpickr.js.org) (stale since 2022, a11y a known weak
  spot) or the promising web component [Cally](https://wicky.nillia.ms/cally/) —
  but flatpickr still needs a per-framework wrapper, and Cally is pre-1.0.

So a single design system today binds **react-aria on React, @vuepic on Vue,
bits-ui on Svelte, a MatDatepicker on Angular, and hand-rolls Solid/Lit** — five
APIs, five theming models, and accessibility that ranges from best-in-class
(react-aria) to a documented pain point (flatpickr). `@rozie-ui/date-picker`
authors the [WAI-ARIA grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/),
the roving keyboard focus, the `min`/`max`/`disabledDates` gating, the two-way
ISO `value` model, and the token theme **once**, and ships the *same* idiomatic
`<DatePicker>` to all six — including an Angular `ControlValueAccessor` generated
from the single `value` model, so `[(ngModel)]` and reactive forms bind directly.
See the [API reference](/components/date-picker-api) for the exact surface.

## Where each alternative is the better pick

This page is honest about where the incumbents win — that's what keeps it
credible.

- **You ship one framework and want maximum features.** If you're React-only and
  need ranges, time, and presets,
  [@mui/x-date-pickers](https://mui.com/x/react-date-pickers/) or
  [react-datepicker](https://github.com/Hacker0x01/react-datepicker) out-feature
  Rozie's v1 outright (note MUI's *range* pickers are a commercial Pro tier).
  Vue-only? [@vuepic/vue-datepicker](https://vue3datepicker.com) is deeper.
  Angular-only with a time requirement? [PrimeNG](https://primeng.org/datepicker).
- **You need a range or date-time picker today.** Rozie's v1 is single-date only.
  Reach for flatpickr, @vuepic, MUI X, PrimeNG, react-day-picker (range),
  bits-ui, or Cally (range) instead.
- **You want the absolute accessibility ceiling on React.**
  [react-aria](https://react-spectrum.adobe.com/react-aria/useDatePicker.html)'s
  date hooks are the gold standard (13 calendar systems, touch screen-reader
  support). Rozie targets a solid, audited WAI-ARIA *grid* — not Adobe's research
  budget.
- **You're framework-agnostic and want one web component.**
  [Cally](https://wicky.nillia.ms/cally/) is a genuinely good, accessible,
  sub-10KB framework-independent calendar — if a single custom element across all
  your apps is acceptable (and you don't need an idiomatic React/Vue/Angular
  component surface), it's a real alternative to Rozie's "idiomatic per
  framework" approach.

## What `@rozie-ui/date-picker` deliberately is **not**

Rozie's scope is narrow on purpose; framing it as deliberate is the honest move.

- **Not a range / multi-date / date-time picker.** v1 is a single calendar date
  (`value` is one ISO `YYYY-MM-DD` string). Ranges, time-of-day, multi-select,
  and preset shortcuts are **out of scope** — areas where flatpickr, @vuepic,
  MUI X, PrimeNG, and react-day-picker lead. (See the
  [`value` prop + scope notes](/components/date-picker-api#props).)
- **Not a popover/input combo.** It is the **calendar surface** — compose it
  inside your own field + popover (e.g. [`@rozie-ui/popover`](/components/popover))
  when you want a dropdown date field. Staying headless is what lets it drop into
  any field pattern.
- **Not the deepest localization story.** It uses `Intl.DateTimeFormat` for the
  month-year heading and weekday labels in any BCP-47 `locale`, but it does *not*
  ship the non-Gregorian calendar systems that react-day-picker, react-aria,
  bits-ui, and Melt inherit from Adobe's `@internationalized/date`.
- **Not a date library.** It carries a tiny UTC-safe internal grid helper, not a
  general date toolkit — bring `date-fns` / `dayjs` / `Temporal` for arithmetic
  elsewhere in your app. The upside: **no date-library dependency** in the bundle,
  where the styled incumbents frequently pull `date-fns` / `dayjs` / `luxon`.

## What it does ship, on all six

What Rozie *does* cover, it covers identically everywhere — and that uniformity
is the point:

| Capability | `@rozie-ui/date-picker` | Per-framework incumbents |
| --- | --- | --- |
| Cross-framework parity | ✓ one source → 6 idiomatic packages | ✗ a different library per framework |
| Headless / restyleable | ✓ token-themed + `#header` slot | ~ varies; usually opinionated CSS |
| `min` / `max` / disabled dates | ✓ built in | ✓ usually |
| Roving-grid keyboard a11y | ✓ [WAI-ARIA grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) (arrows / Home / End / PageUp / PageDown / Enter / Space) | ~ ranges from best-in-class to a known weak spot |
| Localized labels | ✓ `Intl.DateTimeFormat` | ✓ usually (often via a date lib) |
| Two-way value + form binding | ✓ ISO `value` model + Angular `ControlValueAccessor` on all six | ~ per-framework idiom |
| Imperative handle | ✓ uniform `focus()` / `goToToday()` / `clear()` | ~ varies per library |
| Date-library dependency | ✓ none (UTC-safe internal helper) | ~ frequently `date-fns` / `dayjs` / `luxon` |
| Range / time / presets | ✗ single-date only (deliberate) | ✓ many lead here |

## See also

- [DatePicker showcase](/components/date-picker) — the family, packages, and quick start
- [API reference](/components/date-picker-api) — props, events, the `#header` slot, the imperative handle
- [Live demo](/components/date-picker-demo) — the running calendar with per-target output
- [All components](/components/) — the rest of the `@rozie-ui` families
