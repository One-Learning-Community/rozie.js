---
surface_hash: 55a0e102b7f7
---

# Flatpickr libraries comparison

Date pickers are one of the most-wrapped vanilla-JS engines in the front-end
ecosystem — and [flatpickr](https://flatpickr.js.org/) is the engine the
community keeps reaching for. But every framework gets its *own* wrapper,
versioned and maintained separately, and the cross-framework story is whoever
happened to publish a binding for your framework this year.

Rozie's [`@rozie-ui/flatpickr`](/components/flatpickr) is the killer demo for
[Rozie's competitive wedge](/guide/why): one `.rozie` file compiles to
idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers — six
framework targets from a single source, where the existing ecosystem ships
five separate per-framework wrappers and leaves Solid with no flatpickr
binding at all.

Every wrapper on this page — including Rozie's — depends on the **same
`flatpickr` core engine, version 4.6.13, last published 2022-04-14**. The
engine itself is effectively frozen, so this comparison is purely about the
**per-framework binding layer**: how each wrapper handles two-way binding,
runtime reconcile, imperative access, forms, and which framework versions it
supports today.

## Comparison matrix

Cell legend: **✓** = documented out-of-the-box · **✗** = not supported / not
present · **~** = partial / consumer-glue-required / not documented. ("Not
documented" is scored `~`, never `✗` — absence of documentation is not
evidence of absence.)

| Wrapper | Frameworks | Last maintained | Latest-framework support | Two-way binding | Runtime reconcile | Imperative handle | Angular CVA | rangePlugin |
| ------- | ---------- | --------------- | ------------------------ | :-------------: | :---------------: | :---------------: | :---------: | :---------: |
| **[Rozie @rozie-ui/flatpickr](/examples/flatpickr)** | **6 — React + Vue + Svelte + Angular + Solid + Lit** | this repo (2026-06) | R18+ / V3.4+ / Sv5 / Ng19+ / Solid / Lit | ✓ `r-model:date` | ✓ managed | ✓ `$expose` | **✓** | ✓ |
| [react-flatpickr](https://github.com/haoxins/react-flatpickr) | React | 2025-07 | React 19 (peer `>= 16 <= 19`) | ✓ value + onChange | **~** `useMemo` | ✓ `.flatpickr` ref | n/a | ~ |
| [vue-flatpickr-component](https://github.com/ankurk91/vue-flatpickr-component) | Vue 3 | **✗ archived 2025-03** | Vue 3 only | ✓ v-model | ✓ watches config | ~ not documented | n/a | ~ |
| [angularx-flatpickr](https://github.com/mattlewis92/angularx-flatpickr) | Angular | 2024-11 | "Angular 17+" (19 in range) | ✓ ngModel / CVA | ~ not documented | ~ via directive | **✓** | ~ |
| [svelte-flatpickr](https://github.com/jacobmischka/svelte-flatpickr) | Svelte 3 | 2024-12 | **Svelte `< 5.0` only** | ✓ bind:value | ~ not documented | ~ not documented | n/a | ~ |
| [lit-flatpickr](https://github.com/Matsuuu/lit-flatpickr) | Lit 2 | 2025-03 | **Lit 2 only** (pre-1.0) | ✓ attr + `set()` | ~ `set()` only | ✓ rich methods | n/a | ~ |
| Solid | — | — | *no flatpickr wrapper exists* | ✗ | ✗ | ✗ | n/a | ✗ |

**Weekly downloads** (npm, snapshot 2026-05-25→31, dated color — *not* a quality
verdict): react-flatpickr **195.6k** · vue-flatpickr-component **113.3k** ·
angularx-flatpickr **32.8k** · svelte-flatpickr **11.8k** · lit-flatpickr
**1.0k** · Rozie `@rozie-ui/flatpickr`: new.

The matrix scores each wrapper against what it documents out of the box,
without consumer-authored glue. All competitor facts were verified against the
npm registry, the GitHub API, and each project's README on **2026-06-02**;
re-check the dates before relying on them.

## Why Rozie's row reads the way it does

- **Cross-framework reach from one source — the headline.** Rozie compiles a
  single `.rozie` definition to six idiomatic targets (React 18+, Vue 3.4+,
  Svelte 5 runes, Angular 19+, Solid, Lit), each consumed as a pre-compiled
  `@rozie-ui/flatpickr-*` package with no Rozie toolchain required. The existing
  ecosystem is five independently-versioned wrappers — one per framework —
  plus a Solid hole: **there is no flatpickr wrapper for Solid on npm.** (Native
  Solid date pickers exist; none of them wrap flatpickr — so a team
  standardizing on flatpickr across frameworks has nothing for Solid.) This is
  the whole wedge.

- **Maintenance currency, dated honestly.** vue-flatpickr-component has been
  **archived / read-only since 2025-03-14** (the repo's verified state — it
  still works, but takes no future Vue-version maintenance); angularx-flatpickr
  last shipped **2024-11-28**; svelte-flatpickr last shipped **2024-12-02**.
  These are the published dates — read them and judge for yourself. Rozie's
  port ships from one living source in this repository.

- **Latest-framework-version support — the cleanest, peer-dep-objective
  differentiator.** svelte-flatpickr's peer range is `>= 3.31.0 < 5.0`, so it
  **does not support Svelte 5**; Rozie targets Svelte 5 runes. lit-flatpickr
  **declares `lit ^2.0.0`** — Lit 2 only, and it is pre-1.0 (v0.4.1) — while
  Rozie targets current Lit. vue-flatpickr-component is Vue-3-only and frozen.
  react-flatpickr, by contrast, **does support React 19** (peer `>= 16 <= 19`),
  so its column is honest ✓ on version support — its real gotcha is reconcile
  (below), not React-version coverage.

- **Managed runtime reconcile, applied uniformly.** Rozie reconciles
  `disable` / `enable` / `locale` / `minDate` / `maxDate` / `mode` /
  `dateFormat` / `disabled` live via flatpickr's `set()` — no remount — and this
  is [behaviorally verified across all six
  targets](https://github.com/One-Learning-Community/rozie.js/blob/main/tests/visual-regression/specs/flatpickr-behavior.spec.ts)
  (6/6 green, this repo). The standalone story varies per wrapper, and the
  comparison is fair about it: **vue-flatpickr-component also claims dynamic
  reconcile** ("watches config, redraws itself" — kept as an honest ✓), and
  **react-flatpickr requires the consumer to `useMemo` their props** or the
  picker remounts on every render (its README troubleshooting calls this out).
  Rozie manages reconcile the same way across all six targets; with the
  standalone wrappers it's per-wrapper, and sometimes the consumer's job.

- **The range partial-commit guard.** Rozie defaults to `commitOn="complete"`,
  so a range only commits once both endpoints are chosen — a guard the
  standalone wrappers leave to the consumer. See [Range mode and commit
  semantics](/components/flatpickr#range-mode-and-commit-semantics).

- **Uniform imperative handle + two-way string value across all six.** Rozie's
  [`$expose` handle](/components/flatpickr#imperative-handle) gives the *same*
  nine-method API — `clear` / `openPicker` / `closePicker` / `togglePicker` /
  `selectDate` / `jumpToDate` / `changeMonth` / `changeYear` / `getSelectedDates` —
  on every target. react-flatpickr exposes the raw instance via
  a `.flatpickr` ref and lit-flatpickr ships a rich method set, but
  vue-flatpickr-component and svelte-flatpickr don't document an instance
  accessor (scored `~`). And Rozie's `r-model:date` binds the **formatted
  string**, whereas react-flatpickr and svelte-flatpickr surface `Date[]` by
  default.

The ✓ cells in Rozie's row are backed by
[`flatpickr-behavior.spec.ts`](https://github.com/One-Learning-Community/rozie.js/blob/main/tests/visual-regression/specs/flatpickr-behavior.spec.ts)
(6/6 targets green, this repo) — which measures *Rozie's* behavior across
targets and says nothing measured about the competitors' behavior.

## Caveats

This page concedes where the standalone wrappers genuinely win — that's what
keeps the comparison credible.

- **Angular reactive-forms CVA — at parity.** angularx-flatpickr ships a real
  `ControlValueAccessor` plus `NG_VALUE_ACCESSOR` registration (confirmed in its
  `flatpickr.directive.ts`), giving full `ngModel` / reactive-forms integration.
  **Rozie's wrapper now does too** — the Angular compile target auto-generates a
  `ControlValueAccessor` from the single two-way `date` model (registered via
  `NG_VALUE_ACCESSOR` on the component, no wrapper directive), so `[(ngModel)]`,
  `[formControl]`, and `formControlName` bind directly. See the
  [`formControlName` recipe + coexistence semantics](/components/flatpickr#forms-drop-in).
  The two wrappers reach the same Angular-forms cell; Rozie additionally ships
  the *same* source to five other frameworks. The behavior is proven at runtime
  by [`flatpickr-cva.spec.ts`](https://github.com/One-Learning-Community/rozie.js/blob/main/tests/visual-regression/specs/flatpickr-cva.spec.ts)
  (7/7 green: null-default round-trip, the `setValue`/`reset`/`disable`/`enable`/
  `touched`/zero-echo battery, `[(date)]`-vs-form coexistence, and the
  no-crash baselines — all binding forms directives directly to the emitted
  component, with zero hand-written CVA in the harness).

- **react-hook-form spread limitation.** You cannot spread the full
  `register('field')` object onto the component — `register`'s `onChange`,
  `onBlur`, and `ref` collide with the component's own `onChange` emit-prop.
  Wire the value through `date` / `onDateChange` and forward only `name`. See
  [Forms drop-in](/components/flatpickr#forms-drop-in).

- **Shadow-DOM rangePlugin caveat.** `rangePlugin`'s second-input option must be
  passed the **element**, not a selector string, in any shadow-DOM /
  custom-element (Lit) context — `document.querySelector` cannot see into shadow
  DOM and fails silently. The warning callout lives in [Two-input range via
  rangePlugin](/components/flatpickr#two-input-range-via-rangeplugin).

- **Single-framework ergonomics are not the contest.** The matrix scores
  out-of-the-box, cross-framework capability. react-flatpickr (195.6k
  downloads/wk, React-19-ready), angularx-flatpickr (real CVA), and the others
  are excellent *single-framework* choices. The comparison is about
  cross-framework reach from one source — not single-framework ergonomics.

## Try the live demo

The [Flatpickr example page](/examples/flatpickr) shows the live demo alongside
its per-target compiled output — the same `.rozie` source that powers every
target cell in the matrix above.

Ready to ship it? The [`@rozie-ui/flatpickr` showcase + API
reference](/components/flatpickr) documents the `@rozie-ui/flatpickr-*` packages —
one pre-compiled, per-framework install (`npm i @rozie-ui/flatpickr-react`,
etc.) with no Rozie toolchain required.
