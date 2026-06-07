# CodeMirror libraries comparison

How `@rozie-ui/codemirror` compares to the existing per-framework CodeMirror 6 wrappers. CodeMirror 6's engine (`@codemirror/state` + `@codemirror/view`) is framework-agnostic and mounts anywhere — every wrapper exists only to shuttle a `value` through the `EditorView`/`EditorState` API, forward changes back out, and reconcile prop changes. The ecosystem is **healthier than most vanilla-engine ecosystems** — React, Vue, Svelte, and Solid all have CM6 wrappers — but it still has two real holes (**Lit has no CM6 wrapper at all**, and **Angular's most-used wrapper is still CodeMirror *5***), a stale-but-popular Vue option, and no uniform cross-framework surface. Rozie ships one source to all six.

> Research snapshot: 2026-06-07. Versions and download counts move; treat them as of that date. Weekly-download figures are an npm snapshot for the window 2026-05-27→06-02.

## The wrappers at a glance

| Wrapper | Package | Engine | Latest | Weekly downloads | Maintainer | Key capability |
| --- | --- | :---: | --- | --- | --- | --- |
| **React** (de-facto) | `@uiw/react-codemirror` | **CM6** | 4.25.9 | ~3.38M | uiwjs (jaywcjlove) | Batteries-included `basicSetup`, theme prop, langs/themes catalogs |
| **Vue** (community) | `vue-codemirror` | **CM6** | 6.1.1 | ~102k | surmon-china | `v-model`, but last published 2022 (~3 yr stale) |
| **Vue** (maintained alt) | `vue-codemirror6` | **CM6** | 1.3.x | ~61k | logue | More current; Vue 2 + 3 |
| **Angular** (dominant) | `@ctrl/ngx-codemirror` | **CM5** ⚠️ | 7.0.0 | ~37k | scttcper | CVA / `ngModel` — but CodeMirror **5**, not 6 |
| **Angular** (CM6, niche) | `@fsegurai/ngx-codemirror` | **CM6** | 20.0.0 | ~0.8k | fsegurai | CM6 on Angular, but tiny adoption |
| **Svelte** (community) | `svelte-codemirror-editor` | **CM6** | 2.1.0 | ~23.5k | touchifyapp | `bind:value`, **Svelte 5** (peer `^5`) |
| **Solid** (community) | `solid-codemirror` | **CM6** | 2.3.2 | ~1.3k | riccardoperra | Reactive *primitives* (you compose the editor) |
| **Lit** | — | — | — | — | — | ❌ no maintained CM6 wrapper exists |
| **Rozie** | `@rozie-ui/codemirror-*` | **CM6** | 0.1.0 | — | One Learning Community | One source → six idiomatic packages |

