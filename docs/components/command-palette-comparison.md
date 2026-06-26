---
surface_hash: 5a1520748367
---

# Command palette — comparison

The "⌘K" command palette — a centered modal overlay with a search box over a filtered, keyboard-navigable list of commands — is a staple of modern apps (VS Code, Linear, Raycast, GitHub, Vercel). The pattern has one dominant library, **cmdk**, and a scattering of single-framework alternatives and community ports around it. What no one ships is *one* accessible command palette that spans React **and** Vue **and** Svelte **and** Angular (**and** Solid **and** Lit) with a single API. That gap is what `@rozie-ui/command-palette` fills: one `CommandPalette.rozie` source compiled to six idiomatic, accessible packages.

> Research snapshot: 2026-06-25. Library names, framework coverage, versions, and maintenance notes are as of that date and move fast — verify before depending on a specific claim.

## The landscape at a glance

| Library | Framework(s) | Headless? | Accessibility | Maintained? | Filtering / feature depth | Notes |
| --- | --- | :---: | --- | --- | --- | --- |
| [**cmdk**](https://www.npmjs.com/package/cmdk) | React only | ✅ unstyled | Strong — combobox/listbox roles, used by shadcn/ui `Command` | Yes — v1.1.1 (Mar 2025) | Deep: composable groups, built-in fuzzy scoring, async loading states | The de-facto ⌘K. Powers shadcn/ui `Command` and Vercel. React-only. |
| [**kbar**](https://www.npmjs.com/package/kbar) | React only | ⚠️ partly styled | Keyboard-first; less ARIA-complete than cmdk | Slowing — `0.1.0-beta.x` for years | Action registry, nested actions, built-in shortcut binding | Different model: a global *action* registry, not a controlled list. Still beta. |
| [**react-command-palette**](https://www.npmjs.com/package/react-command-palette) | React only | ⚠️ themed | WAI-ARIA compliant (its headline feature) | Stale — v0.22.1, last publish ~3 yr ago | Fuzzy search via options; theming presets | Older, theme-driven; largely superseded by cmdk in practice. |
| [**vue-command-palette**](https://www.npmjs.com/package/vue-command-palette) | Vue 3 only | ✅ unstyled | Combobox-style; less documented than cmdk | Stale — v0.2.3, last publish ~3 yr ago | Composable, cmdk-inspired; BYO filtering/scoring | A community port of cmdk's *ideas* to Vue. Vue-only. |
| [**cmdk-sv**](https://www.npmjs.com/package/cmdk-sv) | Svelte only | ✅ unstyled | Combobox/listbox roles | **Deprecated** — folded into Bits UI `Command` | cmdk-parity scoring + groups | Officially deprecated in favour of [Bits UI `Command`](https://bits-ui.com/docs/components/command). |
| [**svelte-command-palette**](https://www.npmjs.com/package/svelte-command-palette) | Svelte only | ⚠️ themed | Keyboard-driven; modest ARIA | Older (v2.x) | Action-list model + shortcut binding | Svelte-only; closer to kbar's action model than cmdk's. |
| Angular CDK `Dialog` + `Listbox` | Angular only | ✅ primitives | Strong if assembled correctly | Yes (Angular CDK) | You assemble it — filtering/scoring is yours to write | No dominant Angular command palette; usually hand-assembled from CDK primitives. |
| [**ninja-keys**](https://github.com/ssleptsov/ninja-keys) | Web component (HTML/Vue/React/Svelte) | ❌ styled element | Keyboard nav; not a documented APG-grade a11y story | Low activity — no GitHub releases, ~2023-era | Nested menus, hotkeys, theming, root search | Cross-framework, but a *styled* `<ninja-keys>` element you configure via a `data` array — a different authoring model. |
| [Algolia **DocSearch**](https://docsearch.algolia.com/) | Any (drop-in widget) | ❌ hosted widget | Good, but a search box, not a command runner | Yes (v4) | Crawls + indexes your docs; instant search | Adjacent category: ⌘K *site search*, not an app *command* menu. Hosted Algolia index. |
| **`@rozie-ui/command-palette`** | React, Vue, Svelte, Angular, Solid, Lit | ✅ headless | WAI-ARIA dialog + combobox + listbox/option, `aria-activedescendant` | New — `0.1.0` | Substring match over `label` + `keywords`, source-order; flat list | One `.rozie` source → six idiomatic packages, same API. |

## The honest core point

The dominant command palette, **cmdk**, is **React-only**. Everything else in the table is either single-framework (`kbar`, `vue-command-palette`, `svelte-command-palette`, the Angular CDK assembly), a community port that diverges in API and accessibility (`vue-command-palette` reinterprets cmdk for Vue; `cmdk-sv` ported it to Svelte and is **now deprecated** in favour of Bits UI's `Command`), or a cross-framework option with a fundamentally different authoring model (`ninja-keys` is a *styled* web component configured through a JS `data` array, not a headless primitive you compose).

So a design system that ships React **and** Vue **and** Svelte **and** Angular wrappers today maintains three or four *different* command-menu integrations — different props, different filtering models, different accessibility quality — that must somehow stay behaviorally in lockstep. That per-framework duplication is exactly what Rozie exists to eliminate: `@rozie-ui/command-palette` authors the WAI-ARIA command-menu behavior **once** and compiles it to all six targets as the *same* idiomatic `<CommandPalette>`.

## What `@rozie-ui/command-palette` gives you

- **One source, six idiomatic packages.** `CommandPalette.rozie` compiles to `@rozie-ui/command-palette-{react,vue,svelte,angular,solid,lit}`. Install only your framework's; there is no Rozie toolchain or build step for the consumer.
- **The same accessibility everywhere.** A `role="dialog"` `aria-modal` overlay, an `<input role="combobox" aria-autocomplete="list" aria-expanded aria-controls aria-activedescendant>` search field, a `role="listbox"` of `role="option"` results with `aria-selected` / `aria-disabled`, a roving highlight tracked via `aria-activedescendant` while DOM focus stays on the input, Enter-to-select, Escape / backdrop to dismiss — the WAI-ARIA APG combobox-with-listbox pattern, authored once and identical across targets.
- **Idiomatic two-way state.** Two `model: true` slices — `open` (visibility) and `query` (search text) — bound with `r-model:open` / `v-model:open` / `bind:open` / `[(open)]` and likewise for `query`. No per-framework controlled/uncontrolled glue. (Because there are *two* models, the Angular output deliberately ships **no** `ControlValueAccessor` — a palette is not a single form value.)
- **Scoped slots.** `option` (custom row render, scoped with <span v-pre>`{ option, index, active, selected, disabled }`</span> — the listbox vocabulary shared with `@rozie-ui/listbox`, which the palette composes internally), `empty` (the no-results state, scoped with <span v-pre>`{ query }`</span>), and `footer` (a persistent footer bar) — ordinary scoped slots on every target.
- **An imperative handle.** `show()` / `close()` / `toggle()` / `focus()`, obtained through each framework's native ref mechanism. (The open verb is `show`, not `open`, because an `open()` verb would collide with the `open` model.)
- **A web-component build.** The Lit leaf gives plain-HTML / web-component consumers a real `<rozie-command-palette>` element with the *same* headless ARIA behavior — the one tier where the only real off-the-shelf option, `ninja-keys`, is a pre-styled element rather than a headless primitive.
- **Token-themed.** Every visual value is a `--rozie-command-palette-*` CSS custom property with a fallback; shadcn/ui, Material 3, and Bootstrap 5 theme bridges ship in the box.

## When a competitor is the better pick

This comparison stays credible by saying so plainly:

- **A React-only app that wants depth → use cmdk.** cmdk is mature, battle-tested, powers shadcn/ui's `Command`, and is genuinely deeper than Rozie's v1: a fully composable group/item API, sophisticated built-in fuzzy *scoring* (not just substring matching), and built-in async loading states. If you will only ever ship React, cmdk is the stronger, more proven choice — Rozie's pitch is cross-framework parity, not out-featuring cmdk on its home turf.
- **A Svelte-only app → use Bits UI `Command`.** With `cmdk-sv` deprecated, [Bits UI's `Command`](https://bits-ui.com/docs/components/command) is the maintained Svelte option, with a built-in scoring algorithm, `Command.Group` headings, and loading/empty states.
- **A Vue-only app → Headless UI's combobox or `vue-command-palette`** are reasonable, framework-native picks.
- **You only need site/docs search → use Algolia DocSearch.** DocSearch is a different category — a hosted, crawled ⌘K *search* widget — but if "⌘K" for you means "search my documentation," it is the purpose-built tool, not an app command runner.

Rozie's wedge is **consistency and coverage**, not feature maximalism: there is no other accessible command palette that spans all six frameworks with the *same* API, and Lit / web components and Solid in particular have essentially no headless incumbent at all.

## What it deliberately does not do (v1) {#scope-limits}

Stated plainly — this doubles as the roadmap:

- **It is not a fuzzy-ranking search engine.** The filter is a **case-insensitive substring match** over each item's `label` plus its optional `keywords`, **preserving source order**. cmdk and Bits UI ship real fuzzy *scoring* that reranks results by match quality; Rozie does not. For fuzzy ranking, pre-rank your `items` and feed the ordered list in — the `query` model and the `select` event give you the hook.
- **It is a flat list, not nested groups.** Items carry an optional `group` field surfaced per-row (and in the `option` slot scope), but Rozie does **not** render sticky group *headings* automatically the way cmdk's `Command.Group` or Bits UI's `Command.Group` do. Render grouped headings yourself via the `option` slot.
- **No built-in async / loading state.** There is no first-class "loading" affordance; drive it through your `items` array and the `empty` slot. (cmdk and Bits UI have explicit loading states.)
- **It does not own a global keyboard shortcut.** Bind ⌘K / Ctrl-K yourself and call `show()` (or set the `open` model). cmdk, kbar, and ninja-keys variously help with this; Rozie stays unopinionated about how the palette is summoned.
- **It is self-contained, not composed from the listbox family.** The results list is authored inline (scoped slots + roving nav), **not** by composing the published `@rozie-ui/listbox` package — cross-family composition of published leaves isn't expressible in the compiler today. The accessibility primitives are the same; the implementation is just not a dependency on another leaf.
- **`@rozie-ui/command-palette` is `0.1.0`.** The surface (8 props / 1 `select` event / a 4-verb handle / `option` · `empty` · `footer` slots / two-way `open` + `query`) is stable and gate-verified across all six targets, but it is far younger and less battle-tested than cmdk.

## Try it

- [**Command palette — showcase**](/components/command-palette) — what it is, the quick start, how the overlay / filter / keyboard model work, and the accessibility reference.
- [**Command palette — API reference**](/components/command-palette-api) — the full prop / model / event / handle / slot surface.
- [**Command palette — live demo**](/components/command-palette-demo) — the real package running in the page, plus the one `.rozie` source and its six generated outputs.
- [All `@rozie-ui` components](/components/) — the rest of the headless family.
- [`CommandPalette.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/command-palette/src/CommandPalette.rozie)
