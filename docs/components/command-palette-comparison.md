---
surface_hash: 8685349f7d90
---

# Command palette — comparison

The "⌘K" command palette (a centered modal overlay with a search box over a filtered, keyboard-navigable list of commands) is a staple of modern apps (VS Code, Linear, Raycast, GitHub, Vercel). The pattern has one dominant library, **cmdk**, and a scattering of single-framework alternatives and community ports around it. What no one ships is one accessible command palette that spans React, Vue, Svelte, Angular, Solid, and Lit with a single API. That gap is what `@rozie-ui/command-palette` fills: the same accessible palette, with the same props, models, events, slots, and handle, on all six frameworks, installed as pre-compiled per-framework packages.

> Research snapshot: 2026-08-10. Library names, framework coverage, versions, and maintenance notes are as of that date and move fast; verify before depending on a specific claim.

## The landscape at a glance

| Library | Framework(s) | Headless? | Accessibility | Maintained? | Filtering / feature depth | Notes |
| --- | --- | :---: | --- | --- | --- | --- |
| [**cmdk**](https://www.npmjs.com/package/cmdk) | React only | ✅ unstyled | Strong — combobox/listbox roles, used by shadcn/ui `Command` | Yes — v1.1.1 (Mar 2025) | Deep: composable groups, built-in fuzzy scoring, async loading states | The de-facto ⌘K. Powers shadcn/ui `Command` and Vercel. React-only. |
| [**kbar**](https://www.npmjs.com/package/kbar) | React only | ⚠️ partly styled | Keyboard-first; less ARIA-complete than cmdk | Slowing — `0.1.0-beta.x` for years | Action registry, nested actions, built-in shortcut binding | Different model: a global *action* registry, not a controlled list. Still beta. |
| [**react-command-palette**](https://www.npmjs.com/package/react-command-palette) | React only | ⚠️ themed | WAI-ARIA compliant (its headline feature) | Sporadic — v0.22.2 (Jan 2026, first publish after a ~3-yr gap) | Fuzzy search via options; theming presets | Older, theme-driven; largely superseded by cmdk in practice. |
| [**vue-command-palette**](https://www.npmjs.com/package/vue-command-palette) | Vue 3 only | ✅ unstyled | Combobox-style; less documented than cmdk | Stale — v0.2.3, last publish ~3 yr ago | Composable, cmdk-inspired; BYO filtering/scoring | A community port of cmdk's *ideas* to Vue. Vue-only. |
| [**cmdk-sv**](https://www.npmjs.com/package/cmdk-sv) | Svelte only | ✅ unstyled | Combobox/listbox roles | **Deprecated** — folded into Bits UI `Command` | cmdk-parity scoring + groups | Officially deprecated in favour of [Bits UI `Command`](https://bits-ui.com/docs/components/command). |
| [**svelte-command-palette**](https://www.npmjs.com/package/svelte-command-palette) | Svelte only | ⚠️ themed | Keyboard-driven; modest ARIA | Sporadic (v2.0.2, Jan 2026) | Action-list model + shortcut binding | Svelte-only; closer to kbar's action model than cmdk's. |
| Angular CDK `Dialog` + `Listbox` | Angular only | ✅ primitives | Strong if assembled correctly | Yes (Angular CDK) | You assemble it — filtering/scoring is yours to write | No dominant Angular command palette; usually hand-assembled from CDK primitives. |
| [**ninja-keys**](https://github.com/ssleptsov/ninja-keys) | Web component (HTML/Vue/React/Svelte) | ❌ styled element | Keyboard nav; not a documented APG-grade a11y story | Low activity — no GitHub releases, ~2023-era | Nested menus, hotkeys, theming, root search | Cross-framework, but a *styled* `<ninja-keys>` element you configure via a `data` array — a different authoring model. |
| [Algolia **DocSearch**](https://docsearch.algolia.com/) | Any (drop-in widget) | ❌ hosted widget | Good, but a search box, not a command runner | Yes (v5) | Crawls + indexes your docs; instant search | Adjacent category: ⌘K *site search*, not an app *command* menu. Hosted Algolia index. |
| **`@rozie-ui/command-palette`** | React, Vue, Svelte, Angular, Solid, Lit | ✅ headless | WAI-ARIA dialog + combobox + listbox/option, `aria-activedescendant` | New — pre-1.0 | Deep: fuzzy ranking + highlighting (pluggable `score`), nested levels with async sources, auto-derived groups, per-row action menus, inline command arguments, a `defaultItems` home view, an escapable `appendTo` overlay | Same API, six idiomatic packages. |

## The core gap

The dominant command palette, **cmdk**, is React-only. Everything else in the table is either single-framework (`kbar`, `vue-command-palette`, `svelte-command-palette`, the Angular CDK assembly), a community port that diverges in API and accessibility (`vue-command-palette` reinterprets cmdk for Vue; `cmdk-sv` ported it to Svelte and is **now deprecated** in favour of Bits UI's `Command`), or a cross-framework option with a fundamentally different authoring model (`ninja-keys` is a *styled* web component configured through a JS `data` array, not a headless primitive you compose).

So a design system that ships React, Vue, Svelte, and Angular wrappers today maintains three or four different command-menu integrations (different props, different filtering models, different accessibility quality) that must somehow stay behaviorally in lockstep. For that team, `@rozie-ui/command-palette` replaces them all: one WAI-ARIA command-menu behavior to maintain, and the same idiomatic `<CommandPalette>` on all six targets.

## What `@rozie-ui/command-palette` gives you

- **Six idiomatic packages, one API.** Install `@rozie-ui/command-palette-{react,vue,svelte,angular,solid,lit}` for your framework; there is no Rozie toolchain or build step for the consumer, and the surface is identical across all six.
- **The same accessibility everywhere.** A `role="dialog"` `aria-modal` overlay, an `<input role="combobox" aria-autocomplete="list" aria-expanded aria-controls aria-activedescendant>` search field, a `role="listbox"` of `role="option"` results with `aria-selected` / `aria-disabled`, a roving highlight tracked via `aria-activedescendant` while DOM focus stays on the input, Enter-to-select, Escape / backdrop to dismiss: the WAI-ARIA APG combobox-with-listbox pattern, identical across targets.
- **Idiomatic two-way state.** Two `model: true` slices, `open` (visibility) and `query` (search text), bound with `r-model:open` / `v-model:open` / `bind:open` / `[(open)]` and likewise for `query`. No per-framework controlled/uncontrolled glue. (Because there are *two* models, the Angular output deliberately ships no `ControlValueAccessor`; a palette is not a single form value.)
- **Scoped slots.** Twelve of them, ordinary scoped slots on every target: `option` (custom row render, scoped with <span v-pre>`{ option, index, active, selected, disabled }`</span>, the option-slot vocabulary shared with `@rozie-ui/listbox`) plus its `icon` / `trailing` / `actions` row sub-slots, `groupHeading` (section headings), `actionItem` (rows of the per-row action menu), `argsField` (rows of the inline command-args form), the `empty` / `loading` / `error` state slots, `breadcrumb` (the nested-level header), and `footer` (a persistent footer bar). See the [API reference](/components/command-palette-api) for scopes.
- **An imperative handle.** `show()` / `close()` / `toggle()` / `focus()` plus `openTo(path)` (deep-link straight into a nested level) and `goBack()` (pop one level), obtained through each framework's native ref mechanism. (The open verb is `show`, not `open`, because an `open()` verb would collide with the `open` model.)
- **Inline command arguments.** A command declares `args: [{ id, placeholder?, required?, default? }]` and selecting it auto-enters a panel-internal args form, with no separate "prompt" component and no manual state machine. `select`'s payload additively gains `args: { [id]: value }` (trimmed), argless commands are unaffected. cmdk/kbar have no built-in equivalent; you would hand-roll the sub-flow yourself.
- **A web-component build.** The Lit leaf gives plain-HTML / web-component consumers a real `<rozie-command-palette>` element with the *same* headless ARIA behavior. This is the one tier where the only real off-the-shelf option, `ninja-keys`, is a pre-styled element rather than a headless primitive.
- **Token-themed.** Every visual value is a `--rozie-command-palette-*` CSS custom property with a fallback; shadcn/ui, Material 3, and Bootstrap 5 theme bridges ship in the box.

## When a competitor is the better pick

- **A React-only app that wants maximum maturity → consider cmdk.** Rozie now matches cmdk on the headline features: fuzzy scoring (with a pluggable `score` hook), auto-derived group headings, async loading states, and per-row action menus are all built in. cmdk's remaining edge is maturity (it powers shadcn/ui's `Command` and Vercel) and a fully composable JSX group/item API (Rozie derives groups from the items' `group` field rather than letting you compose arbitrary section markup). If you will only ever ship React and prize the most battle-tested option, cmdk is still a safe pick; Rozie's pitch is that same feature set with cross-framework parity.
- **A Svelte-only app → use Bits UI `Command`.** With `cmdk-sv` deprecated, [Bits UI's `Command`](https://bits-ui.com/docs/components/command) is the maintained Svelte option, with a built-in scoring algorithm, `Command.Group` headings, and loading/empty states.
- **A Vue-only app → Headless UI's combobox or `vue-command-palette`** are reasonable, framework-native picks.
- **You only need site/docs search → use Algolia DocSearch.** DocSearch is a different category (a hosted, crawled ⌘K *search* widget), but if "⌘K" for you means "search my documentation," it is the purpose-built tool, not an app command runner.

The case for Rozie is consistency and coverage, not feature maximalism: no other accessible command palette spans all six frameworks with the same API, and Lit / web components and Solid in particular have essentially no headless incumbent at all.

## What it deliberately does not do (v1) {#scope-limits}

- **The built-in scorer is intentionally simple.** Fuzzy-subsequence ranking + highlighting is built in (label weighted above `keywords`, ranked by match strength), but the default algorithm is deliberately lightweight, not a full fzf-grade engine. For exotic ranking, the pluggable `score` prop (<span v-pre>`(item, query) => number | null`</span>) hands you complete control (custom weighting, recency/frecency boosts, exclusion).
- **Groups are data-derived, not composable.** Commands sharing a `group` field render as labeled sections automatically (headings overridable via the `groupHeading` slot, cappable per-section via `groupCap` with an expand-in-place "+N more" row, and `groupCap` composes with per-row `actions`), but there is no cmdk-`Command.Group`-style composable section API and no sticky headings.
- **Async data is a first-class level source.** A nested level's `source` may return a `Promise`: the palette shows the `loading` slot while it resolves, drops stale in-flight results (race-safe), debounces refetch via `searchDebounce`, and shows the `error` slot with a `retry` on rejection, with no need to hand-drive it through `items`.
- **It does not own a global keyboard shortcut.** Bind ⌘K / Ctrl-K yourself and call `show()` (or set the `open` model). cmdk, kbar, and ninja-keys variously help with this; Rozie stays unopinionated about how the palette is summoned.
- **It is self-contained, not composed from the listbox family.** The results list is authored inline (scoped slots + roving nav), not by composing the published `@rozie-ui/listbox` package; cross-family composition of published leaves isn't expressible in the compiler today. The accessibility primitives are the same; the implementation is just not a dependency on another leaf.
- **`@rozie-ui/command-palette` is pre-1.0.** The surface is stable and gate-verified across all six targets, but it is far younger and less battle-tested than cmdk. The full prop, event, handle, and slot tables live in the [API reference](/components/command-palette-api).

## Try it

- [**Command palette — showcase**](/components/command-palette) — what it is, the quick start, how the overlay / filter / keyboard model work, and the accessibility reference.
- [**Command palette — API reference**](/components/command-palette-api) — the full prop / model / event / handle / slot surface.
- [**Command palette — live demo**](/components/command-palette-demo) — the real package running in the page, plus the one `.rozie` source and its six generated outputs.
- [All `@rozie-ui` components](/components/) — the rest of the headless family.
- [`CommandPalette.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/command-palette/src/CommandPalette.rozie)
