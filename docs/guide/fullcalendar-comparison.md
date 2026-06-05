# FullCalendar libraries comparison

A full calendar/scheduler is one of the heaviest UI primitives a component
library can ship — and [FullCalendar](https://fullcalendar.io/) is the vanilla
engine the ecosystem has standardized on. Unlike most engines, FullCalendar
publishes its *own* official framework connectors — but only for three
frameworks. The rest of the matrix is a stale community wrapper, a pre-1.0
experiment, and, for one major framework, nothing at all.

Rozie's [`@rozie-ui/fullcalendar`](/guide/fullcalendar) compiles one `.rozie`
file to idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers — six
framework targets from a single source, each a pre-compiled
`@rozie-ui/fullcalendar-*` package with no Rozie toolchain required. Where the
ecosystem ships three official connectors plus scattered community coverage,
Rozie ships the *same* 13-prop / 11-event surface, the *same* eight-verb
imperative handle, the *same* nine custom-content portal slots, and the *same*
`:options` long-tail passthrough on all six.

Every wrapper on this page — including Rozie's — drives the **same
`@fullcalendar/core` engine, current release `6.1.20`, published
2025-12-23**. The engine is shared and well-maintained, so this comparison is
purely about the **per-framework binding layer**: which frameworks have a
binding at all, which framework versions it supports, and how consistent the
reconcile / imperative-handle / custom-content story is across them.

## Comparison matrix

Cell legend: **✓** = documented out-of-the-box · **✗** = not supported / not
present · **~** = partial / consumer-glue-required / not documented. ("Not
documented" is scored `~`, never `✗` — absence of documentation is not
evidence of absence.)

| Wrapper | Frameworks | Last published | Latest-framework support | Runtime option reconcile | Imperative handle | Custom event content |
| ------- | ---------- | -------------- | ------------------------ | :----------------------: | :---------------: | :------------------: |
| **[Rozie @rozie-ui/fullcalendar](/guide/fullcalendar)** | **6 — React + Vue + Svelte + Angular + Solid + Lit** | this repo (2026-06) | R18+ / V3.4+ / Sv5 / Ng19+ / Solid / Lit | ✓ managed `$watch`→`setOption` + `:options` long-tail | ✓ uniform `$expose` (8 verbs) | ✓ 9 portal-slots, all 6 |
| [@fullcalendar/react](https://www.npmjs.com/package/@fullcalendar/react) *(official)* | React | 6.1.20 · 2025-12 | **React ≤ 18** (peer `^16.7 \|\| ^17 \|\| ^18`) | ✓ diff → re-render | ✓ `ref` → `getApi()` | ✓ `eventContent` render-prop |
| [@fullcalendar/vue3](https://www.npmjs.com/package/@fullcalendar/vue3) *(official)* | Vue 3 | 6.1.20 · 2025-12 | Vue 3.0.11+ (✓ 3.4+) | ✓ watches options | ✓ `ref` → `getApi()` | ✓ scoped slot |
| [@fullcalendar/angular](https://www.npmjs.com/package/@fullcalendar/angular) *(official)* | Angular | 6.1.20 · 2025-12 | Angular **12 – 21** (✓ 19+) | ✓ diffs `[options]` | ✓ `getApi()` | ✓ `ng-template` |
| [svelte-fullcalendar](https://github.com/YogliB/svelte-fullcalendar) *(community)* | Svelte | **3.0.0 · 2023-09** | **Svelte 4 era** (no Svelte 5) | ~ options object | ~ via instance ref | ~ not documented |
| [solid-full-calendar](https://www.npmjs.com/package/solid-full-calendar) *(community)* | Solid | **0.1.x** (pre-1.0) | Solid (minimal) | ~ | ~ | ~ |
| Lit | — | — | *no FullCalendar wrapper exists* | ✗ | ✗ | ✗ |

**Weekly downloads** (npm, snapshot 2026-05-27→06-02 — a popularity datum, *not*
a quality verdict): @fullcalendar/react **1,265,995** · @fullcalendar/vue3
**173,652** · @fullcalendar/angular **162,806** · svelte-fullcalendar **1,960** ·
solid-full-calendar: negligible · Rozie `@rozie-ui/fullcalendar`: new.

The matrix scores each wrapper against what it documents out of the box, without
consumer-authored glue. All competitor facts were verified against the npm
registry, the GitHub API, and each project's README/`package.json` on
**2026-06-05**; re-check the dates before relying on them.

## Why Rozie's row reads the way it does

- **Cross-framework reach from one source — the headline.** FullCalendar's
  official connectors cover exactly three frameworks: React, Vue 3, and Angular.
  Svelte's only option is the community `svelte-fullcalendar`, **last published
  2023-09-14** and built for the Svelte-4 era; Solid's only option is
  `solid-full-calendar`, a **pre-1.0 (0.1.x)** experiment; and **Lit has no
  FullCalendar wrapper on npm at all.** A team standardizing on FullCalendar
  across all six frameworks gets three first-class connectors, one stale
  wrapper, one toy, and one hole. Rozie compiles a single `.rozie` definition to
  all six idiomatic targets — pre-compiled `@rozie-ui/fullcalendar-*` packages,
  no Rozie toolchain required. **That is the whole wedge: not "more maintained
  than the official three," but "the same component everywhere the official
  three don't reach."**

- **React 19 — a clean, peer-dep-objective differentiator.** The official
  `@fullcalendar/react@6.1.20` declares its React peer range as
  `^16.7.0 || ^17 || ^18` — so **React 19 is outside its supported range.**
  Rozie's `@rozie-ui/fullcalendar-react` leaf declares `react: "^18.2 || ^19"`,
  so it installs and types cleanly against React 19 today.

- **A uniform imperative handle across all six.** Rozie's
  [`$expose` handle](/guide/fullcalendar#imperative-handle) is the *same* eight
  verbs — `getApi` / `changeView` / `addEvent` / `removeEvent` / `today` /
  `prev` / `next` / `gotoDate` — on every target. The official connectors all
  expose the underlying `Calendar` via `getApi()` too, but each reaches it its
  own way (a React `ref`, a Vue/Angular component method), and the community
  wrappers vary further. Rozie gives consumers one handle shape to learn once
  and use on any framework. See [Driving navigation from the
  handle](/guide/fullcalendar#driving-navigation-from-the-handle).

- **The full `*Content` slot set as portal slots, everywhere.** FullCalendar's
  content hooks are exactly the kind of feature that fragments per framework —
  a render-prop in React, a slot in Vue, a template in Angular, and unsupported
  in the wrappers that don't reach those frameworks. Rozie surfaces **nine** of
  them — `event`, `dayCell`, `dayHeader`, `slotLabel`, `weekNumber`,
  `nowIndicatorContent`, `moreLink`, `allDayContent`, and `slotLaneContent` — as
  portal slots, each emitting the
  framework's idiomatic consumer surface (React / Solid render-prop, Vue
  scoped-slot, Svelte snippet, Angular content-child, Lit slot bridge),
  documented per-target in [Slots](/guide/fullcalendar#slots). Every slot is
  guarded — omit it and you get FullCalendar's default rendering on every target.

- **A `:options` long-tail passthrough, applied uniformly.** The curated
  13-prop surface stays primary, but FullCalendar exposes far more options and
  hooks than any wrapper can curate. Rozie's
  [`options` prop](/guide/fullcalendar#props) is an arbitrary passthrough bag —
  spread *first* into the engine config so curated props/events/slots win on key
  collision — that forwards anything the curated surface doesn't special-case
  (`businessHours`, `dayMaxEvents`, `*DidMount` hooks, object locales, the one
  excluded `noEventsContent` hook — list-view only, pending a future
  `@fullcalendar/list` plugin, …)
  identically on all six targets, with per-key `setOption` runtime reconcile.
  This closes the "but my app needs option X" gap without forking the wrapper.

- **Managed runtime reconcile, applied uniformly.** Each runtime-updatable prop
  — `view` / `weekends` / `editable` / `selectable` / `height` / `nowIndicator`
  / `firstDay` / `slotDuration` / `locale` / `headerToolbar` — reconciles live
  via the engine's `setOption` with no remount, the `events` array reconciles
  through a managed `removeAllEvents` + `addEvent` loop, and `view` carries a
  round-trip guard so two-way binding doesn't fight the engine. See
  [Reconciling events at runtime](/guide/fullcalendar#reconciling-events-at-runtime).
  The same reconcile behavior is exercised across all six targets by
  [`full-calendar-behavior.spec.ts`](https://github.com/One-Learning-Community/rozie.js/blob/main/tests/visual-regression/specs/full-calendar-behavior.spec.ts);
  cross-target rendering parity is pinned by the six
  [`full-calendar.spec.ts`](https://github.com/One-Learning-Community/rozie.js/blob/main/tests/visual-regression/specs/full-calendar.spec.ts)
  VR cells.

## Caveats

This page concedes where the standalone connectors genuinely win — that's what
keeps the comparison credible.

- **The official React / Vue / Angular connectors are excellent and current.**
  Unlike the date-picker ecosystem, FullCalendar's own connectors are not stale
  community forks — they ship from FullCalendar's monorepo, track the current
  `6.1.x` engine in lockstep (6.1.20, 2025-12-23), and are the reference
  standard for those three frameworks. For a single-React, single-Vue, or
  single-Angular app, the official connector is the obvious choice. Rozie's value
  on those three is the *uniform cross-framework surface* plus React-19 support
  plus one source — not "more maintained."

- **Reactive props, `getApi`, and custom content are real on the official
  three.** The matrix scores those columns ✓ for React, Vue 3, and Angular
  because the official connectors genuinely support them. Rozie's advantage on
  those columns is consistency — the *identical* API on all six targets — rather
  than a capability the official connectors lack.

- **Premium / scheduler views are out of scope.** `@rozie-ui/fullcalendar` wraps
  the four free plugins (`core` + `daygrid` + `timegrid` + `interaction`). The
  premium resource-timeline / resource-timegrid views, the `rrule`
  recurring-event plugin, and the `list` view are not wrapped — they sit behind
  FullCalendar's own premium license and a separate plugin surface.

- **Single-framework ergonomics are not the contest.** The matrix scores
  out-of-the-box, cross-framework capability. The comparison is about reaching
  all six frameworks — including the three the ecosystem leaves stale, pre-1.0,
  or empty — from one source, not about single-framework ergonomics.

## Try it

The [`@rozie-ui/fullcalendar` showcase + API reference](/guide/fullcalendar)
documents the `@rozie-ui/fullcalendar-*` packages — one pre-compiled,
per-framework install (`npm i @rozie-ui/fullcalendar-react`, etc.) plus the four
`@fullcalendar/*` plugin peers; FullCalendar v6 auto-injects its CSS, so there
is no stylesheet import to wire. The
[`FullCalendarDemo` source](https://github.com/One-Learning-Community/rozie.js/blob/main/examples/demos/FullCalendarDemo.rozie)
is the same `.rozie` consumer that powers every target cell in the matrix above.
