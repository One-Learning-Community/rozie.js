---
surface_hash: 77272de177ad
---

# Lexical libraries comparison

How `@rozie-ui/lexical` compares to the existing per-framework Lexical wrappers. Lexical's editor core is framework-agnostic and mounts anywhere — every wrapper exists only to glue reactive state, register plugins, and bridge decorator nodes. The result is the **thinnest binding ecosystem of any major editor**: a first-party React package, a stale Vue and Solid story, a single-maintainer Svelte package, and **nothing for Angular or Lit**. Rozie ships one source to five targets today (Lit in v1.1).

> Research snapshot: 2026-07-18. Versions and download counts move; treat them as of that date.

## The wrappers at a glance

| Wrapper | Package | Maintainer | Status |
| --- | --- | --- | --- |
| **React** (official) | `@lexical/react` | Meta (first-party) | Healthy — the reference binding |
| **Vue** (community) | `lexical-vue` | wobsoriano | Stale — pinned many minors behind core |
| **Solid** (community) | `lexical-solid` | mosheduminer | Stale — tracks core slowly |
| **Svelte** (community) | `svelte-lexical` | umaranis | Capable but bus-factor-1 |
| **Angular** | — | — | **No maintained wrapper exists** |
| **Lit** | — | — | **No wrapper exists** |
| **Rozie** | `@rozie-ui/lexical-*` | One Learning Community | One source → 5 targets today (Lit v1.1) |

The wedge is strongest for **Angular and Lit (no wrapper at all)** and **Vue / Solid (stale, pinned behind core)**. The recurring failure mode across the ecosystem — "a thin React transliteration, pinned N versions behind" — is exactly what Rozie's single-source model counters: one `.rozie` source compiles to every target from the same pinned engine.

## Feature matrix

| Capability | `@lexical/react` | `lexical-vue` | `lexical-solid` | `svelte-lexical` | Angular (none) | Lit (none) | **`@rozie-ui/lexical`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Mount editor | ✅ | ✅ | ✅ | ✅ | hand-roll | hand-roll | ✅ |
| Shared editor context for children | ✅ | ✅ | ✅ | ✅ | hand-roll | hand-roll | ✅ `$inject('rozie-lexical-editor')` |
| RichText baseline | ✅ | ✅ | ✅ | ✅ | hand-roll | hand-roll | ✅ (shell + `RichTextPlugin`) |
| History (undo/redo) | ✅ | ✅ | ✅ | ✅ | hand-roll | hand-roll | ✅ `HistoryPlugin` |
| List plugin | ✅ | ✅ | ✅ | ✅ | hand-roll | hand-roll | ✅ `ListPlugin` |
| Link plugin | ✅ | ✅ | ✅ | ✅ | hand-roll | hand-roll | ✅ `LinkPlugin` |
| Selection-reading toolbar | build it yourself | build it yourself | build it yourself | ✅ (rich sample) | hand-roll | hand-roll | ✅ bidirectional `Toolbar` |
| Decorator-node component renderer | ✅ | ✅ | ✅ | ✅ | hand-roll | hand-roll | ✅ neutral-descriptor bridge (5 targets) |
| Tracks the latest Lexical core | ✅ | ⚠️ stale | ⚠️ stale | ✅ | — | — | ✅ pinned `0.48.0` lockstep |
| One source → many frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (5 today, Lit v1.1) |

## Where Rozie wins today

- **One definition, five idiomatic packages** — including the two frameworks the ecosystem leaves entirely unserved: **Angular (no wrapper)** and (in v1.1) **Lit (no wrapper)**. An Angular developer today hand-rolls the whole editor integration; Rozie gives them an idiomatic standalone component.
- **A shared-editor context** (`$inject('rozie-lexical-editor')`) with the same shape on every target — the extension seam custom plugins and the toolbar ride on, versus each framework's bespoke context/provider idiom.
- **A bidirectional selection-reading toolbar** out of the box on all five — buttons that both dispatch commands and reflect the caret's current formatting — where React/Vue/Solid consumers build it themselves.
- **A neutral-descriptor decorator bridge** proven end-to-end across five targets by the reference `@mention` node, plus an [authoring recipe](/components/lexical-recipe-decorator) for custom nodes.
- **Lockstep-pinned engine** — `lexical` + every `@lexical/*` subpackage at `0.48.0`, so the family never drifts behind core the way the community Vue/Solid wrappers have.

## Staging — v1.0 vs v1.1 {#staging-v1-0-vs-v1-1}

`@rozie-ui/lexical` ships in two stages, and the deferrals are explicit so nothing reads as a silent gap:

| Item | Stage |
| --- | --- |
| React / Vue / Svelte / Angular / Solid | **v1.0 (today)** |
| Editor shell + RichText / History / List / Link + toolbar + `@mention` decorator | **v1.0 (today)** |
| **Lit target + Lit decorator bridge** (browser floor Chrome 137+ / FF 142+ / Safari 17+) | **v1.1** |
| **Markdown-shortcuts plugin** | **v1.1** |
| **Tables plugin** | **v1.1** |

Lit is deferred, not dropped: it carries a documented browser-version floor and open-shadow-DOM verification obligations the other five targets don't. See the [decorator recipe's staging section](/components/lexical-recipe-decorator#roadmap-v1-1-staging) for the full Lit obligation list.

## Honest caveats

- **Five targets today, not six.** Lit is v1.1 (above). The comparison rows for Angular/Lit describe the *upstream* ecosystem (no wrapper); Rozie ships Angular in v1.0 and Lit in v1.1.
- **`@rozie-ui/lexical` is `0.1.0`.** The surface (the shell + four plugins + toolbar + one decorator node) is stable and gate-verified, but younger than the multi-year `@lexical/react`.
- **Deliberately unopinionated.** The toolbar and chips ship minimally styled by design (`theme` + your CSS is the styling path). This is the family ethos, not an omission — see the [scope & posture notes](/components/lexical#scope-posture).
- **No collaboration / no SSR hydration.** `@lexical/yjs` collaboration and server-rendered-document hydration are out of scope (the editor is import-safe under SSR, but there is no hydration path).

## Cross-references

- [Lexical — showcase & API](/components/lexical) — the full `@rozie-ui/lexical` surface, composition, and recipes.
- [`LexicalEditor.rozie` source](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/lexical/src/LexicalEditor.rozie)
- [Decorator node authoring recipe](/components/lexical-recipe-decorator) — the neutral-descriptor + per-target bridge pattern.
