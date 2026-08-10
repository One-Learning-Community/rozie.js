---
surface_hash: 828323b8b2e9
---

# CodeMirror libraries comparison

How `@rozie-ui/codemirror` compares to the existing per-framework CodeMirror 6 wrappers. CodeMirror 6's engine (`@codemirror/state` + `@codemirror/view`) is framework-agnostic and mounts anywhere; every wrapper exists only to shuttle a `value` through the `EditorView`/`EditorState` API, forward changes back out, and reconcile prop changes. The ecosystem is healthier than most vanilla-engine ecosystems (React, Vue, Svelte, and Solid all have CM6 wrappers), but it still has two real holes: Lit has no CM6 wrapper at all, and Angular's most-used wrapper is still CodeMirror 5. Add a stale-but-popular Vue option, and no two wrappers share a surface. Rozie ships the same `<CodeMirror>` component, with the same props, events, two-way `value`, and imperative handle, to all six frameworks, as pre-compiled per-framework packages with no Rozie toolchain required.

> Research snapshot: 2026-06-07. Versions and download counts move; treat them as of that date. Weekly-download figures are an npm snapshot for the window 2026-05-27→06-02.

## The wrappers at a glance

| Wrapper | Package | Engine | Latest | Weekly downloads | Maintainer | Key capability |
| --- | --- | :---: | --- | --- | --- | --- |
| **React** (de-facto) | `@uiw/react-codemirror` | **CM6** | 4.25.9 | ~3.38M | uiwjs (jaywcjlove) | Batteries-included `basicSetup`, theme prop, langs/themes catalogs |
| **Vue** (community) | `vue-codemirror` | **CM6** | 6.1.1 | ~102k | surmon-china | `v-model`, but last published 2022 (~3 yr stale) |
| **Vue** (maintained alt) | `vue-codemirror6` | **CM6** | 1.3.x | ~61k | logue | More current; Vue 2 + 3 |
| **Angular** (dominant) | `@ctrl/ngx-codemirror` | **CM5** ⚠️ | 7.0.0 | ~37k | scttcper | CVA / `ngModel`, but CodeMirror **5**, not 6 |
| **Angular** (CM6, niche) | `@fsegurai/ngx-codemirror` | **CM6** | 20.0.0 | ~0.8k | fsegurai | CM6 on Angular, but tiny adoption |
| **Svelte** (community) | `svelte-codemirror-editor` | **CM6** | 2.1.0 | ~23.5k | touchifyapp | `bind:value`, **Svelte 5** (peer `^5`) |
| **Solid** (community) | `solid-codemirror` | **CM6** | 2.3.2 | ~1.3k | riccardoperra | Reactive *primitives* (you compose the editor) |
| **Lit** | — | — | — | — | — | ❌ no maintained CM6 wrapper exists |
| **Rozie** | `@rozie-ui/codemirror-*` | **CM6** | pre-1.0 | — | One Learning Community | Same API, six idiomatic packages |

The case for Rozie is narrower here than in the TipTap or FullCalendar landscape, since most frameworks do have a CM6 wrapper, but it is real on three fronts. Lit has no wrapper at all. On Angular, the dominant `@ctrl/ngx-codemirror` (~37k/wk) is still CodeMirror 5, and moving to CM6 means switching to a niche package with <1k/wk. On Vue, the most-downloaded `vue-codemirror` hasn't shipped since 2022; the maintained path is the lesser-known `vue-codemirror6`. Solid's `solid-codemirror` is a *primitives* toolkit rather than a turnkey component. And none of them offers the same surface across frameworks.

## Feature matrix