The wedge here is narrower than the TipTap or FullCalendar story — most frameworks *do* have a CM6 wrapper — but it is real on three fronts: **Lit (no wrapper at all)**, **Angular (the dominant `@ctrl/ngx-codemirror`, ~37k/wk, is still CodeMirror 5 — moving to CM6 means switching to a niche package with <1k/wk)**, and **Vue (the most-downloaded `vue-codemirror` hasn't shipped since 2022; the maintained path is the lesser-known `vue-codemirror6`)**. Solid's `solid-codemirror` is a *primitives* toolkit rather than a turnkey component. Above all, none of them offers the *same* surface across frameworks.

## Feature matrix

| Capability | `@uiw/react-codemirror` | `vue-codemirror` | `@ctrl/ngx-codemirror` | `svelte-codemirror-editor` | `solid-codemirror` | Lit (none) | **`@rozie-ui/codemirror`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Mount editor | ✅ | ✅ | ✅ | ✅ | ✅ | hand-roll | ✅ |
| **CodeMirror 6 engine** (not CM5) | ✅ | ✅ | ❌¹ | ✅ | ✅ | hand-roll | ✅ |
| **Controlled two-way value** | ✅ (`value`/`onChange`) | ✅ (`v-model`) | ✅ (CVA / `ngModel`) | ✅ (`bind:value`) | ~² | hand-roll | ✅ `r-model:value` (+ Angular CVA) |
| `extensions` passthrough | ✅ | ✅ | ~ (CM5 options) | ✅ | ✅ | hand-roll | ✅ (composed last) |
| **`basicSetup` batteries toggle** | ✅ | ~ | ❌ (CM5) | ~ | ~ | hand-roll | ✅ `basicSetup` prop |
| **Theme-extension prop** (not just preset strings) | ✅ (`theme` + catalog) | ~ | ❌ | ~ | ~ | hand-roll | ✅ `theme` accepts an `Extension` |
| Imperative `EditorView` handle | ✅ (ref) | ✅ (ref) | ~ (directive) | ~ | ~³ | hand-roll | ✅ 8-verb `$expose` |
| Per-prop runtime reconfigure (Compartments, no remount) | ~⁴ | ~⁴ | ~⁴ | ~⁴ | ~⁴ | hand-roll | ✅ |
| **Framework-native panel slot** (`showPanel`) | ❌ | ❌ | ❌ | ❌ | ❌ | hand-roll | ✅ `panel` portal slot |
| Latest-framework support | React 19 | Vue 3 | Angular ≤ 21 | **Svelte 5** | Solid 1.x | — | R18+/V3.4+/Sv5/Ng19+/Solid/Lit |
| SSR-safe by construction | ~⁵ | ~⁵ | ⚠️ client-only | ~⁵ | ~⁵ | — | ✅⁶ |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

¹ **The dominant Angular wrapper is CodeMirror 5.** `@ctrl/ngx-codemirror` (~37k/wk, the most-used Angular binding) declares `codemirror@^5` — it is *not* CodeMirror 6. CM6 on Angular means switching to a niche alternative: `@fsegurai/ngx-codemirror` (CM6, ~0.8k/wk) or `@ks89/ngx-codemirror6` (~0.2k/wk). The mainstream Angular path is still CM5. **Rozie's Angular target is CM6 like every other Rozie target.**

² **`solid-codemirror` is a primitives library**, not a turnkey component — `createCodeMirror` + `createEditorControlledValue` give you the building blocks and you wire the value loop yourself. Rozie's Solid leaf is a drop-in `value`/`onValueChange` component.

³ `solid-codemirror` surfaces the `EditorView` via its `onEditorMount` / ref primitive rather than a method handle; `svelte-codemirror-editor` exposes the view less directly. Rozie gives every target the *same* 8-verb handle (`getView` / `focus` / `getValue` / `replaceValue` / `dispatch` / `insertText` / `getSelection` / `setSelection`).

⁴ **Runtime reconfigure varies and is mostly the consumer's job.** These wrappers either re-create the editor on prop change or require you to pass a memoized `extensions`/`basicSetup` (the `@uiw/react-codemirror` README calls out memoizing `extensions` to avoid churn). Rozie wires each curated prop (`language` / `theme` / `readOnly` / `placeholder` / `extensions` / `panel`) to its own CodeMirror `Compartment`, so a prop change dispatches a `reconfigure` with **no remount** — cursor, history, and scroll position are preserved — uniformly on all six.

⁵ SSR is achievable but the consumer guards client-only mount themselves. ⁶ Rozie instantiates the engine inside the mount hook only (no top-level DOM), so it is SSR-safe by construction.

## Where Rozie wins today

- **One definition, six idiomatic packages** — including the two frameworks the ecosystem underserves: **Lit (no CM6 wrapper exists at all)** and **Solid (a primitives toolkit, ~1.3k/wk, where you compose the editor yourself)**. A Lit dev today hand-rolls everything; a Solid dev wires the value loop and view access by hand.
- **A current CodeMirror 6 baseline on Angular** — where the most-used Angular wrapper (`@ctrl/ngx-codemirror`, ~37k/wk) is still **CodeMirror 5**, and CM6 otherwise means adopting a sub-1k/wk niche package. Rozie's `@rozie-ui/codemirror-angular` is CM6, standalone, and signals-era like every other Rozie Angular leaf.
- **Controlled two-way `value`** out of the box on all six, with a shared **echo-guard** (`suppressEmit` + a `current === next` short-circuit) so a programmatic or prop-driven set never ping-pongs back through the model path or mints a duplicate undo entry — the thing every engine-mediated two-way binding has to solve.
- **A uniform 8-verb imperative handle** (`$expose`) with the same shape on every target — versus "hold the `EditorView` you happened to construct," which differs per framework (a React ref, a Vue ref, a directive input, a Solid mount callback). `getView()` is always the raw-engine escape hatch.
- **A framework-native `panel` slot** mounted through CodeMirror's [`showPanel`](https://codemirror.net/docs/ref/#view.showPanel) facet — the status-bar idiom — on all six. **No competitor ships a framework-native panel/status-bar slot**; on every one of them a panel means hand-writing a `showPanel` extension whose DOM lives outside the framework's rendering model. Rozie surfaces it as one guarded portal slot (React/Solid render-prop, Vue scoped-slot, Svelte snippet, Angular `ng-template`, Lit slot bridge), fed the live `view`.
- **Per-prop Compartment reconfigure, applied uniformly** — `language` / `theme` / `readOnly` / `placeholder` / `extensions` reconfigure live with no remount on all six, where the standalone wrappers leave reconcile per-wrapper and often to the consumer.

## Gap status — what shipped, what's still deferred

This page concedes where the standalone wrappers are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

| Gap | Who has it | Severity | Rozie status |
| --- | --- | --- | --- |
| **G1 — `basicSetup`-style batteries** (autocomplete, search, bracket matching, code folding, lint gutter) | `@uiw/react-codemirror` (`basicSetup`/`minimalSetup`) and most | **Medium** | **✅ SHIPPED** — a `basicSetup` boolean prop (default `false`, so the thin baseline stays the default) swaps the manual baseline for CodeMirror 6's `basicSetup` bundle (autocomplete, search, bracket matching, code folding, lint gutter, richer keymaps). The curated props and `:extensions` still compose **after** it, so they keep winning. Construction-time only (no compartment) — toggling it live requires a remount. |
| G2 — Broad bundled language set | `@uiw` (`@uiw/codemirror-extensions-langs`), `@ctrl/ngx` (`mode`) | Medium | **⏳ Deferred** — only `@codemirror/lang-javascript` is bundled; the `language` prop falls back to plain text for any other value. Arbitrary `LanguageSupport` works **today** via `:extensions`. |
| G3 — Full theme-extension prop | `@uiw` (`theme` prop + `@uiw/codemirror-themes` catalog) | Low–Medium | **✅ SHIPPED** — the `theme` prop now accepts the built-in strings `"light"`/`"dark"` **or** an arbitrary CodeMirror `Extension` / `Extension[]` passed straight through (`@uiw/codemirror-themes`, an `EditorView.theme({…})`, any theme extension). A non-string theme reconfigures live via the existing `themeCompartment` — no remount. Custom themes also still work through `:extensions`. |
| G4 — Change / focus / blur events | `@uiw` (`onChange`/`onUpdate`/`onFocus`/`onBlur`/`onStatistics`), `@ctrl/ngx` | Low | **⏳ Deferred (by design)** — `0` emits; the two-way `value` *is* the change channel (an extra `@change` would race the model path and re-introduce echo loops). Lower-level signals reach through `getView()` + a custom `updateListener` via `:extensions`. |
| G5 — Additional injection surfaces (extra panels, tooltips, gutter markers, decorations) | (none turnkey — future parity) | Low | **⏳ Deferred** — exactly one portal slot ships (`panel`, via `showPanel`), proving the extension-mounted-injection pattern. Other CM6 injection points reach through a custom extension passed via `:extensions`. |

## Honest caveats

- **The default baseline is intentionally thin — but `basicSetup` is one prop away.** By default Rozie ships one language (JavaScript), one dark theme (`oneDark`), and a fixed keymap (default + history). Flip the `basicSetup` prop and you get CodeMirror 6's batteries-included bundle (autocomplete, search, fold, bracket matching, lint gutter, richer keymaps) — parity with `@uiw/react-codemirror`'s `basicSetup`. The *default* stays thin (so existing consumers are unchanged and the surface is the curated-vs-long-tail seam), and anything beyond the bundle still composes through `:extensions`.
- **The dominant single-framework wrapper is excellent.** `@uiw/react-codemirror` (~3.38M/wk) is a deep, mature, batteries-included React library; for a single-React app it is the obvious pick. Rozie's value is the *uniform cross-framework surface* plus reach into **Lit (empty)**, **Angular-on-CM6 (niche)**, and **Solid (primitives-only)** — not "better than `@uiw`."
- **`@rozie-ui/codemirror` is `0.1.0`.** The surface (8 props / 0 events / 8-verb `$expose` handle / one `panel` portal slot) is stable and gate-verified, but it is younger than the multi-year community wrappers.
- **One panel slot is the only injection surface in v1.** CodeMirror has many extension-mounted injection points (tooltips, gutter markers, decorations); v1 proves the pattern with one (`panel`). Broader injection surfaces are a future parity expansion (G5).

## Cross-references

- [CodeMirror — showcase & API](/guide/codemirror) — the full `@rozie-ui/codemirror` surface, per-framework quick starts, the imperative handle, and the `panel` slot recipe.
- [`CodeMirror.rozie` source](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/codemirror/src/CodeMirror.rozie)
- [The portal-slot primitive](/examples/portal-list) — the mechanism the `panel` slot builds on.
