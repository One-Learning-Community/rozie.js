---
surface_hash: 77272de177ad
---

# Lexical libraries comparison

How `@rozie-ui/lexical` compares to the existing per-framework Lexical wrappers. Lexical's editor core is framework-agnostic and mounts anywhere; every wrapper exists only to glue reactive state, register plugins, and bridge decorator nodes. The result is the thinnest binding ecosystem of any major editor: a first-party React package, a stale Vue and Solid story, a single-maintainer Svelte package, and nothing for Angular or Lit. Rozie delivers the same idiomatic editor component on all six targets, including the two the ecosystem leaves entirely unserved, Angular and Lit, as pre-compiled per-framework packages.

> Research snapshot: 2026-08-10. Versions and download counts move; treat them as of that date.

## The wrappers at a glance

| Wrapper | Package | Maintainer | Status |
| --- | --- | --- | --- |
| **React** (official) | `@lexical/react` | Meta (first-party) | Healthy — the reference binding |
| **Vue** (community) | `lexical-vue` | wobsoriano | Stale — pinned many minors behind core |
| **Solid** (community) | `lexical-solid` | mosheduminer | Stale — tracks core slowly |
| **Svelte** (community) | `svelte-lexical` | umaranis | Capable but bus-factor-1; actively published yet pins core months behind (0.40 vs 0.49) |
| **Angular** | — | — | **No maintained wrapper exists** |
| **Lit** | — | — | **No wrapper exists** |
| **Rozie** | `@rozie-ui/lexical-*` | One Learning Community | Same API on all 6 targets (incl. Angular + Lit) |

The case for Rozie is strongest for Angular and Lit (no wrapper at all) and Vue / Solid (stale, pinned behind core); even the actively-published Svelte package pins its `@lexical/*` dependencies several minors behind the current core. The recurring failure mode across the ecosystem, a thin React transliteration pinned N versions behind, is exactly what Rozie counters: every target ships from the same pinned engine, so no framework's package lags the others.

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
| Decorator-node component renderer | ✅ | ✅ | ✅ | ✅ | hand-roll | hand-roll | ✅ neutral-descriptor bridge (6 targets) |
| Tracks the latest Lexical core | ✅ | ⚠️ stale | ⚠️ stale | ⚠️ pins behind | — | — | ✅ engine pinned in lockstep |
| Same API on all 6 targets | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **First-class packages for all six frameworks**, including the two the ecosystem leaves entirely unserved: Angular (no wrapper) and Lit (no wrapper). An Angular or Lit developer today hand-rolls the whole editor integration; Rozie gives them an idiomatic standalone component / web component.
- **A shared-editor context** (`$inject('rozie-lexical-editor')`) with the same shape on every target: the extension seam custom plugins and the toolbar ride on, versus each framework's bespoke context/provider idiom.
- **A bidirectional selection-reading toolbar** out of the box on all six: buttons that both dispatch commands and reflect the caret's current formatting, where React/Vue/Solid consumers build it themselves.
- **A neutral-descriptor decorator bridge** proven end-to-end across six targets by the reference `@mention` node (including Lit through an open shadow root), plus an [authoring recipe](/components/lexical-recipe-decorator) for custom nodes.
- **Lockstep-pinned engine.** `lexical` and every `@lexical/*` subpackage are pinned to the same core version across all six packages, so the family never drifts behind core the way the community Vue/Solid/Svelte wrappers have.

## Staging — what ships today vs v1.1 {#staging-v1-0-vs-v1-1}

All six targets (including Lit) ship today; the staging table — what ships now versus what remains deferred to v1.1 (Markdown-shortcuts + Tables) — lives on the [showcase page's roadmap](/components/lexical#roadmap-staging).

## Scope limits

- **All six targets ship, but Lit carries a browser floor.** The Lit build requires Chrome 137+ / FF 142+ / Safari 17+ (`getComposedRanges` for cross-shadow selection); the other five have no such floor. The comparison rows for Angular/Lit describe the *upstream* ecosystem (no wrapper); Rozie ships both.
- **`@rozie-ui/lexical` is pre-1.0.** The surface (the shell + four plugins + toolbar + one decorator node) is stable and gate-verified, but the package is younger than the multi-year `@lexical/react`.
- **Deliberately unopinionated.** The toolbar and chips ship minimally styled by design (`theme` + your CSS is the styling path). This is the family ethos, not an omission; see the [scope & posture notes](/components/lexical#scope-posture).
- **No collaboration / no SSR hydration.** `@lexical/yjs` collaboration and server-rendered-document hydration are out of scope (the editor is import-safe under SSR, but there is no hydration path).

## Cross-references

- [Lexical — showcase & API](/components/lexical) — the full `@rozie-ui/lexical` surface, composition, and recipes.
- [`LexicalEditor.rozie` source](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/lexical/src/LexicalEditor.rozie)
- [Decorator node authoring recipe](/components/lexical-recipe-decorator) — the neutral-descriptor + per-target bridge pattern.
