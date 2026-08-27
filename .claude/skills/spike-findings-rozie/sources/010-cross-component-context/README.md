---
spike: 010-cross-component-context
type: hand-written-target-output
status: IN PROGRESS
date: 2026-06-09
validates: >
  A cross-component context primitive ($provide / $inject) is expressible as
  compile-clean, runtime-correct per-target output across all 6 frameworks, with
  (a) cross-FILE key→token identity (provider and consumer are separately-emitted
  modules), (b) reactivity at depth (provider mutates → deep consumer updates),
  and (c) NO prop-drilling through an unaware passthrough. The contract the
  emitter surgery must produce — seeds the implementation phase the way Spike 002
  seeded 003.
depends_on: []
tags: [context, provide-inject, compound-components, cross-target, ir-design, declarative-children, maplibre-sources-layers, rete-nodes-handles]
---

# Spike 010 — cross-component context (`$provide` / `$inject`)

## Why

The single most-cited deferred Rozie gap (the [node-flow feasibility audit](../../research/node-flow-editor-feasibility.md) headline; MapLibre's `:sources`/`:layers` config-array workaround; the rete-comparison "what Rozie defers"). State sharing today is props-down / events-up / `$expose` / slots / `$portals` — there is **no provide/inject**, so deeply-nested children can't read shared parent state without prop-drilling. That blocks the entire **compound-component** category (Tabs/Tab, Select/Option, Accordion/Item, Form/Field, Table/Column …) and the declarative `<Node>`/`<Handle>` + `<Source>`/`<Layer>` authoring both shipped engine families route around.

This spike de-risks the **6-target lowering** before any compiler work — the feature is "a meaningful compiler primitive, not a quick wrapper feature."

## The fixture (the canonical compound-component context test)

Three SEPARATE components in three SEPARATE files (so cross-file token identity is exercised, not faked by a shared module):

- **`ThemeProvider`** — `$provide('theme', { color, cycle })` where `color` is reactive state and `cycle()` mutates it; renders its children/slot.
- **`Panel`** — a passthrough that renders children and **knows nothing about theme** (the no-prop-drilling proof).
- **`ThemedButton`** — `$inject('theme')`, displays `color`, a button calls `cycle()`.

Mounted `<ThemeProvider><Panel><ThemedButton/></Panel></ThemeProvider>`. Pass iff: the button shows the initial color (inject reached depth through the unaware `Panel`), AND clicking it cycles the color text (reactive at depth, round-trip through context).

## Proposed author API (Vue-dev-natural)

```rozie
<!-- ThemeProvider.rozie -->
<script>
let color = 'red'
const cycle = () => { color = NEXT[color] }
$provide('theme', { get color() { return color }, cycle })
</script>
<template><slot /></template>
```
```rozie
<!-- ThemedButton.rozie -->
<script>
const theme = $inject('theme')           // nearest provided 'theme', reactive
</script>
<template><button @click="theme.cycle()">{{ theme.color }}</button></template>
```

- `$provide(key, value)` — string `key`; `value` may be reactive (`$data` field, `$computed`, an object, an engine handle).
- `$inject(key, fallback?)` — returns the nearest provided value; reactive where the framework allows.
- Timing discipline (hypothesis, to confirm): usable in setup + template + reactive contexts; on Lit the value may be undefined until the provider responds (async context-request) → "possibly-null until connected" — the documented parity edge (the render-prop-slots of this feature).

## The crux: cross-FILE key → token identity

Provider and consumer are separately-emitted modules. How do they agree on the same context token for `'theme'`? **Hypothesis — it splits the six:**

| Target | Mechanism | Cross-file identity strategy |
|---|---|---|
| Vue | `provide(key, v)` / `inject(key)` | **native** — string key |
| Svelte 5 | `setContext(key, v)` / `getContext(key)` | **native** — string key (init-only) |
| Lit | `@lit/context` `createContext(Symbol.for('rozie:'+key))` + provider/consumer | **native** — `Symbol.for` global registry |
| React | `createContext` (identity-based object) | **runtime global registry** `rozieContext(key)` dedupes key → one context object both files import via the runtime helper |
| Solid | `createContext` + `<Provider>` | **runtime global registry** (same as React) |
| Angular | hierarchical DI `providers:[{provide: TOKEN}]` + `inject(TOKEN)` | **runtime global token registry** `rozieToken(key) ??= new InjectionToken(key)` |

So Vue/Svelte/Lit get cross-file identity for free from key/`Symbol.for`; React/Solid/Angular need a tiny runtime registry keyed by the author's string (emit `rozieContext(key)` / `rozieToken(key)` from `@rozie/runtime-<target>`). This is the central finding to PROVE runnable on React + Lit (the two trickiest), reason+typecheck the rest.

## Investigation trail

1. **`@lit/context` `createContext` is `(n) => n`** (verified in installed source — `function n(n){return n}`). It returns the key verbatim, so `createContext(Symbol.for('rozie:'+key))` yields the *same global symbol* in two separately-emitted files → cross-file identity for free. (My earlier hypothesis held — but it was worth checking, because if `createContext` minted an opaque object, Lit would have needed a registry like React.)
2. **No-build harness** (`harness/`, runtime render APIs, zero framework plugins) — React (`createElement`), Vue (`h`), Lit (`html`) each as three separately-"emitted" modules. `playwright test` → **3/3 pass.**
3. **Compiled harness** (`harness-compiled/`, `vite-plugin-solid` + `@sveltejs/vite-plugin-svelte` in one app — `.tsx` vs `.svelte`, no jsx conflict) — Solid + Svelte. **2/2 pass.**
4. **Angular** (`refs/angular/`) — hand-authored idiom **compile-checked clean against real `@angular/core` 19 types** (`tsc` exit 0, 0 errors). Runtime deferred to the phase (analogjs AOT cost; REQ-25 precedent), but the load-bearing **content-projection DI rule is settled by Angular's documented semantics**: a host component's `providers` ARE visible to projected (`ng-content`) descendants, while `viewProviders` are NOT — so the emitter must use `providers`.

Every harness uses the same fixture: `Provider > Panel(unaware passthrough) > deep Button`. PASS proves inject reached depth THROUGH the unaware Panel (no prop-drilling) AND the provided value is reactive (click → red→green→blue at depth). Lit additionally proves it **across three shadow boundaries** (each custom element has its own shadow root).

## Results

**VALIDATED.** Cross-component context is expressible compile-clean + runtime-correct on all six. **Runtime-proven 5/6** (React · Vue · Lit · Solid · Svelte — inject-at-depth + reactive round-trip + no-prop-drill); **Angular compile-checked + idiom + documented projection rule** (phase runtime-verifies first, per REQ-25).

| Target | provide → inject | cross-file identity | reactivity at depth | verdict |
|---|---|---|---|---|
| Vue | `provide('theme', v)` / `inject('theme')` | native string key | `ref` | ✅ runtime |
| Svelte 5 | `setContext('theme', v)` / `getContext('theme')` (init) | native string key | `$state` via getter | ✅ runtime |
| Lit | `@lit/context` provider/consumer, `createContext(Symbol.for('rozie:theme'))` | native `Symbol.for` | `ContextProvider.setValue` (async, crosses shadow) | ✅ runtime |
| React | `createContext` + `<Provider>` + `useContext` | **runtime registry** `rozieContext(key)` | `useMemo([value])` re-render | ✅ runtime |
| Solid | `createContext` + `<Provider>` + `useContext` | **runtime registry** `rozieContext(key)` | signal accessor in scope | ✅ runtime |
| Angular | `providers:[{provide: TOKEN, useFactory}]` + `inject(TOKEN)` | **runtime registry** `rozieToken(key)` (`InjectionToken`) | `signal()` in template | 🔶 compile-check + prior-art |

### Requirements (added to MANIFEST.md)

- **REQ-27 (API):** `$provide(key, value)` / `$inject(key, fallback?)`, string `key`, `value` may be reactive. `$inject` is reactive at depth and usable in setup + template + reactive contexts (NOT `$refs`-restricted) — except the Lit async edge (REQ-30).
- **REQ-28 (cross-file identity — the crux):** the per-target token-identity strategy splits the six. Vue/Svelte use the author's string key natively; Lit uses `createContext(Symbol.for('rozie:'+key))` (verified `createContext` is identity-on-key); React/Solid/Angular need a tiny **runtime global registry** keyed by the string (`rozieContext(key)` returning a deduped `createContext` object; `rozieToken(key)` returning a deduped `InjectionToken`) emitted from `@rozie/runtime-<target>`, because their tokens are identity-based, not key-based.
- **REQ-29 (reactivity):** provide a reactive value; consumers update at depth on all 6 (React Provider re-render via memo dep, Solid signal accessor, Vue `ref`, Svelte `$state` getter, Angular `signal`, Lit `ContextProvider.setValue`). Proven by the click → red→green→blue round-trip.
- **REQ-30 (Lit async edge — the parity divergence):** `@lit/context` `ContextConsumer` is event-driven/async — the injected value can be `undefined` on first paint until the `context-request` round-trip resolves. Emit a null-guard and document "possibly-null until connected" as the one parity edge (the render-prop-slots analog of this feature). Upside: it crosses shadow DOM, which the others don't need to.
- **REQ-31 (Angular projection + runtime-verify):** emit the token in `providers` NOT `viewProviders` (projected `ng-content` descendants resolve `providers`, never `viewProviders`). Angular is the FIRST-CLASS runtime-verification target for the implementation phase — verify content-projection injector resolution + signal reactivity in a real analogjs build before declaring the phase done (REQ-25 precedent).
- **REQ-32 (Svelte init timing):** `setContext`/`getContext` must run during component init; the emitted setup runs at init so it lands. Reactivity requires a `$state`-backed value (a getter returning `$state`, or a passed rune store).

### How to re-run

```
cd harness            && pnpm install --ignore-workspace --config.node-linker=hoisted && ./node_modules/.bin/vite build && ./node_modules/.bin/playwright test   # React/Vue/Lit
cd harness-compiled   && pnpm install --ignore-workspace --config.node-linker=hoisted && ./node_modules/.bin/vite build && ./node_modules/.bin/playwright test   # Solid/Svelte
# Angular compile-check: refs/angular + tsc -p tsconfig.check.json (paths→@angular/core)
```
(`node_modules`/`dist` are tidied after capture per CONVENTIONS.md; the commands recreate them.)
