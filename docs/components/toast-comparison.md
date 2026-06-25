---
surface_hash: 654b8b91e617
---

# Headless toast / notification comparison

How `@rozie-ui/toast` compares to the existing toast / notification libraries across the six frameworks. Like the slider, listbox, and OTP input, the toast host has **no shared vanilla-JS engine** — and like the OTP landscape, the toast landscape is overwhelmingly **per-framework**: every ecosystem grew its own notification system (`sonner`, `react-hot-toast`, `react-toastify`, `vue-sonner`, `vue-toastification`, `ngx-toastr`, …) with its own API, its own queue model, and its own theming story. Rozie authors the behaviour **once** in one `Toaster.rozie` and ships it to all six frameworks as the *same* idiomatic `<Toaster>` driven by an imperative `ref`.

> Research snapshot: 2026-06-23. The toast landscape is fragmented and fast-moving; treat the library names, framework coverage, and feature columns as of that date.

## The libraries at a glance

| Framework | Representative option(s) | Shape | Notes |
| --- | --- | --- | --- |
| **React** | `sonner`, `react-hot-toast`, `react-toastify` | global `toast()` + mounted host | The deepest ecosystem. `sonner` (the shadcn/ui default) is the polish leader — animated stack, swipe, `toast.promise`; `react-hot-toast` is the tiny headless-hooks option; `react-toastify` (v11) is the batteries-included veteran with drag-to-dismiss. |
| **Vue** | `vue-sonner`, `vue-toastification` | global service / `toast()` | `vue-sonner` ports Sonner (swipe + promise); `vue-toastification` is the configurable workhorse (`pauseOnHover`, `draggable`, custom component body). |
| **Svelte** | `svelte-french-toast`, `@zerodevx/svelte-toast` | store / `toast()` | `svelte-french-toast` is a `react-hot-toast` port (promise, hover-pause); `@zerodevx/svelte-toast` is store-driven with `pausable` hover-pause. Its own mental model again. |
| **Solid** | `solid-toast` | global `toast()` | A `react-hot-toast`-style port — promise, hover-pause, custom render. The de-facto single option. |
| **Angular** | `ngx-toastr`, `@angular/material` snackbar (CDK overlay) | injected service | `ngx-toastr` (v20) is the standard: positions, progress bar, animations. Material's `MatSnackBar` shows **one** message at a time — a different shape, not a stack. |
| **Lit / web components** | *(none mainstream)* | — | No mainstream toast component to point at — you hand-roll the queue, timers, positioning, and ARIA. |
| **Rozie** | `@rozie-ui/toast-*` | a **component** + `ref` handle | One source → all six, same `position` / `duration` / `max` props, same `show` / `dismiss` / `clear` handle, same `#toast` scoped slot. No global singleton. |

These libraries are **good** — on its home framework each is a reasonable (often excellent) pick, and Rozie does not claim to out-feature `sonner` on React or `ngx-toastr` on Angular. The wedge is **consistency, coverage, and the deliberate non-singleton shape**: there is no toast component that spans all six frameworks with the *same* API; each ecosystem reimplements the queue, the auto-dismiss timers, hover-pause, and positioning from scratch (and Lit / web components have nothing mainstream at all). Rozie gives all six the *same* idiomatic `<Toaster>` from one definition.

## The global-singleton question

The deepest decision in a toast library is **how you call `show` from anywhere**. Two camps:

- **A global singleton** (`sonner`'s `toast()`, `react-hot-toast`, `solid-toast`, `vue-sonner`, `ngx-toastr`'s injected `ToastrService`): you mount one host once, and a free-floating `toast(...)` function (or an injected service) talks to it through module-global or framework-DI state. Maximally convenient to call — at the cost of hidden global state, SSR / multiple-root hazards, and a host that is hard to scope to a subtree.
- **An owned component with an imperative handle** (**Rozie**): the `<Toaster>` owns its queue + timers as ordinary component state, and you reach it through your framework's native `ref`. "Call from anywhere" becomes an *app-wiring* decision you make explicitly (stash the ref in a store / context / service of your choosing) rather than a global the library imposes.

Rozie picks the owned-component camp deliberately. It is the only shape that compiles cleanly to **all six** frameworks without a per-framework global-state mechanism (a React context, a Vue plugin, a Svelte store, an Angular service, …), it keeps the dependency graph clean, and it side-steps the "context doesn't cross a portal" limitation. If you want a global `toast()` ergonomic, it is a few lines of wrapper you own — and you keep the ability to scope multiple independent hosts to different subtrees.

## No events, by design

Most toast libraries are imperative-first already, but many still surface lifecycle callbacks (`onDismiss`, `onAutoClose`). `@rozie-ui/toast` surfaces **none**: a notification host has nothing to two-way bind and nothing to emit upward. The entire write surface is the `show` / `dismiss` / `clear` handle, and the built-in close button calls `dismiss` internally. That is what keeps the same source fully consistent on all six frameworks, and it is why there is no `model: true` prop and no Angular `ControlValueAccessor` (a toast host is not a form control).

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-assembly-required. The non-Rozie columns name the most representative library per framework.

