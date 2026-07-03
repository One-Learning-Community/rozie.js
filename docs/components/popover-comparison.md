---
surface_hash: 951a5ea440e4
---

# Popover — how it compares

`@rozie-ui/popover` wraps [`@floating-ui/dom`](https://floating-ui.com) — the same vanilla-JS positioning engine that powers most of the libraries below. The difference is **one source, six idiomatic packages**: instead of maintaining a separate React hook library, a Vue plugin, and hand-rolled Svelte/Solid/Lit ports, you ship a single `Popover.rozie` and consumers install only their framework's leaf. Styling follows the same one-source model: every rendered value is a `--rozie-popover-*` CSS custom property with a built-in fallback (zero-config, fully re-skinnable), plus ready-made [theme bridges](/components/popover#theming) for shadcn/ui, Material 3, and Bootstrap 5 — where most of the libraries below ship unstyled or leave re-skinning to per-framework CSS.

## vs the Floating UI framework packages (`@floating-ui/react`, Floating Vue, etc.)

Floating UI ships first-class bindings for some frameworks and nothing for others:

| | React | Vue | Svelte | Angular | Solid | Lit |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Official / well-maintained binding | `@floating-ui/react` (full) | Floating Vue (community) | — | — | `solid-floating-ui` (thin) | — |
| `@rozie-ui/popover` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

`@floating-ui/react` is excellent and far deeper than this primitive (focus management, interactions, the full hook toolkit). If you are React-only and need that depth, use it directly. `@rozie-ui/popover` instead gives **the same engine, the same API, on every framework** — the value is parity across a multi-framework design system, not out-depthing the React-specific package.

## vs Radix Popover / Headless UI

Radix and Headless UI are React-first (Radix has a Vue port; Headless UI covers React + Vue). They bundle a rich accessibility + focus-trap layer that this primitive deliberately keeps minimal (it wires `role`/`aria-expanded`/`aria-describedby` + Escape/click-outside dismissal, and leaves focus-trapping to the consumer). Choose Radix/Headless UI for a batteries-included React/Vue popover; choose `@rozie-ui/popover` when you need the **same headless positioning primitive across React, Vue, Svelte, Angular, Solid, and Lit** with a single API.

## vs Tippy.js / Floating Vue (tooltips)

Tippy.js is a popular standalone tooltip library (itself built on Floating UI's predecessor Popper, and Floating UI in v6+). Floating Vue is the Vue-specific successor. Both are great for tooltips but are framework-coupled (Tippy ships per-framework wrappers; Floating Vue is Vue-only). `@rozie-ui/popover` serves **both tooltip (`trigger="hover"`/`"focus"`, `role="tooltip"`) and popover (`trigger="click"`, `role="dialog"`) modes** from one component, on all six frameworks.

## When NOT to use it

- You need a full focus-trap + dismissable-layer stack on React only → `@floating-ui/react` or Radix.
- You need a modal dialog (not a positioned floating element) → use [`@rozie-ui/dialog`](/components/dialog).
- You want a select/combobox listbox → use [`@rozie-ui/listbox`](/components/listbox) or [`@rozie-ui/combobox`](/components/combobox), which own their own keyboard/selection model.