| Capability | `@uiw/react-codemirror` | `vue-codemirror` | `@ctrl/ngx-codemirror` | `svelte-codemirror-editor` | `solid-codemirror` | Lit (none) | **`@rozie-ui/codemirror`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Mount editor | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| **CodeMirror 6 engine** (not CM5) | ✅ | ✅ | ❌¹ | ✅ | ✅ | hand-roll | ✅ |
| **Controlled two-way value** | ✅ (`value`/`onChange`) | ✅ (`v-model`) | ✅ (CVA / `ngModel`) | ✅ (`bind:value`) | ~² | hand-roll | ✅ `r-model:value` (+ Angular CVA) |
| `extensions` passthrough | ✅ | ✅ | ~ (CM5 options) | ✅ | ✅ | hand-roll | ✅ (composed last) |
| **`basicSetup` batteries toggle** | ✅ | ~ | ❌ (CM5) | ~ | ~ | hand-roll | ✅ `basicSetup` prop |
| **Theme-extension prop** (not just preset strings) | ✅ (`theme` + catalog) | ~ | ❌ | ~ | ~ | hand-roll | ✅ `theme` accepts an `Extension` |
| Imperative `EditorView` handle | ✅ (ref) | ✅ (ref) | ~ (directive) | ~ | ~³ | hand-roll | ✅ uniform `$expose` handle |
| Per-prop runtime reconfigure (Compartments, no remount) | ~⁴ | ~⁴ | ~⁴ | ~⁴ | ~⁴ | hand-roll | ✅ |
| **Framework-native injection slots** (`showPanel` / `showTooltip` / gutter / decorations) | ❌ | ❌ | ❌ | ❌ | ❌ | hand-roll | ✅ 5 portal slots |
| Latest-framework support | React 19 | Vue 3 | Angular ≤ 21 | **Svelte 5** | Solid 1.x | — | R18+/V3.4+/Sv5/Ng19+/Solid/Lit |
| SSR-safe by construction | ~⁵ | ~⁵ | ⚠️ client-only | ~⁵ | ~⁵ | — | ✅⁶ |
| Same API on all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

¹ **The dominant Angular wrapper is CodeMirror 5.** `@ctrl/ngx-codemirror` (~37k/wk, the most-used Angular binding) declares `codemirror@^5`; it is not CodeMirror 6. CM6 on Angular means switching to a niche alternative: `@fsegurai/ngx-codemirror` (CM6, ~0.8k/wk) or `@ks89/ngx-codemirror6` (~0.2k/wk). The mainstream Angular path is still CM5. Rozie's Angular target is CM6 like every other Rozie target.

² **`solid-codemirror` is a primitives library**, not a turnkey component: `createCodeMirror` + `createEditorControlledValue` give you the building blocks and you wire the value loop yourself. Rozie's Solid leaf is a drop-in `value`/`onValueChange` component.

³ `solid-codemirror` surfaces the `EditorView` via its `onEditorMount` / ref primitive rather than a method handle; `svelte-codemirror-editor` exposes the view less directly. Rozie gives every target the *same* handle (`getView` / `focus` / `getValue` / `replaceValue` / `dispatch` / `insertText` / `getSelection` / `setSelection` / `undo` / `redo` / `selectAll` / `scrollToPos`).

⁴ **Runtime reconfigure varies and is mostly the consumer's job.** These wrappers either re-create the editor on prop change or require you to pass a memoized `extensions`/`basicSetup` (the `@uiw/react-codemirror` README calls out memoizing `extensions` to avoid churn). Rozie wires each curated prop (`language` / `theme` / `readOnly` / `placeholder` / `extensions` / `basicSetup` / `gutterLines` / `decorations`) to its own CodeMirror `Compartment`, so a prop change dispatches a `reconfigure` with no remount. Cursor, history, and scroll position are preserved, uniformly on all six.

⁵ SSR is achievable but the consumer guards client-only mount themselves. ⁶ Rozie instantiates the engine inside the mount hook only (no top-level DOM), so it is SSR-safe by construction.

## Where Rozie wins today