| Capability | React (`sonner`) | Vue (`vue-sonner`) | Svelte (french-toast) | Solid (`solid-toast`) | Angular (`ngx-toastr`) | Lit (none) | **`@rozie-ui/toast`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Queue + auto-dismiss | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Hover-to-pause timers | ✅ | ✅ | ✅ | ✅ | ⚠️ `extendedTimeOut` | ❌ | ✅ (`disablePauseOnHover` opt-out) |
| Multiple positions | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (6 corners) |
| Custom toast render | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (`#toast` slot) |
| Accessible ARIA live region | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (`role=region`/`status`, severity `aria-live`) |
| Promise / loading toast | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ (deferred) |
| Swipe-to-dismiss | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (deferred) |
| Animated stack / expand | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ❌ | ⚠️ (clean flex stack) |
| Zero-config, fully re-skinnable theming | ⚠️ styled, CSS-var overrides | ⚠️ | ⚠️ | ⚠️ | ⚠️ ships CSS | ❌ | ✅ CSS-var tokens + shadcn / Material / Bootstrap bridges |
| Ref-driven (no global singleton) | ❌ global `toast()` | ❌ | ❌ | ❌ | ❌ injected service | — | ✅ imperative `ref` handle |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **One definition, six idiomatic packages** — including **Lit / web components**, which have *no* mainstream toast component at all, and **Svelte / Solid**, which lean on store / singleton patterns. All are categories the incumbents barely serve uniformly.
- **The same component surface everywhere.** Where the ecosystem offers a different library per framework — six APIs, six queue models, six theming stories — `@rozie-ui/toast` is one `<Toaster>` with the same `position` / `duration` / `max` / `disablePauseOnHover` props, the same `show` / `dismiss` / `clear` handle, and the same `#toast` scoped slot on all six.
- **No imposed global state.** The host is a normal component you `ref` — no module-global singleton, no plugin install, no injected service — so it keeps the dependency graph clean, is SSR-safe (every timer is `typeof window`-guarded), and is scopable to any subtree.
- **Accessible live region out of the box.** `role="region"` landmark, per-toast `role="status"` with `aria-live` chosen by severity (`assertive` for errors / warnings, `polite` otherwise), and a real `<button aria-label="Dismiss">`.
- **Zero-config styling that re-skins to any design system.** Every rendered value is a `--rozie-toast-*` CSS custom property with a built-in fallback, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5 — where the incumbents ship opinionated, harder-to-fully-reskin CSS.

## What Rozie defers {#what-rozie-defers}

This page concedes where the incumbents are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap. Be clear-eyed: `sonner` and `react-hot-toast` are extremely polished, battle-tested single-framework libraries, and on React alone they are more capable today.

- **The global `toast()` ergonomic.** `sonner` / `react-hot-toast` let you `import { toast } from '…'` and call it from anywhere with zero wiring. Rozie's ref-driven model is deliberately less ergonomic: you must thread the ref to call sites (or wrap it in your own app context / store). More explicit, slightly more setup.
- **Swipe-to-dismiss and rich enter / exit + stacking animation.** `sonner` (and its Vue port) has a polished animated stack — hover to expand, momentum swipe to dismiss. `@rozie-ui/toast` ships a clean flex stack with a close button; gesture + animation choreography is not modeled in v1.
- **Promise / loading toasts.** The `toast.promise(...)` convenience (pending → resolved / rejected in one call) that `sonner`, `react-hot-toast`, `vue-sonner`, and `svelte-french-toast` offer is a wrapper you can build on `show` / `dismiss`, not a built-in.
- **Remaining-time-aware hover pause.** Hovering pauses the auto-dismiss timers and a full restart runs on leave; precise remaining-time tracking (resume exactly where it paused) is intentionally out of v1 scope.
- **`@rozie-ui/toast` is `0.1.0`.** The surface (5 props / 0 events / 3-verb handle / 1 scoped slot / hover-pause / six positions) is stable and gate-verified across all six targets, but it is younger and less battle-tested than the established per-framework libraries.

## Try it

The [`@rozie-ui/toast` showcase + API reference](/components/toast) documents the `@rozie-ui/toast-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/toast-react`, etc.). There is **no engine to import and no required CSS** — the queue / timer behaviour and a fully-tokenised skin ship inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/toast-demo) runs the real Vue package in the page.

## Cross-references

- [Toaster — showcase & API](/components/toast) — the full `@rozie-ui/toast` surface, quick start, theming, and accessibility reference.
- [Toaster — live demo](/components/toast-demo) — the real Vue package running in the page (info / success / error buttons driving the `ref` handle), plus the one `.rozie` source and all six generated outputs.
- [`Toaster.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/toast/src/Toaster.rozie)
- [Otp — headless one-time-code input](/components/otp-comparison) — a sibling no-engine pure-Rozie family.