- **First-class packages for all six frameworks** — including the two the ecosystem underserves: **Lit** (no CM6 wrapper exists at all) and **Solid** (a primitives toolkit, ~1.3k/wk, where you compose the editor yourself). A Lit dev today hand-rolls everything; a Solid dev wires the value loop and view access by hand.
- **The same editor surface everywhere.** One set of props, events, and handle verbs to learn, document, and migrate across your stack, instead of a different wrapper API per framework.
- **A current CodeMirror 6 baseline on Angular**, where the most-used Angular wrapper (`@ctrl/ngx-codemirror`, ~37k/wk) is still CodeMirror 5 and CM6 otherwise means adopting a sub-1k/wk niche package. Rozie's `@rozie-ui/codemirror-angular` is CM6, standalone, and signals-era like every other Rozie Angular leaf.
- **Controlled two-way `value`** out of the box on all six, with a shared echo-guard (`suppressEmit` + a `current === next` short-circuit) so a programmatic or prop-driven set never ping-pongs back through the model path or mints a duplicate undo entry. That is the thing every engine-mediated two-way binding has to solve.
- **A uniform imperative handle** (`$expose`) with the same shape on every target, versus "hold the `EditorView` you happened to construct," which differs per framework (a React ref, a Vue ref, a directive input, a Solid mount callback). `getView()` is always the raw-engine escape hatch.
- **Five framework-native injection slots** mounted through CodeMirror's extension facets: two `showPanel` status strips (`panel` / `topPanel`), a `showTooltip` caret tooltip (`tooltip`), a custom-gutter per-line marker (`gutter`), and inline widget decorations (`decoration`), on all six. No competitor ships any framework-native injection slot; on every one of them these mean hand-writing a `showPanel` / `showTooltip` / `gutter` / `Decoration` extension whose DOM lives outside the framework's rendering model. Rozie surfaces each as a guarded portal slot (React/Solid render-prop, Vue scoped-slot, Svelte snippet, Angular `ng-template`, Lit slot bridge), fed the live `view` plus per-slot scope. The reactive slots re-render in place; the reactive-multi-instance `gutter` / `decoration` mount one portal handle per visible marker/widget.
- **Per-prop Compartment reconfigure, applied uniformly.** `language` / `theme` / `readOnly` / `placeholder` / `extensions` / `basicSetup` reconfigure live with no remount on all six, where the standalone wrappers leave reconcile per-wrapper and often to the consumer.

Recently shipped: the `basicSetup` batteries toggle, importable [language presets](/components/codemirror#language-presets) via the `/languages` subpath (each a tree-shaking, ready-to-spread `Extension[]`), a `theme` prop that accepts any CodeMirror `Extension`, and the five injection portal slots.

## What Rozie defers

- **The default baseline is intentionally thin, and `basicSetup` is one prop away.** By default Rozie ships one language (JavaScript), one dark theme (`oneDark`), and a fixed keymap (default + history). Flip the `basicSetup` prop and you get CodeMirror 6's batteries-included bundle (autocomplete, search, fold, bracket matching, lint gutter, richer keymaps), parity with `@uiw/react-codemirror`'s `basicSetup`. The *default* stays thin so existing consumers are unchanged, and anything beyond the bundle still composes through `:extensions`.
- **No `change` / `focus` / `blur` events, by design.** The two-way `value` is the change channel; an extra `@change` would race the model path and re-introduce echo loops. Lower-level signals reach through `getView()` plus a custom `updateListener` via `:extensions`.
- **React depth on React.** `@uiw/react-codemirror` (~3.38M/wk) is a deep, mature, batteries-included React library; for a single-React app it is the obvious pick. Rozie's value is the uniform cross-framework surface plus reach into Lit (empty), Angular-on-CM6 (niche), and Solid (primitives-only).
- **Five injection slots cover the common CM6 surfaces.** `panel` + `topPanel` (status strips), `tooltip` (caret tooltip), `gutter` (per-line markers), and `decoration` (inline widgets) span the mount-once, reactive, and reactive-multi-instance patterns. Other CM6 injection points (block widgets, replace decorations, line decorations, atomic ranges) still reach through a custom extension passed via `:extensions`.
- **`@rozie-ui/codemirror` is pre-1.0** and younger than the multi-year community wrappers. The full surface is documented in the [showcase & API](/components/codemirror).

## Cross-references

- [CodeMirror — showcase & API](/components/codemirror) — the full `@rozie-ui/codemirror` surface, per-framework quick starts, the imperative handle, and the five injection-slot recipes.
- [`CodeMirror.rozie` source](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/codemirror/src/CodeMirror.rozie)
- [The portal-slot primitive](/examples/portal-list) — the mechanism the `panel` slot builds on.
