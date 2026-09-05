# Roadmap: Rozie.js

## Overview

Rozie.js compiles a single Vue/Alpine-flavored `.rozie` source file to idiomatic React 18+, Vue 3.4+, Svelte 5+, and Angular 19+ component code, eliminating the manual cross-framework wrapper work that today dominates the maintenance budget of cross-framework UI libraries. The journey moves through seven phases: a load-bearing parser foundation that proves the `htmlparser2`-based block splitter is feasible, a high-leverage IR + semantic + reactivity gate that locks the framework-neutral primitives every emitter will consume, a Vue emitter that produces the first demoable artifact end-to-end, a React emitter that proves the auto-tracked-signals → `useEffect` dep-array machinery (the marquee technical claim), parallel Svelte and Angular emitters that exercise IR framework-neutrality, a CLI/Babel/type-emission distribution phase, and a final validation/hardening phase that ships the five reference examples + a Playwright cross-target visual regression suite + the public regression fixture surface. Throughout, the IR is designed to React's stricter constraints (so other targets relax from the canonical floor) but Vue is shipped first for demo velocity.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation Spike, Parser & AST** - Validate the htmlparser2-based block splitter via 3-day spike; ship `splitBlocks()` + block parsers + typed `RozieAST` with byte-accurate source locations; ship the modifier PEG grammar.
- [x] **Phase 2: Semantic Analysis, Reactivity Model & IR (Locked Gate)** - Lock `RozieIR` and the canonical `SlotDecl` shape with React's stricter constraints in mind; ship `ReactiveDepGraph`, semantic binding/validation, modifier registry, diagnostic codes (`ROZ001+`).
- [x] **Phase 3: Vue 3.4+ Target Emitter (First Demoable Artifact)** - Ship `@rozie/target-vue` + `@rozie/unplugin` (Vite path) + source maps + `console.log` preservation; first end-to-end demo: `import Counter from './Counter.rozie'` works in a Vue Vite project.
- [x] **Phase 4: React 18+ Target Emitter (Proves Dep-Graph & Locks Slot IR)** - Ship `@rozie/target-react` with statically-computed `useEffect` dep arrays, hybrid `useControllableState` for `model: true` props, lifted slot fallbacks, and the public modifier plugin API; CI-gate `eslint-plugin-react-hooks/exhaustive-deps`.
- [x] **Phase 5: Svelte 5 + Angular 17+ Target Emitters** - Ship `@rozie/target-svelte` (runes + snippets) and `@rozie/target-angular` (standalone signals + ng-template) in parallel; resolve the Angular/Vite virtual-filesystem spike (OQ3) before Angular emitter work begins.
- [x] **Phase 6: CLI Codegen, Babel Plugin & Type Emission Hardening** (2026-05-07) - Ship `@rozie/cli` + `@rozie/babel-plugin`, finalize `@rozie/core`'s public `compile()` API, emit `.d.ts` per target from the IR (not via `tsc`), and prove byte-identical output across all three entrypoints.
- [x] **Phase 06.1: Source map accuracy across all 4 targets (INSERTED)** - Rearchitect `buildShell` with MagicString.overwrite at splitBlocks byte offsets + switch `emitScript` to @babel/generator native `sourceMaps: true` per target + add SourceMapConsumer.originalPositionFor test per target. Closes DX-04 before Phase 7 validation runs. (completed 2026-05-07)
- [x] **Phase 06.2: Component composition + recursion (INSERTED)** - First-class `<components>` block + outer-name self-reference + `tagKind` IR discriminator + per-target emit (Vue/React/Svelte imports, Svelte self-import for recursion, Angular `imports[]` with `forwardRef`) + strict resolution diagnostics. Expand reference examples (one new recursive, one wrapper-composition demo) so Phase 7 validates composition. Closes COMP-01..06 before v1 ships. (completed 2026-05-07)
- [x] **Phase 06.3: Solid.js Target Emitter (INSERTED)** - Ship `@rozie/target-solid` + `@rozie/runtime-solid` + Solid branch in `@rozie/unplugin` + solid-vite consumer demo. Signals-native target with cleanest IR mapping (no dep-array gymnastics) — proves IR is target-agnostic before harder web-component audit in 06.4. Extends dist-parity to 5 targets. (completed 2026-05-07)
- [x] **Phase 06.4: Lit / Web Components Target Emitter (INSERTED)** - Ship `@rozie/target-lit` emitting Lit 3+ class-based custom elements with shadow-DOM-scoped CSS, native `<slot>`, and `dispatchEvent`-based two-way binding. Audits slot IR against web-component semantics. Strategically expands audience from framework wrapper authors to design-system authors. Extends dist-parity to 6 targets. (completed 2026-05-13)
- [x] **Phase 7: Validation, Acceptance & Hardening** - All eight reference examples compile correctly to all six targets (React/Vue/Svelte/Angular/Solid/Lit); Playwright cross-target visual regression suite; React StrictMode passes for every example; HMR state preservation verified; public regression fixture suite seeded. 6 × 8 = 48 outputs validated end-to-end. (completed 2026-05-14)
- [x] **Phase 07.1: Modifier Extension API — 6-Target Completion & Type-Identity Fix (INSERTED)** - Fix the `ModifierRegistry` `.d.ts` type-identity bug via an `@rozie/core` self-reference (target packages currently inline a private-class copy, breaking third-party authors who import it from `@rozie/core`); extend the modifier extension API from 4 to 6 targets by adding `solid?`/`lit?` methods to `ModifierImpl` plus `Solid`/`LitEmissionDescriptor` types and emitter wiring; extend the `tests/plugins/swipe` dogfood canary to exercise all 6 targets — proving the third-party modifier API is genuinely 6-target-complete. (completed 2026-05-14)
- [x] **Phase 07.2: Named & scoped slot consumer-side support (INSERTED)** - Close the composition gap left by Phase 06.2: producer-side slots (`<slot name="header" :close="close">`) already work end-to-end, but a `.rozie` consumer has no template syntax to *fill* named or scoped slots when using another Rozie component. Add consumer-side template grammar (Vue-flavored `<template #header>` / `<template #default="{ close }">`), extend `RozieIR` with a `SlotFillerDecl` shape, and emit per-target across all 6 frameworks (Vue native slots, Svelte 5 snippets, Solid children-as-function, Lit `<slot slot="...">`, Angular `ng-template`, React render-prop fallback — documented edge case). Dogfood gate: `examples/Modal.rozie` must be consumable from another `.rozie` file with both named (`header`/`footer`) and scoped (`:close="close"`) slot fills working across all 6 targets. (completed 2026-05-16 — SC4 accepted with documented consumer-side one-way binding divergence; full close-callback fix tracked as Phase 07.3)
- [x] **Phase 07.3: Consumer-side two-way binding (`r-model:propName=`) across 6 targets (INSERTED)** - Producer-side `model: true` already emits per-target two-way machinery (`defineModel`, `$bindable`, `useControllableState`, `model<T>()`, `createControllableSignal`, Lit custom-event pair) — verified by the 6 ModalConsumer dist-parity fixtures. But no consumer-side `.rozie` template directive engages it: every `:prop="$data.x"` compiles to one-way bind in all 6 targets, leaving the producer's two-way wiring inert from the consumer side. Add `r-model:propName="$data.x"` argument-form directive (parallel to existing form-input `r-model="$data.draft"`), per-target consumer-side emit (`v-model:open` / `bind:open` / `[(open)]` / `open={open} onOpenChange={setOpen}` / etc.), and propWriteValidator coverage. Dogfood: `examples/ModalConsumer.rozie` `r-model:open="$data.open"` un-fixmes the 4 close-spec cells (Svelte/React/Solid/Lit) gated by Phase 07.2 Plan 07.2-06.1. (completed 2026-05-16)
- [x] **Phase 07.3.1: Consumer-side composition hardening — close the 3 Phase 07.3 deferred blockers (INSERTED)** ✓ 2026-05-17 - Short hotfix spike for the 3 blockers surfaced in Phase 07.3's REVIEW.md + deferred-items.md: (1) tighten `isWritableLValue` to shallow-only LHS for `r-model:propName=` — currently the validator accepts deep chains (`$data.x.y.z`, `$props.x.y`) but React/Solid/Lit emitters silently crash or corrupt state (REVIEW CR-01..CR-04); reject with clean ROZ951 instead. (2) Fix Svelte producer snippet-arg shape — currently `{@render header(close)}` (positional) but consumer destructures `{ close }` (object), so close-button is no-op. (3) Fix Lit producer first-paint observer race — `observeRozieSlotCtx` registers in `firstUpdated()` (async), but consumer's first-paint click finds `undefined`. Dogfood: un-fixme svelte+lit cells in `modal-consumer-close.spec.ts` so all 6 targets pass.
- [x] **Phase 8: IntelliJ Platform Plugin v1 (Internal Dogfooding)** - Ship a Kotlin-based JetBrains plugin (IDEA Ultimate / WebStorm / PhpStorm / RubyMine / GoLand 2024.2+) with `.rozie` file type registration, Rozie-only lexer, and language injection (JS into script-flavored blocks, CSS into `<style>`, HTML into `<template>`); team installs via internal zip drop and starts dogfooding `.rozie` authoring in their primary IDE. **Parallel track** — does not block v1 product ship; can be picked up at any time after Phase 3 completes. (completed 2026-05-07 — internal zip dogfooding; Plan 08-06 deferred Task 2 (tag push) + Task 3 (manual WebStorm/IDEA UAT) rolled forward into Phase 08.1)
- [x] **Phase 08.1: IntelliJ Plugin — `<components>` block + PascalCase component references (INSERTED)** - Retroactively extend the Phase 8 plugin: `<components>` as a first-class SFC block token (JFlex lexer + JS injection + TextMate drift guard); PascalCase component-reference tags in `<template>` get their own `COMPONENT_REF` token class and ColorSettingsPage entry.
- [x] **Phase 08.2: IntelliJ Plugin — injection-first architectural pivot (INSERTED)** - UAT on 2026-05-17 surfaced two P0 issues that revealed the lexer-heavy direction shipped in Phases 08 + 08.1 was architecturally wrong: `<template>` body renders as nearly-uncolored text (HTML injection fragmented by per-element JFlex tokens), and `$props.x` does not Go-to-Declaration into `<props>` (no `PsiReferenceContributor`). Pivot to the JetBrains-canonical pattern used by Vue / Svelte / Angular / Astro plugins: JFlex emits ONE contiguous BODY token per SFC block, JetBrains' built-in HTML/JS/CSS PSI handles structure and smart features, Rozie-specific syntax (`r-*`, `@`, `:`, `#`, PascalCase tags, `$props.X` cross-block refs) layers on top via `XmlAttributeDescriptorsProvider`, `Annotator`, `XmlTagNameProvider`, `PsiReferenceContributor`, `CompletionContributor`. Retires the D-07 TextMateGrammarParityTest contract (which optimised for the wrong target). v0.2.0 tag is held until this lands. Rebuild ships as v0.2.0 (not v0.3.0) — the tag was never pushed. (completed 2026-05-18)
- [x] **Phase 08.3: IntelliJ Plugin — `<script>` declarations visible from template + JS-injected blocks (INSERTED)** - Close the two P1-UAT regressions Phase 08.2 explicitly deferred (P1-UAT-15 + P1-UAT-16): identifiers declared in the user `<script>` block (top-level `let`/`const`/`function`/`import`) currently do not resolve from template directive expressions, `{{ }}` interpolations, or `@event`/`r-*`/`:prop` attribute-value JS injections — so a hand-written `fmt(x)` helper shows as unresolved when called from `{{ fmt($data.x) }}`, breaking Go-to-Declaration, Find-Usages, Rename, and type-aware completion across the very boundary that makes Rozie SFCs useful. Phase 08.2's RozieMultiHostInjector treats every JS-injected fragment as an isolated micro-document; cross-fragment resolution requires the synthetic-virtual-file architecture used by Vue/Svelte/Astro plugins (one virtual TS file per SFC concatenating `<script>` + injected fragments, with bidirectional source-map plumbing so PSI offsets map back to `.rozie` positions). Single architectural fix closes both P1-UAT-15 (data-var refs) and P1-UAT-16 (method refs); also the prerequisite for the v0.3.0 member-access autocomplete polish. (completed 2026-05-28)
- [x] **Phase 9: `<script lang="ts">` — TypeScript in the `<script>` block** - Add shared SFC block `lang=` attribute plumbing (substrate also for future `<style lang="scss/less">`); enable the `typescript` Babel plugin in `parseScript` on `lang="ts"`; teach the IR + semantic passes to tolerate `TS*` AST nodes; rewrite `typeNeutralizeScript` to fill only the untyped residue while preserving author annotations (the untyped path stays default + fallback and must not regress); thread author types through all 6 target emitters (React/Vue/Svelte/Angular/Solid/Lit). Dogfood gate: side-by-side typed example variants in a new `examples/typed/` directory — never in-place conversion. (completed 2026-05-21)
- [x] **Phase 10: `<style lang>` support — SCSS/Less preprocessing in `<style>` blocks** - Let authors write `<style lang="scss">`/`<style lang="less">`; preprocessed CSS flows through the existing PostCSS scoping pass to all six targets, reusing the generic SFC-block `lang=` substrate shipped in Phase 9. (completed 2026-05-22)
- [x] **Phase 11: `r-match` conditional construct** - Switch-style `r-match`/`r-case`/`r-default` template blocks lowering to an `if`/`else-if`/`else` ladder across all six targets — comma-alternative `r-case` values, literal-`true` predicate mode, evaluate-once discriminant hoisting. (completed 2026-05-21)

## Phase Details

### Phase 1: Foundation Spike, Parser & AST

**Goal**: Component-library authors and Rozie maintainers can take any of the five reference `.rozie` files, run the parser on it, and get back a typed `RozieAST` whose every node has a byte-accurate source location pointing back to the original file. The load-bearing technical bet — that we can hand-roll an SFC block splitter on top of `htmlparser2` rather than coupling to `@vue/compiler-sfc` — is validated within the first three days; if the spike fails, this phase reports back before any downstream work begins.
**Depends on**: Nothing (first phase)
**Requirements**: PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06, PARSE-07, MOD-01
**Success Criteria** (what must be TRUE):

  1. Running `splitBlocks()` against each of `examples/Counter.rozie`, `examples/SearchInput.rozie`, `examples/Dropdown.rozie`, `examples/TodoList.rozie`, and `examples/Modal.rozie` produces a typed `BlockMap` with byte-accurate offsets, verified by snapshot tests committed under `fixtures/blocks/`.
  2. The `<props>` block of `Counter.rozie` parses via `@babel/parser.parseExpression` into an AST that correctly recognizes `Number` as an identifier reference, `-Infinity` as a unary expression, and (in `TodoList.rozie`) `() => []` as an arrow function — proving the JS-expression grammar (not JSON5) is in place.
  3. A maintainer running `parse('examples/Dropdown.rozie')` gets back a `RozieAST` whose `<listeners>` keys (`"document:click.outside($refs.triggerEl, $refs.panelEl)"`, `"window:resize.throttle(100).passive"`) are tokenized by the `peggy` modifier grammar into structured `ModifierChain` nodes with parsed args.
  4. A `console.log` call in any `<script>` block survives parsing into the AST verbatim (preserved Babel `CallExpression` node) — establishing the trust-erosion-prevention floor from research.
  5. Every AST node carries a `loc: { start, end }` field threaded from its source byte offset; an off-by-one regression test guards against retroactive location threading.

**Plans**: 4 plans

- [x] 01-01-PLAN.md — Monorepo + tooling scaffold (Wave 0): pnpm + Turborepo workspace, all 7 v1 package skeletons, Biome + Vitest configs, 12 Wave 0 test scaffolds, locked RozieAST + Diagnostic type contracts
- [x] 01-02-PLAN.md — SFC block splitter spike (PARSE-01, Wave 1): htmlparser2-based splitBlocks + strict @vue/compiler-sfc fallback (D-04/D-05), offsetToLineCol helper, 5 example block-map snapshots
- [x] 01-03-PLAN.md — Block-content parsers (PARSE-02..06, Wave 1): @babel/parser for props/data/script/listeners; htmlparser2 Tokenizer for templates; postcss for styles; 25 per-block snapshots; collected-not-thrown ROZ010..ROZ081
- [x] 01-04-PLAN.md — Modifier PEG + diagnostics + parse() entrypoint (MOD-01 + PARSE-07, Wave 2): peggy grammar with build-time generation, @babel/code-frame renderer, AST normalizer, off-by-one regression suite (D-12), 5 full-AST snapshots

**UI hint**: no

**Risk buffer:** First three days of this phase are explicitly a feasibility spike on the htmlparser2 block splitter (PITFALLS Pitfall 13 and SUMMARY Section 8 risk flag). If the spike runs over budget, fall back to leaning on `@vue/compiler-sfc` for SFC top-level splitting only and re-parsing each block ourselves (documented in STACK.md "Stack Patterns by Variant").

### Phase 2: Semantic Analysis, Reactivity Model & IR (Locked Gate)

**Goal**: Rozie maintainers can lower any parsed `RozieAST` to a framework-neutral `RozieIR` whose primitives are rich enough that every downstream target compiler is mechanical. This is the highest-leverage phase: getting the IR and slot shape wrong means retrofitting four emitters. Per the Conflict A resolution from research, the IR is designed with **React's stricter constraints as the canonical floor** (so Vue/Svelte/Angular emitters relax from it), even though Vue ships first for demo velocity. The reactivity dep-graph is built on the same algorithm as `eslint-plugin-react-hooks/exhaustive-deps` to guarantee compatibility with the React CI gate that lands in Phase 4.
**Depends on**: Phase 1
**Requirements**: SEM-01, SEM-02, SEM-03, SEM-04, REACT-01, REACT-02, REACT-03, REACT-04, REACT-05, REACT-06, IR-01, IR-02, IR-03, IR-04, MOD-02, MOD-03, MOD-04, DX-02
**Success Criteria** (what must be TRUE):

  1. Lowering any of the five reference examples produces a `RozieIR` whose `SlotDecl` shape contains exactly `{ name, defaultContent (lifted separately), params, presence, nestedSlots }` — and this shape is locked by a snapshot test before any target emitter is written. Re-shaping `SlotDecl` after this phase requires deliberate ROADMAP amendment.
  2. A write to `$props.value` in `Counter.rozie` succeeds (because `value` has `model: true`), but inserting a write to `$props.step` (which has no `model: true`) produces a stable `ROZ200`-class diagnostic with code-frame rendering of the offending source — not a thrown exception, collected alongside any other diagnostics.
  3. `ReactiveDepGraph` analysis of `Dropdown.rozie`'s listener `when: "$props.open && $props.closeOnOutsideClick"` returns the dep set `[$props.open, $props.closeOnOutsideClick]` — and crucially does NOT include `$refs.triggerEl` or `$refs.panelEl` (refs are stable-identity wrappers, not signals).
  4. The modifier `.outside($refs.triggerEl, $refs.panelEl).stop` in either a `<listeners>` key or a template `@event` binding lowers to the same IR `EventBinding.modifierPipeline` shape — proving MOD-03 (shared registry) at the IR layer. Built-in modifiers (`.outside`, `.self`, `.stop`, `.prevent`, `.once`, `.capture`, `.passive`, `.debounce`, `.throttle`, key/button filters) are implemented as first-party plugins consuming a `registerModifier(name, impl)` API — dogfooding ensures the public API is real.
  5. A `<template>` block containing `r-for="item in $data.items"` without `:key` produces a warning diagnostic; setting `:key="index"` produces a separate warning diagnostic — both with stable `ROZ`-codes and source locations pointing at the `r-for` opening tag.

**Plans**: 5 plans

- [x] 02-01-PLAN.md — Wave 0 foundation: @babel/traverse dep + ROZ100..ROZ303 codes registry + BindingsTable + collectors substage + 17 Wave 0 test scaffolds (DX-02, SEM-04 partial)
- [x] 02-02-PLAN.md — Wave 1 semantic validators: unknownRefValidator + propWriteValidator + rForKeyValidator + analyzeAST coordinator + 3 synthetic fixtures (SEM-01, SEM-02, SEM-03)
- [x] 02-03-PLAN.md — Wave 1 ReactiveDepGraph: signalRef + computeDeps (matches eslint-plugin-react-hooks gatherDependenciesRecursively per D-21) + buildDepGraph + 5 dep-graph snapshots (REACT-06)
- [x] 02-04-PLAN.md — Wave 1 modifier registry: ModifierRegistry + registerModifier + registerBuiltins + 11 builtin impls + 14 key/button filters + registry-builtins snapshot (MOD-02, MOD-04)
- [x] 02-05-PLAN.md — Wave 2 (locking gate): RozieIR types + 7 lowerers + lowerToIR coordinator + 5 IRComponent fixtures + SlotDecl-shape lock (D-18) + D-19 lifecycle pairing + D-20 byte-identical-pipeline pair fixture + @rozie/core public surface promotion (IR-01..04, REACT-01..05, MOD-03)

**UI hint**: no

**Locks for downstream:** `SlotDecl` IR shape (the single most expensive decision to retrofit), `ReactiveDepGraph` algorithm (must match `exhaustive-deps`), modifier IR shape (must be identical between `<listeners>` and template `@event`), lifecycle pairing IR (every `$onMount` is a `(setup, optional cleanup)` pair).

### Phase 3: Vue 3.4+ Target Emitter (First Demoable Artifact)

**Goal**: A Vue 3.4+ developer can `import Counter from './Counter.rozie'` in a Vue Vite project and the component renders correctly with `defineProps`/`defineEmits`/`defineSlots`/`defineModel` — the first end-to-end demoable artifact. This validates the entire pipeline (split → parse → analyze → IR → emit → source maps → Vite plugin) on the easiest target before duplicating effort. Vue is the easiest target (`.rozie` syntax is Vue-flavored; IR-to-Vue mapping is nearly 1:1) but the slot IR is **not yet final-locked** — it must survive the React emitter's needs in Phase 4 before any guarantee.
**Depends on**: Phase 2
**Requirements**: VUE-01, VUE-02, VUE-03, VUE-04, VUE-05, VUE-06, DX-01, DX-03, DIST-02
**Success Criteria** (what must be TRUE):

  1. `examples/Counter.rozie` compiled to Vue produces a `<script setup>` SFC using `defineProps<T>()`, `defineEmits<T>()`, `defineModel()` for the `value` prop, and `computed()` for `canIncrement`/`canDecrement` — and renders+behaves identically to a hand-written Vue version of Counter (verified by integration test).
  2. `examples/Dropdown.rozie` compiled to Vue compiles its `<listeners>` block to `watchEffect` blocks that conditionally `addEventListener` based on the `when` expression and clean up via the watch's `onCleanup` callback — verified to fire only when click is outside both the trigger ref and panel ref.
  3. A consumer's Vite project with `@rozie/unplugin` configured for `{ target: 'vue' }` can `import Foo from './Foo.rozie'` transparently — no codegen ceremony, HMR works, and a deliberate `console.log("hello from rozie")` in the `<script>` block appears in the browser DevTools console verbatim (DX-03 trust-erosion floor).
  4. Stack traces from a runtime error in any compiled Vue output resolve in browser DevTools to the original `.rozie` line and column number, not the compiled `.vue` output (DX-01 source-map verification).
  5. A separate global `<style>` block is emitted for `:root { ... }` rules in `examples/Dropdown.rozie`'s `<style>` block, while everything else is emitted as `<style scoped>` — verified by snapshot test of the emitted SFC.

**Plans**: 6 plans

- [x] 03-01-PLAN.md — Wave 0 scaffolding: workspace globs, ROZ400+ codes, ModifierImpl.vue? D-40 hook on 25 builtins, runtime-vue/target-vue/unplugin vitest configs + 20 fixture stubs, examples/consumers/vue-vite skeleton + Playwright config (foundation for Plans 02-06)
- [x] 03-02-PLAN.md — script-side emitter (Wave 1): cloneProgram + rewriteRozieIdentifiers + emitScript (props/emits/data/computed/lifecycle); D-31/D-32/D-33/D-34/Pitfall 5 paired-cleanup; Counter+SearchInput+Modal script snapshots (VUE-01, VUE-02, DX-03)
- [x] 03-03-PLAN.md — template-side emitter (Wave 2): emitTemplate r-* → v-* + native modifier passthrough + slot lowering + D-37 mustache-in-attribute + refineSlotTypes; 5 template snapshots (VUE-04, VUE-01)
- [x] 03-04-PLAN.md — runtime-vue + listeners (Wave 2 parallel with 03-03): @rozie/runtime-vue package (useOutsideClick/debounce/throttle/keyFilter); emitListeners with D-42 collapse for .outside+when:; Dropdown listeners snapshot (VUE-03, MOD-04)
- [x] 03-05-PLAN.md — style + shell + source maps (Wave 3): emitStyle :root extraction; magic-string SFC shell composition; composeSourceMap; 5 whole-SFC snapshots; success criterion 5 anchor (VUE-05, DX-01)
- [x] 03-06-PLAN.md — unplugin + demo + Playwright e2e (Wave 4): D-25 spike (path-virtual chosen — D-25 amended); createUnplugin factory + per-bundler entries (vite-only CI per D-48); vue-vite-demo with all 5 examples; 6 Playwright e2e tests (5 success criteria + Modal OQ4); Vue 3.4 + 3.5 CI matrix per D-27; OQ4 RESOLVED — Modal works without $expose, deferred to v2 (DIST-02, DX-01, DX-03, VUE-01..06)

**UI hint**: no

**Open question monitor:** OQ4 (`$expose()` / `defineExpose`) — if `Modal.rozie` requires an imperative `modal.open()` API at this phase, the IR needs an `expose` field; if not, defer to v2.

### Phase 4: React 18+ Target Emitter (Proves Dep-Graph & Finalizes Slot IR)

**Goal**: A React 18+ developer can `import Counter from './Counter.rozie'` and get a functional component with statically-computed `useEffect` dep arrays, hybrid controllable-state for `model: true` props, lifted slot fallbacks, and `eslint-plugin-react-hooks/exhaustive-deps` passing cleanly. This phase proves the marquee technical claim of the project (auto-tracked signals → React dep arrays) and finalizes the slot IR by exposing it to React's render-prop semantics — the toughest constraint. From this phase forward, the slot IR is locked and any change is a deliberate amendment. The public modifier plugin API (`MOD-05`) ships here because React validates that the registry handles the hardest target.
**Depends on**: Phase 2 (and Phase 3 for pipeline maturity)
**Requirements**: REACT-T-01, REACT-T-02, REACT-T-03, REACT-T-04, REACT-T-05, REACT-T-06, REACT-T-07, MOD-05
**Success Criteria** (what must be TRUE):

  1. `examples/Dropdown.rozie` compiled to React produces code that — when `$props.open` is changed mid-lifecycle by the parent — observes the new value in the listener's `when` predicate (no stale closures). Verified by a test that mounts the component, mutates the prop, dispatches a document click, and asserts `close` was called with the latest prop value (PITFALLS Pitfall 1).
  2. Every emitted React file from all five reference examples passes `eslint-plugin-react-hooks/exhaustive-deps` cleanly. CI is wired to fail the build if any warning emerges. Any future warning is treated as a Rozie compiler bug, not a user bug.
  3. `examples/Counter.rozie`'s `value` prop (`model: true`) compiles to a `useControllableState({ value, defaultValue, onValueChange })` helper that supports both controlled (parent passes `value` + `onValueChange`) and uncontrolled (parent passes `defaultValue` only) consumer usage; a parent-flips-mid-lifecycle test passes for both modes.
  4. `examples/Modal.rozie` runs cleanly under `<React.StrictMode>` — the `lockScroll`/`unlockScroll` lifecycle pair survives mount → unmount → re-mount without leaving `document.body.style.overflow` in `'hidden'`. Each `$onMount` + paired cleanup compiles to a single `useEffect(() => { setup(); return cleanup })`, never split across two effects.
  5. A third-party modifier plugin can be authored in `tests/plugins/swipe/` and registered via `registerModifier('swipe', impl)`; using `@touchstart.swipe('left')` in any reference component compiles correctly across both Vue (Phase 3) and React (Phase 4) without core changes — proving the modifier API is SemVer-stable v1.

**Plans**: 6 plans

- [x] 04-01-PLAN.md — Wave 0 scaffolding: workspace globs, ROZ500..ROZ599 codes, ReactEmissionDescriptor + react? hook on 11 builtins, target-react/runtime-react/react-vite-demo/swipe-plugin skeletons, 20 fixture stubs, ESLint+exhaustive-deps config (REACT-T-01..07 + MOD-05 setup)
- [x] 04-02-PLAN.md — script-side emitter (Wave 1): cloneProgram + rewriteRozieIdentifiers (Vue→React mapping per RESEARCH Pattern 2) + hoistModuleLet (Pitfall 3 spike) + emitScript returning { hookSection, userArrowsSection, diagnostics } + emitPropsInterface + shell — Counter+SearchInput+Modal script snapshots (REACT-T-01, REACT-T-03, REACT-T-06, REACT-T-07)
- [x] 04-03-PLAN.md — template-side emitter (Wave 2): emitTemplate (JSX text-builder) + emitConditional (ternary chain) + emitRModel + emitTemplateEvent + className composition + slot lowering (REACT-T-04 finalizes D-18) + Phase 4 finalization gate verification — 5 whole-tsx fixtures lint-clean (REACT-T-04, REACT-T-07)
- [x] 04-04-PLAN.md — runtime-react + listeners (Wave 3, sequential after 04-03 due to shared emitReact.ts): @rozie/runtime-react helper inventory (useControllableState + useOutsideClick + useDebouncedCallback + useThrottledCallback + keyFilter + clsx) + emitListeners 4-class A/B/C/D + renderDepArray (REACT-T-02 marquee claim) + dropdown-stale-closure + counter-controllable integration tests (REACT-T-02, REACT-T-03, MOD-04)
- [x] 04-05-PLAN.md — style + sourcemap + unplugin React branch (Wave 4, autonomous): emitStyle (PostCSS CSS Modules + :root) + sourcemap compose + @rozie/unplugin React branch (D-58 + D-59) + 5 .module.css/.global.css fixtures + emitReact-shape contract — D-67 + DX-01 (REACT-T-05 emitter-side, REACT-T-07, DIST-02 unplugin)
- [x] 04-06-PLAN.md — demo + MOD-05 dogfood + CI matrix + final verification (Wave 5, has checkpoint): tests/plugins/swipe MOD-05 dogfood + VueEmissionDescriptor inlineGuard amendment + react-vite-demo full workspace + 8 Playwright e2e + react-matrix CI + StrictMode tests + OQ4 disposition + final human verification (REACT-T-05 CI gate, REACT-T-06, MOD-05, DIST-02, DX-03 + all 5 success criteria observable)

**UI hint**: no

**Locks for downstream:** Slot IR is now fully finalized. Any change in Phases 5-7 requires reverting and re-running both Vue and React emitter integration tests.

### Phase 5: Svelte 5 + Angular 17+ Target Emitters

**Goal**: Svelte 5 and Angular 19+ developers each get the same drop-in experience as Vue and React consumers — `import Foo from './Foo.rozie'` produces an idiomatic component using runes (Svelte) or standalone signals (Angular). Both targets are signals-first and map cleanly to the IR after React proves framework-neutrality. They proceed largely in parallel since they live in separate packages. Angular has a 1-2 day spike at the start of the phase to resolve the `@analogjs/vite-plugin-angular` virtual-filesystem integration (OQ3) before any Angular emitter code is written.
**Depends on**: Phase 4
**Requirements**: SVELTE-01, SVELTE-02, SVELTE-03, SVELTE-04, SVELTE-05, ANGULAR-01, ANGULAR-02, ANGULAR-03, ANGULAR-04, ANGULAR-05, ANGULAR-06
**Success Criteria** (what must be TRUE):

  1. `examples/TodoList.rozie` compiled to Svelte 5 produces a `.svelte` file using runes (`$state`, `$derived`, `$effect`, `$bindable`); the `r-for` with `:key` compiles to `{#each items as item (item.id)}`, and named slots compile to `{#snippet name(params)}` parameters that consumers invoke via `{@render trigger?.(ctx)}`.
  2. `examples/Dropdown.rozie` compiled to Angular produces a standalone component using `signal()` / `computed()` / `effect()`, with `<listeners>` translating to `effect()` + `Renderer2.listen` + `DestroyRef` cleanup; the named `trigger` slot emits a typed `<ng-template>` consumable via `*ngTemplateOutlet="triggerTpl; context: { $implicit: ctx, open, toggle }"` with a co-emitted `ngTemplateContextGuard`.
  3. The Angular emitter's output is exercised in a CI integration project using `@analogjs/vite-plugin-angular` (or whichever Vite-Angular bridge the OQ3 spike selects); `examples/Counter.rozie` rendered in that project type-checks and renders identically to its Vue/React/Svelte counterparts (per ANGULAR-06).
  4. `examples/SearchInput.rozie`'s `@input.debounce(300)` modifier behaves identically across the Svelte and Angular outputs as it does in Vue (Phase 3) and React (Phase 4) — verified by a parameterized timing test.
  5. `<style>` blocks emit native scoping per target: Svelte's automatic class-hashing preserves `:root { ... }` as `:global(...)`; Angular's `ViewEncapsulation.Emulated` extracts `:root { ... }` rules to a separately-declared global stylesheet (or `::ng-deep` for v1 acceptability with documented v2 migration plan).

**Plans**: 7 plans

- [x] 05-01-PLAN.md — Wave 0 scaffolding: ROZ600/700 codes registry, ModifierImpl.svelte? + .angular? hooks on 10 builtins, target-svelte/target-angular package skeletons + vitest configs + fixture dirs, svelte-vite + angular-analogjs demo consumer skeletons, cross-target debounce parity test scaffold, AnalogJS CI integration project skeleton (foundation for Plans 02a-05)
- [x] 05-02a-PLAN.md — Svelte target emitter (Wave 1, depends_on: [05-01]): emitScript (rune mapping per Pattern 1) + emitTemplate (Pitfall 4 inlineGuard rule + slots/snippets per OQ A1 RESOLVED) + emitListeners (3-class A/B/C; inline IIFE per OQ A8/A9 RESOLVED) + emitStyle (:global(:root) wrap) + sourcemap + 5 .svelte.snap fixtures locked (SVELTE-01..05 emitter side)
- [x] 05-02b-PLAN.md — unplugin Svelte branch + svelte-vite demo + CI (Wave 1, depends_on: [05-02a]): @rozie/unplugin Svelte branch (resolveId/load + svelte-detect + ROZ600/601 peer-dep guards) + svelte-vite demo with 5 .rozie + 6 Playwright e2e (split: auto-specs + CI matrix in one task; manual demo smoke as separate checkpoint task) + svelte-matrix.yml CI (SVELTE-01..05 integration side)
- [x] 05-03-PLAN.md — OQ3 validation spike (Wave 1, parallel with 05-02a): minimal Vite+analogjs probe via createServer.transformRequest against synthetic .rozie.ts virtual id; produces 05-03-SPIKE.md decision document (Path A path-virtual / Path B temp-dir filesystem fallback per D-70) for Plan 05-04a (ANGULAR-06)
- [x] 05-04a-PLAN.md — Angular target emitter (Wave 2, depends_on: [05-02b, 05-03]): emitScript (Pattern 6 signal mapping + Pitfall 8 constructor-only inject) + emitTemplate (block syntax @if/@for + Pitfall 3 ROZ720) + emitListeners (effect+Renderer2+DestroyRef inline class-field per OQ A8/A9 RESOLVED) + emitStyle (::ng-deep :root v1 per OQ A4 RESOLVED) + emitDecorator (Pitfall 10 conditional NgTemplateOutlet/FormsModule) + emitSlotDecl (ngTemplateContextGuard + #defaultSlot per OQ A5 RESOLVED) + 5 .ts.snap fixtures locked (ANGULAR-01..05 emitter side)
- [x] 05-04b-PLAN.md — unplugin Angular branch + angular-analogjs demo + CI (Wave 2, depends_on: [05-04a]): @rozie/unplugin Angular branch (Path A or Path B per SPIKE.md + analogjs-detect + ROZ700/701/702 missing peer-dep guards per OQ6 RESOLVED Vite ≥6 floor) + angular-analogjs demo with 5 .rozie + 6 Playwright e2e (split: auto-specs + CI matrix in one task; manual demo smoke as separate checkpoint task) + angular-matrix.yml CI (ANGULAR-06 demo aspect)
- [x] 05-05-PLAN.md — Phase 5 success criteria closure (Wave 3, depends_on: [05-02b, 05-04b]): cross-target SearchInput.debounce(300) parity test with REAL behavioral mount harnesses for ALL 4 targets (no it.skip; success criterion #4) + AnalogJS CI integration project Counter.rozie build (success criterion #3 / ANGULAR-06 CI) + Modal CSS-vars Playwright specs for Svelte+Angular (success criterion #5 / ANGULAR-05 runtime validation; A4 disposition recorded) + cross-wave regression check + 05-VALIDATION.md Per-Task Verification Map populated + nyquist_compliant: true

**UI hint**: no

**Open question resolved at start:** OQ3 (Angular Vite virtual filesystem) — 1-2 day spike before Angular emitter work begins. May require per-target configuration in `@rozie/unplugin`.

### Phase 6: CLI Codegen, Babel Plugin & Type Emission Hardening

**Goal**: Component-library authors who prefer to ship pre-compiled per-framework npm packages (rather than relying on consumer-side build plugins) can run `rozie build src/components/ --target react,vue,svelte,angular` and get correctly-typed artifacts in every target. The `compile()` function in `@rozie/core` is finalized as the single source of truth — Vite/Babel/CLI all call it, and a snapshot test gates byte-identical output across all three entrypoints. `.d.ts` files are emitted from the IR (not via `tsc --declaration` over emitted code) and consumed by per-target type-check projects in CI.
**Depends on**: Phase 5
**Requirements**: DIST-01, DIST-03, DIST-04, DIST-05, TYPES-01, TYPES-02, TYPES-03
**Success Criteria** (what must be TRUE):

  1. `@rozie/core` exports a public `compile(source, opts) → { code, map, types, diagnostics }` function with zero bundler dependencies; `@rozie/unplugin`, `@rozie/babel-plugin` (~50 LOC), and `@rozie/cli` all call this function with identical arguments and produce byte-identical output for each of the five reference examples × four targets — guarded by a snapshot test in CI (DIST-05).
  2. `rozie build examples/ --target react,vue,svelte,angular --out dist/` produces 5 × 4 = 20 component files plus their accompanying `.d.ts` and `.map` files; running the CLI is covered by an end-to-end CI test that diffs output against committed fixtures.
  3. The four projects in `examples/consumers/{react,vue,svelte,angular}-ts/` each import compiled Rozie components, type-check cleanly under `tsc --strict --noEmit` in CI, and exercise prop types, slot context types, emitted-event signatures, and `model: true` two-way bindings — failures here are CI-blocking (TYPES-02).
  4. A generic component (e.g., a hypothetical `Select<T>.rozie`) preserves its generic type parameter through `.d.ts` emission for at least the React and Vue consumer projects (`Select<T>(props: SelectProps<T>) => …`), with Svelte/Angular best-effort and documented (TYPES-03).
  5. A `@rozie/babel-plugin` user can configure a non-Vite Babel pipeline to transparently compile `.rozie` imports; the emitted output is byte-identical to the Vite plugin and CLI outputs for every reference example (per DIST-05).

**Plans**: 6 plans

- [x] 06-01-PLAN.md — Wave 1 foundation: compile() public API + ROZ800..ROZ899 codes + 7 missing tsdown.config.ts (D-95 OQ2 closure) (DIST-01)
- [x] 06-02-PLAN.md — Wave 2: React .d.ts emitter (D-84 hand-rolled) + slot type inference (D-86 unknown fallback) + Select<T> generic preservation fixture (D-85) (TYPES-01, TYPES-03)
- [x] 06-03-PLAN.md — Wave 3: CLI hardening — comma-separated --target (D-87) + variadic file/dir/glob (D-88) + dist/{target}/{rel}/Foo.{ext} layout (D-89); migrate runBuild to call compile() (DIST-04)
- [x] 06-04-PLAN.md — Wave 3 (parallel): @rozie/babel-plugin ImportDeclaration visitor (~50 LOC) + mtime-tolerance idempotency + ROZ820..ROZ823 codes (DIST-03)
- [x] 06-05-PLAN.md — Wave 4: 4 examples/consumers/{target}-ts/ workspace packages with strict tsc/vue-tsc/svelte-check + Select<T> coverage (TYPES-02, TYPES-03)
- [x] 06-06-PLAN.md — Wave 5: tests/dist-parity strict-bytes parity gate (5×4×4=80 assertions); PROJECT.md closure (DIST-05)

**UI hint**: no

**Open question resolved here:** OQ2 (`dts-buddy` stability) — if `dts-buddy` 0.7 proves unstable for `@rozie/core`'s own toolchain types, fall back to `tsc --declaration` for leaf packages and `api-extractor` for `@rozie/core`. Decision documented in PROJECT.md Key Decisions at end of phase.

### Phase 06.1: Source map accuracy across all 4 targets (INSERTED)

**Goal**: Source maps produced by `rozie build --source-map` (and the Vite plugin in dev mode) resolve to the correct `.rozie` block and line — not line 1 col 1 for all output. Specifically: (a) `buildShell` is rearchitected to start from `new MagicString(rozieSource)` with `overwrite()` at the byte offsets from `splitBlocks()`, giving per-block accuracy; (b) `emitScript` uses `@babel/generator`'s native `sourceMaps: true` mode to produce per-expression mappings within the `<script>` block. Verified per target by a `SourceMapConsumer.originalPositionFor` unit test asserting that a known identifier in the emitted output resolves to its correct `.rozie` line (not line 1).

**Why extracted from Phase 7**: Phase 7 runs Playwright/StrictMode/HMR validation across all four targets; if sourcemaps still resolve to line 1, regressions surfaced there would be hard to bisect back to a `.rozie` source line. Landing accurate sourcemaps first makes Phase 7's failure diagnostics actionable.

**Depends on**: Phase 6
**Requirements**: DX-04
**Success Criteria** (what must be TRUE):

  1. `buildShell` across all four targets (Vue / React / Svelte / Angular) starts from `new MagicString(rozieSource)` and uses `overwrite()` at the byte offsets returned by `splitBlocks()` — verified by reading each target's `buildShell` implementation.
  2. `emitScript` across all four targets passes `sourceMaps: true` to `@babel/generator` and the resulting per-expression mappings are merged into the composed sourcemap via `magic-string`'s `generateMap` API.
  3. A `SourceMapConsumer.originalPositionFor` unit test exists per target (4 tests total) asserting that a known identifier in the emitted output resolves to its correct `.rozie` source line — explicitly NOT line 1 col 1.
  4. The four reference examples (`Counter`, `SearchInput`, `Dropdown`, `TodoList`, `Modal`) compile under `rozie build --source-map` without sourcemap-composition errors; `.map` files are emitted alongside each output and are valid Source Map v3 JSON.

**Plans**: 3 plans

- [x] 06.1-01-PLAN.md — buildShell rearchitecture across all 4 targets (Vue/React/Svelte/Angular) — per-block overwrite at splitBlocks byte offsets + envelope strip + Angular `.rozie.ts` data-URL trailer (Pitfall 6)
- [x] 06.1-02-PLAN.md — composeMaps shared helper + emitScript sourceMaps:true across all 4 targets + synthesized-node loc annotations (D-104/D-106) + 4× compose.ts D-109 cleanup + ROZ900..ROZ919 codes
- [x] 06.1-03-PLAN.md — Per-target SourceMapConsumer unit tests (Vue replace, React/Svelte/Angular new) + 5-example × 4-target smoke harness at tests/smoke-sourcemap/ + DX-04 row added to REQUIREMENTS.md

### Phase 06.2: Component composition + recursion (INSERTED)

**Goal**: A `.rozie` file can declare other `.rozie` files in a first-class `<components>` block and reference them as PascalCase tags in its template; a tag matching the outer `<rozie name=>` resolves to a self-reference; all four targets emit working composition + recursion using their native idioms (Vue setup imports, React named-function declaration, Svelte self-import for recursion, Angular `@Component({ imports: [...] })` + `forwardRef` for self). Strict resolution: unmatched PascalCase tags are compile errors with did-you-mean suggestions. The reference example set grows during this phase to exercise composition — at minimum one new recursive example (e.g., `examples/TreeNode.rozie`) and one wrapper-composition demonstration (either a new example pair or a retrofit of `Modal.rozie` to embed `<Counter>` in its body). Without this, "feature complete cross-framework component language" doesn't hold for component-library authors who compose constantly.

**Why extracted as a separate phase, after Phase 06.1**: This was identified as a gap during Phase 5 patches — none of the original 5 reference examples compose, so the gap was not surfaced by earlier validation. Phase 6 (already in planning) ships CLI/Babel/Type emission for non-composing components; Phase 06.1 ships source-map fixes; this phase layers component composition on top using the awareness of what 6 and 06.1 produced. Phase 7 validation must include the new composition examples or it cannot meaningfully validate v1's "feature complete" claim.

**Depends on**: Phase 06.1
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06
**Design doc**: `.planning/notes/component-composition-design.md`
**Forward-compat brief for Phase 6**: `.planning/notes/phase-6-composition-foresight.md`

**Success Criteria** (what must be TRUE):

  1. A `.rozie` file authoring a `<components>` block of the form `{ Modal: './Modal.rozie' }` parses without errors; the resulting `IRComponent` carries a `components: ComponentDecl[]` table; every PascalCase `TemplateElementIR.tagName` in that file's template is annotated with `tagKind: 'html' | 'component' | 'self'` at lowering time. Verified by IR snapshot test.
  2. A tag in template that exactly matches the outer `<rozie name=>` is annotated `tagKind: 'self'` at lowering — verified by an IR snapshot of a recursive example. No new authoring syntax beyond the existing `name=` attribute.
  3. A PascalCase tag that matches neither the outer name nor any `<components>` entry produces a stable `ROZ-COMPxx` compile error with a did-you-mean suggestion drawn from declared component names (Levenshtein distance ≤ 2). Verified by per-target diagnostic snapshot.
  4. All four targets emit working composition: Vue (`<script setup>` import, tag verbatim), React (top-of-file `import`, JSX `<Foo />`), Svelte (`import` + tag verbatim), Angular (`import` + populated `@Component({ imports: [Foo] })` + `[prop]="x"`/`(event)="..."` template syntax). Verified by per-target compiled-output snapshots.
  5. All four targets emit working self-reference: Vue (`defineOptions({ name })` + tag), React (`function Counter()` named declaration referenced in own body), Svelte (self-import — `import Counter from './Counter.svelte'` + tag, modern Svelte 5 idiom), Angular (`forwardRef(() => Counter)` in own `imports[]`). Verified by per-target compiled-output snapshots and per-target browser-mount integration test (recursive example renders ≥ 3 levels deep).
  6. The reference example set has grown by at least one recursive example and demonstrates wrapper composition either via a new example pair or via a retrofit of `Modal.rozie` to embed `<Counter>` in its body. Both/all expanded examples compile to all four targets and render identically across them — verified by Playwright cross-target visual regression (extends EX-06's coverage).
  7. No per-framework escape hatch for tags like `<Suspense>`, `<Teleport>`, `<ng-container>`, `<svelte:fragment>` — they all produce ROZ-COMPxx. Documented in user-facing docs that for these primitives, authors must use the target framework directly.
  8. Phase 7 success criterion #1 is updated/extended (not replaced) to require that the new composition + recursion examples also compile cleanly to all four targets without post-emit edits.

**Plans**: 3 plans

- [x] 06.2-P1-parser-ir-diagnostics-PLAN.md — Parser + IR + diagnostics + did-you-mean (Wave 1, mostly serial): &lt;components&gt; block parser mirroring parseProps; ComponentDecl + IRComponent.components + TemplateElementIR.tagKind/componentRef IR additions; isPascalCase shared util (D-116 promotion); lowerTemplate threading outer name + componentsTable for tagKind annotation; ROZ920..ROZ928 codes (incl. 4 per-primitive escape-hatch sub-codes resolving Open Question §2); didYouMean Levenshtein helper (≤ 50 LOC hand-rolled); 5 IR snapshots locked (COMP-01, COMP-02, COMP-03, COMP-06)
- [x] 06.2-P2-per-target-emit-PLAN.md — Per-target emit (Wave 2, 4 parallel tasks + 1 pre-task): shared rewriteRozieImport helper (D-118); Vue shell adds setup-scope imports + conditional defineOptions({ name }); React shell adds top-of-file imports (named-function declaration already in place per Pitfall 7); Svelte shell self-import idiom for both wrapper composition AND self-reference (per updated D-117 — NO &lt;svelte:self&gt; rewrite); Angular shell + emitDecorator populated imports[] + forwardRef(() =&gt; Self) + AngularImportCollector forwardRef extension; 16 per-target compiled-output snapshots (COMP-04, COMP-05 emit-side)
- [x] 06.2-P3-examples-parity-baseline-rev-PLAN.md — Examples + integration tests + parity gate updates + Phase 7 baseline re-record + public-API rev (Wave 3, has checkpoint): 3 new examples (TreeNode recursive, Card + CardHeader pair); Modal retrofit embedding &lt;Counter /&gt; per D-119; 4 per-target browser-mount integration tests (TreeNode 3-level fixture); 4 per-target import-sourcemap tests (D-128 carry-forward); dist-parity EXAMPLES 5 → 8 (128 byte-equal assertions; Modal rebaselined per D-126; non-Modal byte-stable); CompileResult.componentDeps?: ComponentDep[] (D-120) + emitReactTypes linkedComponents? (D-121, accepted-but-ignored) + CLI D-122 housekeeping; ROADMAP Phase 7 success criterion #1 patched 5 → 8; Phase 7 Modal Playwright × 4 consumer demos re-recorded (LAST task — checkpoint:human-verify) (COMP-04, COMP-05, COMP-06)

### Phase 06.3: Solid.js Target Emitter (INSERTED)

**Goal**: A Solid.js developer can `import Counter from './Counter.rozie'` in a Solid Vite project and the component renders with `createSignal`/`createMemo`/`createEffect`/`Show`/`For` — extending Rozie's target matrix from 4 to 5 frameworks. Solid is the cleanest emitter target by construction: signals-native means every Rozie signal maps 1:1 to a Solid signal, every `$computed` to `createMemo`, every `$onMount` + cleanup to `onMount` + `onCleanup`. No dep-array gymnastics (unlike React), no rune ceremony (unlike Svelte), no decorator metadata (unlike Angular). Slot IR survives intact via Solid's `props.children` + render-prop-style slot functions. This phase ships `@rozie/target-solid` + `@rozie/runtime-solid` + Solid branch in `@rozie/unplugin` + a solid-vite consumer demo + Playwright e2e + dist-parity gate extension to 8 examples × 3 entrypoints for the new target.

**Why inserted before Phase 7**: Phase 7 acceptance validates the cross-target matrix end-to-end. Adding Solid + Lit as targets after Phase 7 would mean re-running the whole acceptance gate twice. Better to land both targets, then run one comprehensive acceptance gate covering 6 × 8 = 48 outputs. Solid is sequenced first because the IR-to-Solid mapping is the cheapest of any target — it proves the IR is target-agnostic without burning audit cycles on web-component semantics.

**Depends on**: Phase 06.2
**Requirements**: SOLID-T-01..SOLID-T-07 (to be added to REQUIREMENTS.md during plan-phase, parallel structure to REACT-T-01..07)

**Success Criteria** (what must be TRUE):

  1. `examples/Counter.rozie` compiles to a Solid `.tsx` using `createSignal`, `createMemo` for `canIncrement`/`canDecrement`, `splitProps` for prop destructuring, and a `useControllableValue`-equivalent helper for the `value` (`model: true`) prop supporting both controlled and uncontrolled consumer usage. Renders + behaves identically to a hand-written Solid version (verified by integration test).
  2. `examples/Dropdown.rozie`'s `<listeners>` block compiles to `createEffect` blocks that conditionally `addEventListener` based on the `when` expression and clean up via `onCleanup`. Fine-grained reactivity means no stale-prop problem — verified by a parent-flips-mid-lifecycle test that's structurally identical to the React version (Phase 4 SC #1) but without the `useEffect` dep-array contortion.
  3. A consumer's Vite project with `@rozie/unplugin` configured for `{ target: 'solid' }` can `import Foo from './Foo.rozie'` transparently. HMR works, source maps resolve to original `.rozie` lines (DX-04 floor), and a deliberate `console.log` in `<script>` survives verbatim into browser DevTools (DX-03 trust-erosion floor).
  4. All eight reference examples (`Counter`, `SearchInput`, `Dropdown`, `TodoList`, `Modal`, `TreeNode`, `Card`, `CardHeader`) compile to Solid output that lints clean under `eslint-plugin-solid` reactivity rules — CI fails on warning. Component composition + recursion (Phase 06.2) emit per Solid idioms (named-function self-reference, top-of-file imports for cross-component).
  5. The dist-parity gate is extended: 8 examples × 3 entrypoints (CLI / Babel / unplugin) = 24 new byte-equal assertions for the Solid target, parallel to the existing per-target gates established in Phase 06.2.

**Plans**: 3 plans

- [x] 06.3-01-PLAN.md — Wave 1 scaffold: @rozie/target-solid + @rozie/runtime-solid + unplugin Solid branch + ROZ810/811/812 + REQUIREMENTS.md SOLID-T-01..07; all 8 examples compile to non-empty TSX
- [x] 06.3-02-PLAN.md — Wave 2 emitter completeness: emitTemplate/emitScript/emitListeners/emitSlotDecl/emitStyle filled; 8 fixture snapshots locked; counter-controllable + dropdown-listener-lifecycle integration tests (SC #1 + SC #2)
- [x] 06.3-03-PLAN.md — Wave 3 demo + dist-parity + CI: examples/consumers/solid-vite (Playwright SC #2) + examples/consumers/solid-ts (tsc --strict) + tests/solid-lint (eslint-plugin-solid --max-warnings 0) + dist-parity TARGETS+"solid" (24+ new byte-equal assertions)

### Phase 06.4: Lit / Web Components Target Emitter (INSERTED)

**Goal**: A consumer can drop `<rozie-counter></rozie-counter>` into any HTML page or any of the four existing framework demos and it renders correctly with no framework wrapper. This phase ships `@rozie/target-lit` emitting Lit 3+ class-based custom elements with `@property()` reactive properties (typed via TS decorators), shadow-DOM-scoped CSS via `static styles = css\`...\``, native `<slot>` / `<slot name=>` for default + named slots, and `dispatchEvent(new CustomEvent('xxx-change', { ... }))` for `model: true` two-way binding (the closest WC analog to Vue's `update:` / React's `onChange` / Angular's `valueChange`). The IR audit confirms web-component semantics are first-class: shadow DOM boundaries, attribute reflection for primitive props, slotchange-derived presence detection. Strategically expands Rozie's audience from "framework wrapper authors" to "design-system authors at large enterprises" (Adobe Spectrum, IBM Carbon, Material Web et al.) who today maintain Lit/WC + four hand-written wrapper sets.

**Why inserted before Phase 7**: Web-component semantics are the *last* target whose IR audit could surface contract gaps in the slot/composition/lifecycle IR — landing Lit before acceptance means any IR adjustments needed for class-based + shadow-DOM-scoped emission happen before validation, not after. Sequenced after 06.3 (Solid) so the cheap-target win banks first; Lit is the higher-audit-cost target and benefits from a fresh look post-Solid.

**Depends on**: Phase 06.3
**Requirements**: LIT-T-01..LIT-T-07 (to be added to REQUIREMENTS.md during plan-phase)

**Success Criteria** (what must be TRUE):

  1. `examples/Counter.rozie` compiles to a Lit class extending `LitElement` with `@property({ type: Number }) value`, `@state()` private fields for non-prop reactive state, `static styles = css\`...\`` containing all `<style>` block content (shadow-DOM-scoped automatically), and a `render()` method emitting an `html\`...\`` tagged template literal. Renders + behaves identically to a hand-written Lit component (verified by integration test in a vanilla HTML host).
  2. Two-way binding for `model: true` props emits via `this.dispatchEvent(new CustomEvent('value-change', { detail, bubbles, composed }))` plus attribute reflection on the prop — verified by a parent-flips-mid-lifecycle integration test in a vanilla HTML host page where the parent listens for the `-change` event and re-sets the attribute.
  3. Slot IR maps cleanly to web-component semantics: default slot → `<slot></slot>`, named slot → `<slot name="header"></slot>`, presence detection (`$slots.x`) → slotchange-listener-derived `@state()` boolean. Scoped-slot params (no native WC equivalent) compile to a documented `<slot name="..." data-rozie-params="...">` pattern with a `@rozie/runtime-lit` helper — IR audit confirms no other slot-IR shape changes are needed (the SlotDecl shape locked in Phase 4 survives the Lit emit).
  4. A consumer can author a vanilla HTML file with `<rozie-counter></rozie-counter>` + `<script type="module" src="./Counter.rozie">` (resolved through `@rozie/unplugin { target: 'lit' }`) and the component renders + reacts to attribute changes — verified by a Playwright e2e in a new `examples/consumers/lit-vanilla-demo/`.
  5. Each of the existing 4 framework demos (vue-vite, react-vite, svelte-vite, angular-analogjs) additionally consumes the Lit-emitted output via the host framework's web-components-interop layer (React 19 native `customElements`, Vue native, Svelte native, Angular `CUSTOM_ELEMENTS_SCHEMA`) — one integration test per host framework, demonstrating the strategic "ship one, consume from anywhere" claim.
  6. Component composition + recursion (Phase 06.2) emits per Lit idioms: cross-component is `import './Foo.rozie'` (registers the custom element via side effect at module load) + `<rozie-foo>` tag in `html\`...\``; self-reference uses the same pattern (the class registers itself with `customElements.define()` at module load, so self-tags work natively without forwardRef-style ceremony).
  7. The dist-parity gate is extended for Lit: 8 examples × 3 entrypoints = 24 new byte-equal assertions, parallel to Solid (Phase 06.3) and the existing 4 targets.

**Plans**: 3 plans

- [x] 06.4-01-PLAN.md — Wave 1 scaffold: @rozie/target-lit + @rozie/runtime-lit packages, unplugin Lit branch, core/cli/babel-plugin extensions, diagnostics codes (ROZ830/831/840), REQUIREMENTS.md LIT-T-01..07
- [x] 06.4-02-PLAN.md — Wave 2 emitter completeness: full emitScript/emitTemplate/emitListeners/emitSlotDecl/emitStyle implementations; 8 fixture snapshots locked; SC1/SC2/SC3/SC6 integration tests
- [x] 06.4-03-PLAN.md — Wave 3 demo + dist-parity + lint + cross-framework: lit-vanilla-demo (Vite ^6 + 8 routes + Playwright e2e SC4/SC2), lit-ts type-check gate, tests/lit-lint (eslint-plugin-lit + eslint-plugin-wc, --max-warnings 0), tests/dist-parity extension to 184 assertions, SC5 /lit-interop routes in 4 existing demos

### Phase 7: Validation, Acceptance & Hardening

**Goal**: Rozie ships v1. All eight reference examples compile correctly to all six targets without post-edit; a Playwright cross-target visual regression suite asserts pixel-equivalent output across React/Vue/Svelte/Angular/Solid/Lit for each example; React StrictMode passes for every example; HMR state preservation works in dev mode; and a public regression fixture suite is seeded so every closed compiler bug from this point forward becomes a permanent test. This is the "looks done but isn't" phase — it surfaces bugs across all previous phases and requires iteration. (Sourcemap accuracy was extracted into Phase 06.1; component composition into Phase 06.2; Solid + Lit targets landed in Phases 06.3 + 06.4; Phase 7 validates the expanded reference example set across the full 6-target matrix = 48 outputs.)
**Depends on**: Phase 06.4
**Requirements**: EX-01, EX-02, EX-03, EX-04, EX-05, EX-06, COMP-05, QA-01, QA-02, QA-03, QA-04
**Success Criteria** (what must be TRUE):

  1. Each of the eight reference examples (`Counter`, `SearchInput`, `Dropdown`, `TodoList`, `Modal`, `TreeNode`, `Card`, `CardHeader`) compiles correctly to all six targets (React / Vue / Svelte / Angular / Solid / Lit) without any post-emit human edits, and the compiled outputs render and behave identically across targets — verified by per-example × per-target integration tests (EX-01..EX-05; TreeNode / Card / CardHeader coverage added in Phase 7 plans; Solid + Lit coverage extends from Phases 06.3 / 06.4). Phase 06.2 patched this criterion 5 → 8 examples; Phases 06.3 / 06.4 extended the target axis 4 → 6 (48 outputs total).
  2. The Playwright cross-target visual regression suite runs all eight examples in each of the six targets, takes screenshots in a deterministic test environment, and asserts pixel-equivalent output (≤ 2px diff per component); CI fails on regression (EX-06). The Lit target additionally runs in a vanilla-HTML host (no framework) to validate the strategic "ship one, consume from anywhere" claim.
  3. A 6-class slot acceptance test matrix executes per target — default slot, named slots, scoped slots with params, default-content fallback, presence-check (`$slots.x`), nested slots — and passes for all six targets, with documented React render-prop ergonomic compromise and Lit scoped-slot-params data-attribute compromise (QA-02).
  4. All eight reference examples run cleanly under `<React.StrictMode>` with no double-fire bugs in lifecycle pairing; the `Modal.rozie` body-scroll-lock regression test from PITFALLS Pitfall 3 is committed and CI-gated (QA-03). Solid runs cleanly under its `solid-js/dev` development-mode double-mount (analogous StrictMode coverage); Lit runs cleanly under `connectedCallback`/`disconnectedCallback`/`connectedCallback` reattach cycles.
  5. Editing a `<style>` value in `examples/Counter.rozie` while the dev server is running preserves component state in `<data>` (e.g., `hovering: true` survives the edit) for the Vite plugin in dev mode; HMR boundary integrates with each target framework's HMR convention (QA-04).
  6. A `tests/regressions/` directory contains at least one fixture per closed compiler bug from Phases 1-7, each fixture including the originating issue number and minimal `.rozie` reproduction; the public regression suite is the v1 trust floor going forward (QA-01).

**Plans**: 5 plans

- [x] 07-01-PLAN.md — Angular unblock spike (D-01..04 version-pin) + unplugin dep-fix + .rozie.ts artifact resolution (Wave 1, de-risk gate, has checkpoint)
- [x] 07-02-PLAN.md — tests/visual-regression workspace: single-host mount harness, pinned-container Playwright config, Vue baselines (Wave 2, has checkpoint)
- [x] 07-03-PLAN.md — 48-cell visual-regression run + 6-class slot acceptance matrix + divergence catalogue (Wave 3, has checkpoint)
- [x] 07-04-PLAN.md — Dev-mode stress harnesses (StrictMode/Solid-dev/Lit-reattach) + per-target HMR state-preservation specs (Wave 3, has checkpoint)
- [x] 07-05-PLAN.md — Bug-fix iteration loop + tests/regressions seeding + parity matrix + VitePress parity page + D-06 batch review (Wave 4, has checkpoints)

**UI hint**: no

### Phase 07.5: Lit consumer-side scoped/portal slot bridge (INSERTED)

**Goal:** Close the dominant outstanding Lit-target consumer-side compiler gap. `emitSlotFiller` (Lit) currently emits `<element slot="X">` light-DOM projection for portal slots and for scoped slots whose consumer destructures scope params — but the producer's Lit wrapper expects those as function-typed properties of shape `.<X>=${(scope) => html\`…\`}`. Add a branch in `emitSlotFiller` so portal slots and scoped slots route through the function-prop emit path; paramless static slots keep the existing light-DOM projection (no regression to Modal/header/footer/default static-fill cases). The closure-of-closure signal is removing 3 visual-regression `fixme` gates that were specifically wired to mask this gap.

**Why inserted after Phase 07.4**: Phase 07.4 closed D-LIT-12 (producer-side function-typed slot-param dispatch for `r-for` loop-local capture). The mirror gap on the CONSUMER side — having the consumer emit content the Lit wrapper can actually invoke as a function-prop — was deferred at Spike 003 land time. Per [[lit-consumer-slot-bridge-gap]] this is the dominant outstanding compiler limit; it blocks `PortalList` lit, `DynamicSlotName` lit, and `SortableListDemo` lit consumer demos. Same `emitSlotFiller.ts` surface area as 07.4's siblings, so the context is fresh.

**Requirements**: COMP-05 (cross-framework slot bridge parity — closes the dominant Lit-only consumer-side gap)

**Depends on**: Phase 07.4 (same emitSlotFiller area; producer-side function-typed slot-param dispatch already landed), Spike 003 (portal-slot primitive `<slot portal />`), Phase 07.2 (named & scoped slot consumer-side support — establishes the existing branch structure to extend), Phase 07.3.2 (consumer-side dynamic-name slot bridge — non-Lit precedent for `#[expr]` dispatch)

**Success Criteria** (what must be TRUE):

1. `packages/targets/lit/src/emit/emitSlotFiller.ts` emits `.<X>=${(scope) => html\`…\`}` function-prop form for slot fills when the producer's `SlotDecl` satisfies (`SlotDecl.isPortal === true` OR (`SlotDecl.params.length > 0` AND the consumer's `<template #X="{ … }">` filler destructures scope params)). The `scope` arg destructures with the consumer's binding pattern, matching consumer-side React/Solid render-prop semantics.
2. Paramless static slots (Modal `header`/`footer`/`default` with no scope params) continue to use the existing `<element slot="X">` light-DOM projection — no regression to existing producer/consumer Modal flows; all current `tests/slot-matrix/fixtures/*` Lit baselines stay byte-identical or are explicitly re-blessed with rationale.
3. `tests/visual-regression/specs/portal-list.spec.ts` — `LIT_PORTAL_GAP` constant removed; the `runner = built && !hasLitGap ? test : test.fixme` gate flips to `test` for lit. `PortalList · lit` cell renders correctly (scope received, content visible, no `Cannot read properties of undefined (reading 'color')` page error).
4. `tests/visual-regression/specs/matrix.spec.ts` — `PORTAL_LIT_GAP` removed from `isPortalLitGap()`; `PortalList · lit` matrix cell renders against the same baseline the other 5 targets use.
5. `tests/visual-regression/specs/dynamic-slot-name.spec.ts` — `LIT_DYNAMIC_NAME_GAP` removed; lit dispatches `<template #[expr]>` slot names correctly. (Note: if dynamic-slot-name requires non-trivial additional dispatch plumbing beyond the function-prop branch, the planner may carve it into a Phase 07.6 follow-up and document the carve in CONTEXT.md — but the scoped+portal branch lands in this phase regardless.)
6. `bundle/SortableListDemo` playground snippet renders correctly on the lit target (currently shows empty `<rozie-preview-1>`); 5/6 targets working post-2026-05-18 expand to 6/6.
7. No regression in the 5 currently-working targets: React/Vue/Svelte/Solid/Angular visual-regression matrix + slot-matrix cells stay green; producer-side Lit Modal/Dropdown/TodoList fixtures untouched by this phase.
8. `pnpm turbo run test --force --continue` and `pnpm turbo run typecheck --force --continue` both green (modulo the 3 pre-existing pre-07.4 `@rozie/unplugin#test transform-angular` failures + the Angular `Dropdown.rozie.ts:91 TS2554` baseline noise — those are explicitly OUT of scope and tracked separately in [[outstanding-issues-post-gate-rollout]]).

**Plans:** 1/1 plans complete

Plans:

- [x] 07.5-01-PLAN.md — Branch consumer-side Lit emitSlotFiller on portal + scoped-with-destructure to a function-prop emit path; add producer-side @property declaration; thread SlotDecl.isPortal + producerSlotParamCount through threadParamTypes; re-bless snap+dist-parity fixtures in lockstep (WR-07); lift 3 VR fixme gates (LIT_PORTAL_GAP, PORTAL_LIT_GAP, LIT_DYNAMIC_NAME_GAP); single atomic commit (Wave 1, autonomous)

### Phase 07.4: Lit loop-scoped slot-param listeners (D-LIT-12 fix) (INSERTED)

**Goal:** Close D-LIT-12 so producer-side function-typed scoped-slot params inside `r-for` (e.g. `<slot :remove="() => removeItem(item.id)">` in TodoList) emit inline `@event` bindings on the `<slot>` element — naturally capturing loop-local `item` — instead of host-scope `addEventListener` lines that reference undeclared identifiers. TodoList passes `tsc --noEmit` in the lit-lint gate; the dead `emitHostListenerWiring.ts` helper retires; 3 Lit fixture snapshots re-blessed.
**Requirements**: COMP-05 (cross-framework slot bridge parity — fixes Lit-only gap)
**Fixes**: D-LIT-12
**Depends on:** Phase 7
**Plans:** 1/1 plans complete

Plans:

- [x] 07.4-01-PLAN.md — Inline @event on <slot> for function-typed slot-param dispatches; retire emitHostListenerWiring.ts; re-bless TodoList/Dropdown/Modal Lit snapshots; flip TSC_EXAMPLES to full EXAMPLES list (Wave 1, autonomous, single atomic commit)

### Phase 07.1: Modifier Extension API — 6-Target Completion & Type-Identity Fix (INSERTED)

**Goal**: A third-party plugin author can ship one `ModifierImpl` that compiles correctly across all six targets (React/Vue/Svelte/Angular/Solid/Lit) using only the public SemVer-stable `@rozie/core` surface, and every target package's published `.d.ts` references core's `ModifierRegistry` rather than an inlined private copy.

**Why inserted after Phase 7**: Phase 7 validated the 6×8 cross-target output matrix and, in doing so, surfaced two gaps the earlier incremental phases left behind. (a) The `ModifierRegistry` `.d.ts` type-identity defect — caught by the `tests/plugins/swipe` dogfood canary, the lone red package in the workspace typecheck (42/43). Each target package's published `.d.ts` inlines a private-class copy of `ModifierRegistry` because target src imports it via relative `../../../core/src/...` paths, making it nominally incompatible with `@rozie/core`'s exported copy — any third-party author who does `import { ModifierRegistry } from '@rozie/core'` and passes it to `emitReact`/`emitVue`/etc. gets a type error. (b) The modifier extension API was only ever wired for Vue (P3) + React (P4) + Svelte/Angular (P5) and never extended when Solid + Lit landed in 06.3/06.4 — `ModifierImpl` has no `solid?`/`lit?` methods and there are no `Solid`/`LitEmissionDescriptor` types, so a third-party modifier author literally cannot target Solid or Lit today. This phase closes both before v1 ships.

**Depends on**: Phase 7 (and Phases 06.3 + 06.4 for the Solid/Lit emitters it extends)
**Requirements**: MODX-01, MODX-02, MODX-03, MODX-04

**Success Criteria** (what must be TRUE):

  1. The `ModifierRegistry` `.d.ts` type-identity bug is fixed: `@rozie/core` is given a self-reference so `import { ModifierRegistry } from '@rozie/core'` resolves within core's own typecheck, and the target packages' type-only `ModifierRegistry` imports are redirected to the `@rozie/core` package specifier. Full workspace `pnpm turbo run typecheck --force --continue` is green (43/43). [Decided: Option A — self-reference, not relocating `compile()` to a coordinator package. A naive redirect without the self-reference was attempted and reverted: it produced ~90 errors because core could not resolve its own specifier and a core/src-vs-core/dist identity split appeared.]
  2. `ModifierImpl` gains `solid?` and `lit?` emission methods; `SolidEmissionDescriptor` and `LitEmissionDescriptor` types are added to `@rozie/core`'s public surface; the `@rozie/target-solid` and `@rozie/target-lit` emitters consume a third-party modifier's `solid()` / `lit()` descriptor — mirroring how Svelte/Angular were wired in Phase 5. The additions are SemVer-additive: the existing 4-target surface is unchanged.
  3. `tests/plugins/swipe`'s `swipeModifier` implements all 6 target methods and the test suite (`swipe-shape` + per-target emit tests) covers all 6 targets and passes — the dogfood canary proves the extension API is viable across the full target matrix without any `@rozie/core` changes beyond the SemVer-additive descriptor types.

**Plans**: 3 plans

- [x] 07.1-01-PLAN.md — Core self-reference + SemVer-additive type surface: SolidEmissionDescriptor/LitEmissionDescriptor, solid?/lit? on ModifierImpl, ROZ813/ROZ832 codes, barrel re-exports, 10 builtins implement solid()/lit() (Wave 1)
- [x] 07.1-02-PLAN.md — Redirect 39 import sites to @rozie/core specifier; migrate target-solid off impl.react() stopgap; rewrite target-lit hand-rolled switch to registry dispatch; full-workspace 43/43 typecheck gate (Wave 2)
- [x] 07.1-03-PLAN.md — Extend tests/plugins/swipe dogfood canary to all 6 targets (4 devDeps, 6 swipeModifier hooks, swipe-shape + 4 new per-target emit tests) + .d.ts-identity regression assertion (Wave 3)

### Phase 07.2: Named & scoped slot consumer-side support (INSERTED)

**Goal**: A `.rozie` author can use another Rozie component that defines named and/or scoped slots — filling them via consumer-side template syntax — and the resulting six-target output renders correctly. The dogfood gate is concrete: `examples/Modal.rozie` (which exposes a default slot, `header` and `footer` named slots, and a `:close` scoped argument on each) is consumable from another `.rozie` component with all slot fills working across React, Vue, Svelte, Solid, Lit, and Angular.

**Why inserted after Phase 7.1**: Phase 06.2 shipped first-class `<components>` block + `tagKind` discriminator so one `.rozie` file can *reference* another, but the slot-fill consumer side was deferred. Phase 7's 48-cell visual regression matrix didn't surface the gap because every reference example consumes its imports as self-closing tags (no slot fills). The Modal example proves the producer side, but the corollary — "now use Modal in something" — has no path today. This is a v1 composition gap, not a v2 enhancement: cross-framework component libraries are precisely the audience this project targets, and Modal-style components are table stakes.

**Depends on**: Phase 06.2 (`<components>` block + `tagKind` IR), Phase 4 (slot IR finalized), Phase 06.4 (last target that audited slot IR against web-component semantics)

**Requirements**: SPEC-R1, SPEC-R2, SPEC-R3, SPEC-R4, SPEC-R5, SPEC-R6, SPEC-R7, SPEC-R8 (locked in 07.2-SPEC.md)

**Success Criteria** (what must be TRUE):

  1. Consumer-side `.rozie` template grammar supports `<template #header>...</template>`, `<template #default="{ close }">...</template>`, and shorthand default-slot children (any non-`<template>` children of a component element become the default slot content).
  2. `RozieIR` gains a `SlotFillerDecl` shape (name, scoped-params, body AST, source location) attached to component element nodes; shape is snapshot-locked.
  3. A new dogfood example, `examples/ModalConsumer.rozie`, uses `Modal` with a header fill, a footer fill, default-slot children, and at least one scoped slot reading `:close`. The example compiles cleanly to all 6 targets.
  4. The example renders correctly in all 6 consumer demos: header/footer markup appears, default-slot body renders, scoped `close` callback closes the modal when invoked from inside a fill. Verified by Playwright visual regression + an interaction spec that clicks a `close`-bound element inside a slot fill.
  5. React render-prop fallback is documented in `docs/parity.md` as the one ergonomic divergence — exact shape of the consumer-side React import is spelled out for library authors. (Per CLAUDE.md "documented edge cases are acceptable.")
  6. Strict diagnostics: filling a slot the component doesn't declare → `ROZ`-coded warning with code frame; failing to fill a required slot → silent no-op (slot fallback content used, matching Vue/Svelte semantics).

**Plans**: 6 plans

- [x] 07.2-01-PLAN.md — Parser grammar + SlotFillerDecl IR + IR cache + producer resolver + ROZ940..ROZ947 codes (Wave 1)
- [x] 07.2-02-PLAN.md — Vue (type-flow canary) + React + Svelte consumer-side emit + consumer-named-fill fixture + multi-file runner extension (Wave 1)
- [x] 07.2-03-PLAN.md — Solid + Lit + Angular consumer-side emit + consumer-scoped-fill fixture + ROZ947 negative test + 48-cell dist-parity subset (Wave 1 ship-or-pause boundary)
- [x] 07.2-04-PLAN.md — Dynamic slot names (R5) across all 6 targets + consumer-dynamic-name fixture + runtime-toggling Playwright spec (Wave 2)
- [x] 07.2-05-PLAN.md — Slot re-projection (R6) across all 6 targets + 3-file consumer-re-projection fixture + ROZ943/944 diagnostics (Wave 2)
- [x] 07.2-06-PLAN.md — ModalConsumer + WrapperModal dogfood + 6 demo wiring + Linux-rendered VR baselines + docs/parity.md + 216/216 dist-parity gate (Wave 2, has checkpoint)

**UI hint**: no

**Out-of-scope guardrails (refined in SPEC.md):**

- Dynamic slot names (`<template #[name]>`) — defer to v2
- Slot props on the producer side beyond what already ships — this phase is purely consumer-side
- Render-prop ergonomic improvements for React beyond the documented fallback — separate v2 RFC

### Phase 07.3: Consumer-side two-way binding (`r-model:propName=`) across 6 targets (INSERTED)

**Goal**: A `.rozie` author consuming a component whose prop is declared `model: true` can opt into two-way binding via `r-model:propName="$data.expr"` (argument-form), and the per-target emit engages the producer's existing two-way machinery so writes propagate back to the consumer's reactive state in all 6 targets — without any new producer-side work.

**Why inserted after Phase 7.2**: Phase 07.2 shipped consumer-side slot fills and exposed the gap concretely: `ModalConsumer.rozie`'s scoped `close` callback fires correctly in all 6 targets (the compiler emits the wiring), but only Vue + Angular's runtimes actually unmount the modal under one-way `:open` binding. Svelte's `$bindable` re-syncs from parent each render; React/Solid/Lit's controllable-state runtimes treat writes-in-controlled-mode as no-ops. The producer-side `model: true` two-way machinery is already there — what's missing is consumer-side syntax to engage it. The 4 `.fixme`'d close-spec cells in Phase 07.2 Plan 07.2-06.1 become the dogfood acceptance gate for this phase.

**Depends on**: Phase 07.2 (`SlotFillerDecl` + 6-target consumer-side emit baseline), Phase 06.4 (last target audited slot IR + reactivity)

**Requirements**: To be locked in 07.3-SPEC.md. Working list:

- TWO-WAY-01: parser accepts `r-model:propName="expr"` argument-form on `tagKind: 'component'` elements
- TWO-WAY-02: bare `r-model="expr"` (no argument) on form inputs remains form-input-only sugar (no change)
- TWO-WAY-03: each of the 6 target emitters wires the consumer-side two-way idiom for `r-model:propName`
- TWO-WAY-04: `propWriteValidator` confirms the target component's prop is declared `model: true`, emits `ROZ`-coded error if not (e.g., `ROZ950 TWO_WAY_UNSUPPORTED_PROP`)
- TWO-WAY-05: dogfood gate — `examples/ModalConsumer.rozie` updated to `r-model:open="$data.open"`; all 6 close-spec cells un-fixme'd and pass; full 216-cell dist-parity stays green or is re-blessed for ModalConsumer's 4 entrypoints
- TWO-WAY-06: docs/parity.md updated — "Consumer-side two-way binding" section replaces the Phase 07.2 documented divergence note

**Success Criteria** (what must be TRUE):

  1. `<Modal r-model:open="$data.open">` parses cleanly and lowers to an IR shape that captures both the target prop name AND the consumer-side writable expression.
  2. Each of the 6 target emitters generates the correct consumer-side two-way idiom (Vue `v-model:open`, Svelte `bind:open`, React `open={open} onOpenChange={setOpen}` pattern, Solid analogous controllable-state binding, Angular `[(open)]`, Lit custom-event listener pair).
  3. Writing to the prop from inside the producer (e.g., the scoped `close` callback) propagates back to the consumer's reactive state in all 6 targets; `tests/visual-regression/specs/modal-consumer-close.spec.ts` un-`fixme`'s the 4 gated cells and they pass.
  4. `propWriteValidator` rejects `r-model:propName` when the producer prop is NOT `model: true`, with a code-framed `ROZ950` (or chosen code) diagnostic at the consumer source location.
  5. Existing form-input `r-model="$data.x"` (no argument) continues to work unchanged across the 4 targets that ship that sugar today.
  6. `examples/ModalConsumer.rozie` becomes the in-codebase canary: closing any modal via its `×` button unmounts that modal in all 6 consumer demos (no remaining platform-runtime divergence).

**Out-of-scope guardrails:**

- Other Vue-style modifiers on `r-model:` (e.g., `.lazy`, `.number`, `.trim`) — defer to v2
- Per-target opt-out (`r-model:open.uncontrolled=`) — defer until a real use case appears
- Refactoring existing form-input `r-model` emit — additive, not invasive

**Plans**: 9 plans

- [x] 07.3-01-PLAN.md — SPEC.md + REQUIREMENTS.md TWO-WAY-01..06 registration + ROZ949/950/951 codes + 7 failing test scaffolds + slot-matrix fixture (Wave 1)
- [x] 07.3-02-PLAN.md — IR twoWayBinding variant + lowerer branch + isWritableLValue helper + validateTwoWayBindings + compile.ts + unplugin transform.ts 7-site wiring (Wave 2)
- [x] 07.3-03-PLAN.md — Vue emitter: v-model:propName="expr" emit branch + snapshot test (Wave 3, parallel)
- [x] 07.3-04-PLAN.md — Svelte emitter: bind:propName={expr} emit branch + snapshot test (Wave 3, parallel)
- [x] 07.3-05-PLAN.md — Angular emitter: long-form [prop]/(propChange) emit branch + snapshot test (Wave 3, parallel)
- [x] 07.3-06-PLAN.md — React emitter: prop={local} on{Capitalize}Change={setter} + resolveTwoWayTarget helper + snapshot test (Wave 3, parallel)
- [x] 07.3-07-PLAN.md — Solid emitter: prop={local()} on{Capitalize}Change={setter} + resolveTwoWayTarget helper + snapshot test (Wave 3, parallel)
- [x] 07.3-08-PLAN.md — Lit emitter: .prop=${} @prop-change={(e: CustomEvent) => ...} + resolveLitSetterText + kebabize + snapshot test (Wave 3, parallel)
- [x] 07.3-09-PLAN.md — Dogfood: per-instance state ModalConsumer + WrapperModal forwarding + 6 ModalConsumer + 6 WrapperModal dist-parity fixtures + close-spec un-fixme + docs/parity.md + todo move (Wave 4, checkpoint)

**UI hint**: yes (visual regression close-spec on all 6 targets is the acceptance gate)

### Phase 07.3.1: Consumer-side composition hardening — close the 3 Phase 07.3 deferred blockers (INSERTED)

**Goal**: All 6 targets pass the `modal-consumer-close.spec.ts` close-button-unmounts assertion end-to-end (currently 4/6 — vue/react/angular/solid — with svelte/lit `.fixme`'d pending the 3 producer-side fixes below). The consumer-side `r-model:propName=` directive must reject silently-broken edge cases at compile time rather than producing crash/corruption at runtime in React/Solid/Lit.

**Three blockers from Phase 07.3 `deferred-items.md` (consolidated into one short-spike phase):**

1. **Validator/emitter contract divergence — deep-chain LHS** (REVIEW CR-01..CR-04): `isWritableLValue` accepts `$data.x.y.z` and `$props.x.y` per D-03's "permissive" rule, but React/Solid/Lit `resolveTwoWayTarget` emitters cannot produce correct code for deep chains. React throws (CR-01), React's setter mutates const-destructured useState locals (CR-02), Solid clobbers the root signal (CR-03), Lit mutates `.value` sub-properties without notifying signals (CR-04). **Fix**: tighten `packages/core/src/semantic/lvalue.ts` to require the head to be the ONLY member access (reject deep chains for both `$data` and `$props` heads); emit ROZ951 with code-frame; update `lvalue.test.ts` so the `accepts $data.x.y` assertion flips to rejection; update CONTEXT D-03 to reflect shallow-only constraint pending proper per-target deep-chain emit (post-v1).

2. **Svelte producer snippet-arg shape mismatch** (deferred-items #1): Producer `Modal.svelte` calls `{@render header(close)}` (positional), consumer `ModalConsumer.svelte` destructures `{#snippet header({ close })}` (object). `{ close } = <function>` yields `close === undefined`; the × button's `onclick={close}` is a no-op. **Fix**: change the Svelte producer-side emit in `packages/targets/svelte/` (likely `emitTemplateNode.ts` or `emitSlot.ts` — the `{@render ...}` call site) to pass `{@render header({ close })}` matching SlotDecl `params` shape; verify against all 6 SlotDecl-consuming producer fixtures.

3. **Lit producer first-paint observer race** (deferred-items #2): Producer's `observeRozieSlotCtx` registration in `firstUpdated()` populates `this._headerCtx` AFTER initial render. Consumer's button `@click=${this._headerCtx?.close}` resolves to `undefined` on first paint, so clicking × is a no-op. **Fix**: wire the observer synchronously before first paint — candidates include moving registration into the constructor or `connectedCallback`, or using a synchronous slot-ctx lookup helper. Verify with the Phase 07.2-03 `lit-scoped-fill-firstpaint.spec.ts` regression test.

**Dogfood gate (acceptance for the phase)**:

- `tests/visual-regression/specs/modal-consumer-close.spec.ts`: un-fixme svelte + lit by adding them back to `TARGETS_WHERE_CLOSE_PROPAGATES`; all 6 cells assert `toHaveCount(3) → toHaveCount(2)` after × click and pass
- `pnpm --filter @rozie/core test`: lvalue.test.ts deep-chain rejection cases pass; ROZ951 fires with code-frame
- `pnpm --filter dist-parity test` stays GREEN (336/336) — Svelte snippet-arg fix re-blesses any affected fixtures; Lit observer wiring is runtime-only (no fixture change expected)

**Depends on**: Phase 07.3 (the 3 blockers were diagnosed in 07.3's REVIEW + deferred-items.md)

**Out-of-scope guardrails**:

- Per-target deep-chain emit support (the *alternative* to shallow-only tightening) — defer to a post-v1 RFC; the current direction is to reject, not implement
- Phase 07.3 REVIEW.md WR/IN polish backlog (typo did-you-mean, modifier chain handling, dead-flag cleanup) — separate Phase 07.3.2 candidate if a follow-up is needed

**Plans**: 8 plans (Plans 05 + 06 added 2026-05-17 after Plan 04 Task 3 dogfood checkpoint surfaced two pre-existing Phase 07.2 emit gaps; Plans 07 + 08 added 2026-05-17 after Plan 04 re-dispatch checkpoint surfaced two MORE Lit architectural gaps — D-LIT-17 function-typed slot-arg event-dispatch and D-LIT-18 slot-fill DOM structure parity). All 8 complete 2026-05-17. 6/6 modal-consumer-close.spec.ts cells GREEN end-to-end.

- [x] 07.3.1-01-PLAN.md — Validator tightening + ROZ951 message update + per-target defensive-throw comments (Blocker #1, D-01) (Wave 1)
- [x] 07.3.1-02-PLAN.md — Svelte producer snippet-arg object-shape + Snippet type tuple tightening + 5 snap re-bless (Blocker #2, D-02) (Wave 1)
- [x] 07.3.1-03-PLAN.md — Lit late-binding event-handler wrap + _slotCtxWired flag + microtask retry + updated() re-attempt (Blocker #3, D-03) (Wave 1)
- [x] 07.3.1-04-PLAN.md — Dist-parity re-bless + un-fixme dogfood close-spec + full revalidation matrix + ROADMAP/STATE update (D-02 D-03 D-04, Wave 2, has checkpoint)
- [x] 07.3.1-05-PLAN.md — Lit pre-seed _hasSlot<X> from light DOM in connectedCallback (Blocker D-LIT-15) (Wave 1)
- [x] 07.3.1-06-PLAN.md — Svelte producer reads snippets prop + $derived merge for dynamic-name slot bridge (Blocker D-SV-16) (Wave 1)
- [x] 07.3.1-07-PLAN.md — Lit consumer emits dispatchEvent for function-typed slot-arg click handlers (Blocker D-LIT-17) (Wave 1)
- [x] 07.3.1-08-PLAN.md — Lit slot-fill DOM parity: spread slot= across multi-root template children instead of div-wrap (Blocker D-LIT-18, depends on 07) (Wave 1)

**UI hint**: yes (dogfood close-spec on svelte + lit demos is the acceptance gate)

### Phase 07.3.2: Consumer-side dynamic-name slot bridge across React/Solid/Angular + React WrapperModal re-projection (INSERTED)

**Goal**: All 3 modals in `examples/ModalConsumer.rozie` render their header/footer content correctly across all 6 targets — closing the consumer-side composition gaps that Phase 07.3.1 addressed only for Svelte (D-SV-16) and Lit (D-LIT-17/18). Modal 2 (`<template #[$data.slotName]>` dynamic-name fill) must populate the producer's `header` slot in React, Solid, and Angular. Modal 3 (`<WrapperModal>` with re-projected `#brand` + `#actions` slots) must forward the consumer's fills through the wrapper into the inner Modal in React. Peer hotfix to Phase 07.3.1.

**Why extracted as a separate phase**: Surfaced by dogfood observation 2026-05-16 — Dan opened all 6 target consumer demos in browser and verified per-target slot rendering. Phase 07.3.1 closed with all 6 targets passing the `modal-consumer-close.spec.ts` cells (8/8 click-to-close) but the dogfood walkthrough revealed dynamic-name slot fills + re-projection still silently fail on the 3 targets that weren't on 07.3.1's hotlist. Inserting as a peer to 07.3.1 (rather than reopening 07.3.1) preserves the existing 07.3.1 VERIFICATION + REVIEW + 8 SUMMARYs and rerun-free Gradle test matrix; the bugs are independent and the fix scope is small per target.

**Depends on**: Phase 07.3.1 (uses the same dogfood fixture `examples/ModalConsumer.rozie` + `examples/WrapperModal.rozie` from 07.3-09); precedent commit `6060408` (D-SV-16 Svelte producer snippets+$derived merge) is the reference pattern to port across React, Solid, Angular.

**Requirements**: None new — closes a coverage gap on existing COMP-05/SLOT-* requirements.

**Success Criteria** (what must be TRUE):

  1. **React producer-side dynamic intake**: `packages/targets/react/src/emit/emitPropsInterface.ts` adds `slots?: Record<string, (ctx: any) => ReactNode>` to the Props interface when `ir.slots.length > 0`; emitted producer component merges per-slot `props.<key> ?? props.slots?.<key>` so statically-named fills (Modal 1 + Modal 3) win and dynamic-name fills (Modal 2) are picked up via fallback. Mirrors `6060408` for Svelte.
  2. **Solid producer-side dynamic intake**: `packages/targets/solid/src/emit/emitScript.ts` (or shell.ts) adds `slots?: Record<string, (ctx: any) => JSX.Element>` to the Props type when `ir.slots.length > 0`; merge uses Solid signal-friendly precedence (`props.<key>?.(ctx) ?? props.slots?.<key>?.(ctx)`).
  3. **Angular producer-side dynamic intake**: `packages/targets/angular/src/emit/emitScript.ts` adds `@Input() templates?: Record<string, TemplateRef<unknown>>;` field when `ir.slots.length > 0`; the existing `@ContentChild(...) <key>Tpl` static-name path is preserved, and dynamic-name dispatch falls back to `templates?.[key]` when the ContentChild ref is undefined.
  4. **React WrapperModal re-projection**: `examples/consumers/react-vite` ModalConsumer Modal 3 (`<WrapperModal><template #brand>...</template><template #actions>...</template></WrapperModal>`) renders both `#brand` (inside the inner Modal's `header`) and `#actions` (inside the inner Modal's `footer`). Root cause TBD during planning — investigate `emitSlotInvocation.ts` re-projection chain.
  5. **Visual regression baselines re-blessed**: `tests/visual-regression/__screenshots__/ModalConsumer-{react,solid,angular}.png` regenerated via the pinned `mcr.microsoft.com/playwright:v1.60.0-jammy` image per DEBUG.md:283-321 recipe; CI Visual Regression Matrix green.
  6. **Dogfood UAT**: Dan opens all 6 consumer demos (`vue-vite`, `svelte-vite`, `react-vite`, `solid-vite`, `angular-analogjs`, `lit-vanilla-demo`) and confirms all 3 modals render header + footer content correctly. Any remaining "isn't quite right" items captured.

**Plans**: 6 plans

- [x] 07.3.2-01-PLAN.md — React producer-side `slots?:` intake in emitPropsInterface.ts + emitTypes.ts + per-slot `??` merge in emitSlotInvocation.ts (SC#1 D-SV-16 cross-target port) (Wave 1)
- [x] 07.3.2-02-PLAN.md — Solid producer-side `slots?:` intake in emitPropsInterface.ts + per-slot `??` merge inside JSX expressions in emitSlotInvocation.ts (SC#2 D-SV-16 port, Pitfall 2 reactive-tracking) (Wave 1, parallel with 01)
- [x] 07.3.2-03-PLAN.md — Angular producer-side `templates = input<...>()` signal-era intake (per RESEARCH A7) in emitScript.ts Section 6e + merged `*ngTemplateOutlet` binding in emitSlotInvocation.ts (preserves @ContentChild static-name path) (SC#3) (Wave 1, parallel with 01/02)
- [x] 07.3.2-04-PLAN.md — React WrapperModal re-projection root cause fix: align refineSlotTypes.ts:108 with emitTypes.ts:152 (`() => ReactNode`) + invoke at emitSlotInvocation.ts:270-283 no-params named-slot path (SC#4; composes with Plan 01 merge) (Wave 2, depends on 01)
- [x] 07.3.2-05-PLAN.md — Re-bless VR baselines for ModalConsumer-{react,solid,angular}.png via pinned `mcr.microsoft.com/playwright:v1.60.0-jammy` Docker image (DEBUG.md:283-321) + extend modal-consumer-close.spec.ts with Modal 2 + Modal 3 D-04 assertions (SC#5) (Wave 3, depends on 01-04)
- [ ] 07.3.2-06-PLAN.md — HUMAN-UAT: 7-file mirror sync verification + 6-demo boot smoke + Dan walks 18 cells (6 targets × 3 modals) (SC#6) (Wave 4, depends on 05)

**UI hint**: yes (browser-verified ModalConsumer dogfood is the acceptance gate)

### Phase 07.3.2.1: Angular consumer-side templates input binding — close F-07.3.2-11-A (INSERTED)

**Goal:** Close F-07.3.2-11-A — switch Angular consumer-side dynamic-name slot dispatch from emitting a projected `<ng-container *ngTemplateOutlet="templates[<expr>]">` child of the producer to emitting a `[templates]="<getter-name>"` property-input binding on the producer tag. Wires the consumer's class-body `templates` getter into the producer's already-correct `templates()` input signal (Phase 07.3.2 Plan 03). After this phase, the pinned `mcr.microsoft.com/playwright:v1.60.0-jammy` Docker matrix moves from 71/1/7 → 72/0/7, Phase 07.3.2 SC#5 reaches 6/6, and Plan 06 HUMAN-UAT is unblocked for the Angular row.
**Requirements**: None — gap-closure phase tracking `fixes: [F-07.3.2-11-A]`. Closest tracked requirement is COMP-05 (cross-framework slot bridge parity).
**Depends on:** Phase 07.3.2
**Plans:** 1/1 plans complete

Plans:

- [x] 07.3.2.1-01-PLAN.md — RED unit test + GREEN surgical emit fix in emitTemplateNode.ts (DELETE dispatchParts.push at L410-412; INSERT templatesBinding inside dynRefs.length>0 block; INTERPOLATE into return) + emitSlotFiller.ts docstring revision + dist-parity + slot-matrix re-bless + pinned-Docker PNG re-bless + 72/0/7 matrix verify + D-08 host bindings repair (Wave 1, autonomous, fixes: [F-07.3.2-11-A])

### Phase 8: IntelliJ Platform Plugin v1 (Internal Dogfooding)

**Goal**: Every team member writing `.rozie` files for internal dogfooding can do so productively in their primary JetBrains IDE (IDEA Ultimate / WebStorm / PhpStorm / RubyMine / GoLand 2024.2+) within ~1-2 weeks of phase start. The plugin gives them: SFC block recognition, Rozie-specific syntax highlighting (`r-*`, `@evt.modifier`, `:prop`, `{{ }}`, `$`-magic identifiers), JS autocomplete + go-to-definition + rename inside script-flavored blocks (via JavaScriptLanguage injection), HTML/Emmet inside `<template>` (via HtmlLanguage injection), and CSS support inside `<style>` (via CssLanguage injection). Distribution is an internal `.zip` drop — Marketplace listing is a separate post-dogfooding milestone. This is a **parallel tooling track** that does not block the v1 product ship; Phases 4-7 continue independently.
**Depends on**: Phase 3 minimum (validates the `.rozie` syntax is stable enough that a plugin lexer won't churn weekly); see also `.planning/notes/intellij-plugin-architecture.md` for the load-bearing architectural decisions.
**Requirements**: None — this is a tooling track, no v1 product requirements depend on it.
**Success Criteria** (what must be TRUE):

  1. A team member can install the plugin in PhpStorm/WebStorm/IDEA Ultimate via Settings → Plugins → ⚙ → Install Plugin from Disk using a `.zip` produced by `./gradlew buildPlugin`, with no JetBrains Marketplace dependency.
  2. Opening any of `examples/Counter.rozie`, `examples/Dropdown.rozie`, `examples/SearchInput.rozie`, `examples/TodoList.rozie`, `examples/Modal.rozie` shows: SFC block tags distinct from generic HTML, Rozie-specific tokens (`r-*`, `@evt.modifier(args)`, `:prop`, `{{ }}`, `$props`/`$data`/`$refs`/`$emit`/`$computed`/`$onMount`/`$watch`) highlighted with their own scopes, and JS/CSS/HTML inside the appropriate blocks colored by the host languages.
  3. Inside any `<script>`, `<props>`, `<data>`, or `<listeners>` block: typing `cons` triggers JS autocomplete; right-click → "Go to Declaration" on a JS identifier resolves; renaming a JS local variable updates all references within the block — all delivered by the IDE's bundled JS plugin via language injection (no custom reference resolution required for v1).
  4. Inside `<template>`: HTML autocomplete and Emmet expansion work for non-Rozie tags; the IDE's HTML support handles standard attributes; Rozie-specific attributes (`r-*`, `@`, `:`) are recognized and not flagged as errors.
  5. The plugin works on the IntelliJ Platform 2024.2 build floor and at least one current build (verified by `./gradlew runIde` against both); IDEA Community / PyCharm CE are explicitly documented as unsupported (no JS plugin → no language injection → no point).

**Plans**: 6 plans

- [x] 08-01-PLAN.md — Gradle scaffold + file type registration + Wave 0 test infrastructure (Wave 1)
- [x] 08-02-PLAN.md — JFlex lexer (TextMate-grammar parity) + 8 fixture snapshots + D-07 drift check (Wave 2)
- [x] 08-03-PLAN.md — SyntaxHighlighter + ColorSettingsPage with 15 user-themable token classes (Wave 3)
- [x] 08-04-PLAN.md — Minimal ParserDefinition + RozieMultiHostInjector + HTML inspection-suppression (Wave 4)
- [x] 08-05-PLAN.md — GitHub Actions workflow with IU 2024.2.5 + 2025.3 matrix + lexer no-diff guard + tag-driven release (Wave 5)
- [x] 08-06-PLAN.md — v0.1.0 release: README + tag + manual smoke verification (Wave 6, has checkpoint)

**UI hint**: no

**Architecture reference:** `.planning/notes/intellij-plugin-architecture.md` documents the "thin host + injection (NOT full PSI)" decision, the Kotlin/gradle-intellij-plugin-2 stack choice, the Astro-plugin-as-borrowed-pattern call, the deliberate v1-out-of-scope list (LSP, compiler-driven diagnostics, cross-block reference resolution, Marketplace), and the v2 reconsideration framework for compiler integration (Node sidecar vs LSP server vs Kotlin port).

**TextMate fallback retained:** The existing `tools/textmate/rozie.tmLanguage.json` is NOT removed when this plugin ships — it remains the fallback for IDEA Community / PyCharm CE users, anyone outside the org who wants `.rozie` color without a plugin install, and VSCode users (the same TM file is reusable there).

### Phase 08.1: IntelliJ Plugin — Backfill drift: `<components>` block, `r-model:propName=`, slot-fill shorthand, `$onUpdate`, nested-template depth + UAT (INSERTED)

**Goal**: The IntelliJ plugin recognises the `<components>` block as a first-class SFC token (lexer + JS injection + TextMate grammar drift guard) and assigns a distinct, user-themeable token scope to PascalCase component-reference tags inside `<template>` so they are visually distinguishable from native HTML elements. Phase 8 was designed and shipped before Phase 06.2 introduced `<components>` and the `tagKind` discriminator; this insertion closes that gap. **Extended 2026-05-16:** also brings the JetBrains plugin back in sync with the TextMate grammar (project source-of-truth highlighter), which has since gained `r-model:propName=` argument-form directives (Phase 07.3), slot-fill shorthand (`<template #slot>` variants, Phase 07.2), and the `$onUpdate` magic identifier — plus a human UAT pass in WebStorm 2024.2.5 + IDEA Ultimate 2025.3.

**Why extracted as a separate phase**: Phase 8 is complete (6/6 plans done, internal zip shipped). Reopening those plans would invalidate the existing SUMMARY artifacts and rerun the full Gradle test matrix unnecessarily. A decimal insertion is the lowest-friction way to extend the plugin while keeping the Phase 8 history intact. The first two sub-plans (08.1-01, 08.1-02) covered `<components>` + PascalCase refs and shipped 2026-05-07. **Extension rationale (2026-05-16):** Phase 8 was also completed and shipped before Phases 07.2 (slot-fill shorthand), 07.3 (`r-model:propName=` argument-form), and the `$onUpdate` magic identifier landed. The TextMate grammar gained these features in commit `5683696`; the D-07 JFlex-vs-TextMate drift guard is currently RED with 6 unmapped scopes. Plans 08.1-03..06 backfill the JetBrains plugin to match TextMate and add the human UAT pass that was deferred from Plan 08-06 (Tasks 2 and 3).

**Depends on**: Phase 8 (JFlex lexer + TextMate drift guard baseline from 08-02-PLAN.md), Phase 07.2 (slot-fill shorthand syntax), Phase 07.3 (`r-model:propName=` syntax)
**Requirements**: None — tooling track, no v1 product requirements depend on it.

**Success Criteria** (what must be TRUE):

  1. The JFlex lexer (`RozieLexer.flex`) treats `<components>` as a named SFC block token (parallel to `<props>`, `<data>`, `<template>`, `<script>`, `<style>`, `<listeners>`) with its own token class, and the existing lexer fixture snapshots are updated to include `<components>` test cases.
  2. `RozieMultiHostInjector` injects `JavaScriptLanguage` into `<components>` block content (it is a JS object literal, identical treatment to `<props>` and `<data>`).
  3. `tools/textmate/rozie.tmLanguage.json` adds a `<components>` block pattern (begin/end + `source.js` include) so the D-07 TextMate-vs-JFlex drift guard in Plan 08-02 remains green.
  4. PascalCase tag names inside `<template>` are assigned a dedicated `RozieTokenTypes.COMPONENT_REF` token class and a corresponding `RozieColorSettingsPage` entry (`Component reference`) so authors can theme them independently from native HTML element names.
  5. A snapshot integration test in the plugin's test suite verifies that `<Counter />` inside a template lexes with `COMPONENT_REF` and `<div>` lexes with the standard HTML element token — confirming the two token classes are distinct.
  6. The JFlex lexer tokenises `r-model:propName=` argument-form directives (Phase 07.3 syntax) with distinct `DIRECTIVE_COLON` and `DIRECTIVE_ARGUMENT_NAME` IElementType tokens (not falling through to generic `ATTR_NAME`); `RozieColorSettingsPage` exposes user-themable "Directive argument" and "Directive argument separator" entries; and the D-07 TextMate-vs-JFlex drift guard maps `entity.other.attribute-name.directive-argument.rozie` and `punctuation.separator.argument.directive.rozie` (both currently RED).
  7. The JFlex lexer tokenises all four slot-fill shorthand variants from `tools/textmate/rozie.tmLanguage.json:377-442` — `<template #slotName>`, `<template #[dynamicExpr]>`, `<template #slotName="{ destructured }">`, `<template #[dynamicExpr]="{ destructured }">` — emitting distinct `SLOT_FILL_MARKER` (`#`), `SLOT_NAME`, `SLOT_DYNAMIC_BRACKET_OPEN`/`CLOSE` token classes. `RozieColorSettingsPage` exposes corresponding themable entries. The D-07 drift guard maps `entity.name.tag.slot-name.rozie`, `punctuation.definition.slot-fill.rozie`, `punctuation.section.brackets.begin.rozie`, `punctuation.section.brackets.end.rozie` (all currently RED).
  8. `$onUpdate` surfaces as a `MAGIC_IDENT` token in lexer fixture snapshots across all six contexts (script / props / data / listeners / template attribute expression / `{{ }}` interpolation). The line-anchored block-template fix from TextMate `rozie.tmLanguage.json:53` is mirrored in JFlex via a `<template>` nesting depth counter (analogous to the existing `modifierArgsParenDepth`) so nested `<template #slotName>` inside a block body does NOT re-trigger `IN_BLOCK_OPEN_TAG`.
  9. Human UAT pass: the updated plugin is installed in BOTH WebStorm 2024.2.5 and IDEA Ultimate 2025.3, all 8 reference examples (`Counter.rozie`, `Dropdown.rozie`, `SearchInput.rozie`, `TodoList.rozie`, `Modal.rozie`, `ModalConsumer.rozie`, plus the 2 newer fixtures) are opened, and each block is walked confirming: SFC block recognition, all recent syntax (`r-model:propName=`, slot-fill shorthand, `$onUpdate`) highlights correctly, JS/HTML/CSS injection still works post-changes. Any "isn't quite right" items captured in a UAT issues list and either fixed in this phase or triaged into a follow-up. Plan 08-06's deferred Task 2 (tag push + CI release wait) and Task 3 (manual smoke verification) are absorbed into this UAT pass.

**Plans**: 6 plans

- [x] 08.1-01-PLAN.md — JFlex lexer update + COMPONENT_REF token class + JS injection for `<components>` content + TextMate drift guard update (Wave 1)
- [x] 08.1-02-PLAN.md — PascalCase component-reference token scope in `<template>` + ColorSettingsPage `Component reference` entry + integration snapshot update (Wave 2, depends on 08.1-01)
- [ ] 08.1-03-PLAN.md — `r-model:propName=` argument-form: JFlex state + new IElementType tokens (`DIRECTIVE_COLON`, `DIRECTIVE_ARGUMENT_NAME`) + ColorSettingsPage entries + D-07 drift guard mapping (Wave 3, depends on 08.1-02)
- [ ] 08.1-04-PLAN.md — Slot-fill shorthand `<template #slot>` variants: JFlex state + 4 new IElementType tokens (`SLOT_FILL_MARKER`, `SLOT_NAME`, `SLOT_DYNAMIC_BRACKET_OPEN`, `SLOT_DYNAMIC_BRACKET_CLOSE`) + ColorSettingsPage entries + D-07 drift guard mapping (Wave 3, parallel with 08.1-03)
- [ ] 08.1-05-PLAN.md — `$onUpdate` fixture validation across all 6 contexts + `<template>` nesting depth counter for line-anchored block-template fix (Wave 4, depends on 08.1-04)
- [x] 08.1-06-PLAN.md — HUMAN-UAT: install updated plugin in WebStorm 2024.2.5 + IDEA Ultimate 2025.3, walk all 8 examples + ModalConsumer, capture "isn't quite right" issues; absorbs Plan 08-06 deferred Tasks 2-3 (tag push + manual smoke verification) (Wave 5, depends on 08.1-03..05) — **Task 1 (autonomous: version bump + UAT artifact + verifyPlugin gate) COMPLETE 2026-05-17 commits `ddaea72` + `e6dd39d`; Task 2 (human UAT) HALTED 2026-05-17 after surfacing 2 P0 issues — pivoting to Phase 08.2 before tag** (completed 2026-05-18)

**UI hint**: no

### Phase 08.2: IntelliJ Plugin — injection-first architectural pivot (INSERTED)

**Goal**: The IntelliJ plugin matches the TextMate bundle's visual HTML highlighting quality inside `<template>` blocks AND delivers cross-block smart features (`$props.X` / `$data.X` / `$refs.X` Go-to-Declaration into the corresponding SFC block, autocomplete for `r-*` / `@event` / `:prop` / `#slot` / PascalCase component refs, no "unknown attribute" warnings) by following the canonical JetBrains plugin pattern used by Vue / Svelte / Angular / Astro: the JFlex lexer's only job is identifying SFC block boundaries; each block body emits as ONE contiguous BODY token; JetBrains' built-in HTML / JS / CSS PSI trees do all parsing; Rozie-specific syntax extensions layer on top via `XmlAttributeDescriptorsProvider`, `Annotator`, `XmlTagNameProvider`, `PsiReferenceContributor`, `CompletionContributor`.

**Why extracted as a separate phase**: Phase 08.1 UAT on 2026-05-17 surfaced two P0 issues (P0-UAT-01: template body renders as nearly-uncolored text; P0-UAT-02: `$props.x` does not Go-to-Declaration into `<props>`) that revealed the lexer-heavy direction shipped in Phases 08 + 08.1 was architecturally wrong — optimizing for the D-07 TextMate scope-parity contract fragmented HTML injection ranges into pieces too small for `HTMLLanguage` to parse, AND never wired the PSI references needed for smart navigation. User UAT verdict: *"we're better off with the textmate highlighter and no smart features than whatever is currently offered."* A separate-phase pivot is the lowest-friction way to preserve Phase 08 + 08.1's git history (the JFlex carve-outs they shipped are correct implementations of the wrong contract) while reorienting the architecture. v0.2.0 tag is HELD until 08.2 ships; the rebuild ships AS v0.2.0 (the tag was never pushed, no version-collision risk).

**Depends on**: Phase 8 (SFC block boundary lexer baseline), Phase 08.1 (committed code is the starting point for the simplification — IElementTypes from 08.1 may survive as PSI markers even when their JFlex emission rules retire)
**Requirements**: None — tooling track, no v1 product requirements depend on it.

**Success Criteria** (what must be TRUE):

  1. `<template>` body inside any `.rozie` file renders with HTML colors equivalent to the TextMate bundle (tag-brackets / tag-name / attr-name / attr-value all distinct from plain text) when opened in WebStorm 2024.2.5 + IDEA Ultimate 2025.3 — verified by human UAT against all 8 reference examples.
  2. JFlex `Rozie.flex` emits `<template>` body as ONE contiguous `TEMPLATE_BODY` token (mirror of `SCRIPT_BODY` pattern). The PascalCase / slot-fill / r-model: / directive-arg carve-out rules from Phases 08.1-02..04 retire. `templateNestingDepth` counter (Plan 08.1-05) is reassessed: removed if HTML parser handles nesting natively, retained if still needed for SFC outer-block close detection.
  3. `r-*` directives, `@event` bindings, `:prop` bindings, `#slot` fillers, PascalCase component-ref tags inside `<template>` are recognized as known attributes / tags via `XmlAttributeDescriptorsProvider` + `XmlTagNameProvider` — no "Unknown attribute" / "Unknown HTML tag" inspections fire on any reference `.rozie` example.
  4. Distinctive coloring for `r-*` / `@` / `:` / `#` / PascalCase tags is delivered via `Annotator` (or `HighlightVisitor`) over the injected HTML PSI tree, not via JFlex lexer tokens. ColorSettingsPage entries align to Annotator-painted scopes.
  5. `$props.X` MemberExpression inside any JS-injected block (`<script>`, `<data>`, `<listeners>`, `<components>`, attribute-value JS) Go-to-Declaration jumps to the `X` key in `<props>`. Same for `$data.X` → `<data>`, `$refs.X` → `ref="X"` attribute in `<template>`. Find-Usages / Rename across blocks works. Verified by `PsiReferenceContributor` registration + integration test.
  6. Autocomplete: typing `r-` in HTML attribute position inside `<template>` suggests `r-if`, `r-for`, `r-else`, `r-else-if`, `r-show`, `r-model`, `r-bind`, `r-on`, `r-html`, `r-text` (full list from TextMate grammar's `directive-attribute` pattern). Same for `@`, `:`, `#`. Verified by `CompletionContributor` registration + integration test.
  7. The `D-07 TextMateGrammarParityTest` retires. New parity contract: the plugin SyntaxHighlighter + Annotator together paint a visual rendering that matches the TextMate bundle's output to within accepted theme-variation tolerance, AND the smart features TextMate cannot deliver are delivered. New contract test method TBD during planning.
  8. Plan 08.1-06 Task 2 + 3 (HUMAN-UAT + tag push) re-runs against the rebuilt v0.2.0 zip; all P0/P1 issues from the 2026-05-17 UAT halt are CLOSED; tag `intellij-plugin/v0.2.0` is cut locally and STOPS at the push boundary per `feedback_no_autopush`.

**Plans:** 18/18 plans complete

Plans:

- [x] 08.2-01-PLAN.md — JFlex IN_TEMPLATE_BODY collapse + IElementType/highlighter/settings cleanup + delete TextMateGrammarParityTest (SC-2, SC-7)
- [x] 08.2-02-PLAN.md — RozieAttributeDescriptorsProvider + RozieKnownAttributes + RozieContextCheck shared guard (SC-3 attribute side)
- [x] 08.2-03-PLAN.md — RozieComponentTagProvider implements XmlTagNameProvider + XmlElementDescriptorProvider (SC-3 tag side)
- [x] 08.2-04-PLAN.md — RozieAnnotator (HTML) + RozieJsAnnotator (JavaScript) distinctive coloring over injected PSI (SC-4)
- [x] 08.2-05-PLAN.md — RozieJSReferenceContributor + 3 reference classes + InjectedLanguageManager.getInjectionHost spike (SC-5)
- [x] 08.2-06-PLAN.md — RozieAttributeNameCompletionContributor for r-/@/:/# prefix completion (SC-6)

**Cross-cutting constraints:**

- ./gradlew clean buildPlugin verifyPlugin matrix green against IU-242.24807.4 + IU-253.28294.334
- [~] 08.2-07-PLAN.md — Task 1 (autonomous rebuild + UAT checklist rewrite + change-notes) COMPLETE; Tasks 2 + 3 (human UAT + tag cut) DEFERRED into Plan 08.2-12 after UAT re-run #1 surfaced 4 new P1 findings (autonomous: false; SC-1 + SC-8)
- [x] 08.2-08-PLAN.md — RozieJSInspectionSuppressor for <script> + <props>/<data>/<components> JS noise (closes P1-UAT-05 + JS-side P1-UAT-04 partial; SC-3, SC-4)
- [x] 08.2-09-PLAN.md — RozieCssInspectionSuppressor for <style> CSS noise (closes P1-UAT-06; SC-3, SC-4)
- [x] 08.2-10-PLAN.md — RozieComponentRegistry + RozieAnnotator PascalCase paint fix + RozieComponentTagProvider local-components autocomplete (closes P1-UAT-03; SC-3, SC-4)
- [x] 08.2-11-PLAN.md — RozieMultiHostInjector paren-wrap for PROPS_BODY/DATA_BODY/COMPONENTS_BODY (closes Statement-expected family — P1-UAT-04 remainder; depends on 08.2-08; SC-3)
- [x] 08.2-12-PLAN.md — Rebuild v0.2.0 zip + UAT-CHECKLIST re-run #2 section + HUMAN-UAT re-run + tag intellij-plugin/v0.2.0 (autonomous: false; depends on 08-11; SC-1 + SC-8) — Task 1 complete; Task 2 UAT signed off 2026-05-17; Task 3 tag cut INTENTIONALLY SKIPPED per user direction "UAT signoff. Don't cut tag. but close out" — v0.2.0 zip remains on disk for future install/distribution; tag can be cut from this commit anytime
- [x] 08.2-13-PLAN.md — RozieJsMagicIdentifierCompletionContributor + RozieMagicIdentifiers (closes P1-UAT-09 magic-ident JS autocomplete; SC-6)
- [x] 08.2-14-PLAN.md — RozieMultiHostInjector extension for directive attribute-value JS injection + `{{ }}` template interpolations (closes P1-UAT-08; SC-3, SC-5)
- [x] 08.2-15-PLAN.md — Extend Plan 11 paren-wrap dispatch to LISTENERS_BODY (closes P1-UAT-10; SC-3)
- [x] 08.2-16-PLAN.md — Synthetic Rozie globals via Strategy B ambient-decl injection prefix (closes P1-UAT-11 bare magic-ident goto leak + P1-UAT-12 unresolved-method warnings; SC-5)
- [x] 08.2-17-PLAN.md — SCRIPT_BODY token coalescing in RozieMultiHostInjector — closes P1-UAT-13 (script not self-aware); load-bearing finding: JFlex was fragmenting SCRIPT_BODY at `<` characters (SC-5)
- [x] 08.2-18-PLAN.md — Extend Plan 14 with isObjectLiteralShape predicate; route object-literal attribute values through Plan 11's injectJsAsExpression paren-wrap (closes P1-UAT-14 `:class="{...}"` JSLabeledStatement; SC-3)

**Deferred to Phase 08.3**: P1-UAT-15 + P1-UAT-16 — `<script>` declarations not visible in template directive expressions (data-var and method references). Requires synthetic-virtual-file injection architecture (Vue/Svelte precedent). Single architectural fix closes both.

**Deferred to v0.3.0 polish**: `$data.X` / `$props.X` / `$refs.X` member-access autocomplete — extend RozieJsMagicIdentifierCompletionContributor (or add sibling) to read sibling-block AST and contribute keys as LookupElements.

**UI hint**: no

### Phase 08.3: IntelliJ Plugin — `<script>` declarations visible from template + JS-injected blocks (INSERTED)

**Goal**: Identifiers declared in the user `<script>` block (top-level `let`/`const`/`function`/`import`, plus type aliases / interfaces under `<script lang="ts">`) resolve from every JS-injected range in the same `.rozie` SFC — `<template>` directive expressions (`r-if`, `r-for`, `:prop`, `@event`), `{{ }}` interpolations, `<listeners>` keys' modifier-argument expressions, and `<components>`-block expressions. Concretely: a helper `function fmt(x)` declared in `<script>` is Go-to-Declaration-able from `{{ fmt($data.x) }}` in `<template>`; Find-Usages on the `<script>` declaration finds the template call site; Rename works across the boundary; the JS analyzer no longer surfaces "Cannot resolve symbol" warnings on script-defined identifiers used from injected ranges. Closes P1-UAT-15 (data-var refs) + P1-UAT-16 (method refs) — both deferred from Phase 08.2.

**Why extracted as a separate phase**: Phase 08.2's `RozieMultiHostInjector` treats every JS-injected fragment as an isolated micro-document — by design, so each fragment parses against the right host syntax (statement-position vs expression-position vs object-literal). That isolation is correct for parsing but wrong for cross-fragment name resolution: each injected document only sees its own contents plus the ambient-decl prefix from Plan 08.2-16 (`$props` / `$data` / `$refs` / `$slots`). A `<script>`-declared identifier lives in a *different* injected document, so JavaScript's resolver never sees it. Vue / Svelte / Astro plugins all solve this with a synthetic-virtual-file architecture: one virtual JS/TS file per SFC concatenates the `<script>` block plus the injected fragments, with bidirectional offset mapping so PSI positions in the virtual file round-trip back to `.rozie` byte positions. This is a separate architectural axis from Phase 08.2's injection-shape work (the injection layer keeps doing what it does; a new resolution layer sits above it) and warrants its own phase, plans, and UAT cycle.

**Depends on**: Phase 08.2 (the injection-first foundation Plans 08.2-11/14/15/16/17/18 produce — virtual-file construction concatenates the same injected ranges these plans manage).
**Requirements**: None — tooling track, no v1 product requirements depend on it.

**Success Criteria**: 8 locked SPEC requirements (SPEC-08.3-Req-1 through SPEC-08.3-Req-8) in `08.3-SPEC.md`; Req 9 (TS type-only refs) deferred to v0.4.0 per discuss-phase decision B2. 13 acceptance checkboxes covering function-from-interpolation / const-from-directive / fn-from-event-handler / let-from-colon-bind / fn-from-modifier-arg / import-binding / nested-scope-negative / name-collision / Find-Usages / Rename smoke / bail-safe / matrix-green / Plan-05-regression.

**Plans**: 4 plans

- [x] 08.3-01-PLAN.md — Provider + Reference + Registration (Wave 1): new `RozieScriptDeclReference` PsiReferenceBase.Poly + co-located `RozieScriptDeclReferenceProvider` (1 new .kt file) + 1-line registration in `RozieJSReferenceContributor.registerReferenceProviders` — closes SPEC Req 1–6 + Req 8 resolution mechanics (no plugin.xml change, no build.gradle.kts change) — SHIPPED 2026-05-28, commits 792ba3b + ad11321; compileKotlin green; behavioural gate deferred to Plan 02
- [x] 08.3-02-PLAN.md — Test class + 9 fixtures (Wave 2, depends_on 08.3-01): `RozieScriptDeclResolutionTest.kt` with 10 test methods + 9 new `.rozie` fixtures under `src/test/testData/script-decls/`; gradle test green; Plan 08.2-05 regression green — SHIPPED 2026-05-28, commits ae4a9bb + cfecfdd; 118/118 GREEN under full `./gradlew test`; 8 SPEC reqs fully GREEN (Req 1, 2a, 2b, 2c, 4, 5, 6, 8); Req 3 (modifier-arg JS sub-injection in `<listeners>` JSON-keys) + Req 7 (cross-injection Find-Usages) deferred-with-documented-test-shape as architectural follow-ups; in-band Plan 01 production fix (synthetic-ambient `$`-prefix guard in `findScriptDeclByName`) folded into cfecfdd
- [x] 08.3-03-PLAN.md — IDE matrix + Rename UAT (Wave 3, depends_on 08.3-01 + 08.3-02 + 08.3-04, autonomous: false): `./gradlew clean buildPlugin verifyPlugin` on `IU-242.24807.4` + `IU-253.28294.334`; manual Rename + Find-Usages smoke in a real JetBrains IDE
- [x] 08.3-04-PLAN.md — Close Req 3 + Req 7 architectural deferrals (Wave 4, depends_on 08.3-01 + 08.3-02): modifier-arg JS sub-injection in `RozieMultiHostInjector.LISTENERS_BODY` (closes Req 3) + cross-injection Find-Usages infrastructure via Vue's canonical 4-EP pattern (`useScopeEnlarger` + 2× `lang.findUsagesProvider` + `referencesSearch`) + isReferenceTo override on `RozieScriptDeclReference` for leaf-vs-parent matching (closes Req 7). SHIPPED 2026-05-28, commits 817b487 (Task 1 — sub-injection), c961092 (Task 2 — FindUsagesProvider + plugin.xml), 843d8e4 (in-band Rule-2 gap closure: UseScopeEnlarger + ReferenceSearcher + HostFindUsagesProvider + isReferenceTo), fa369cd (Task 3 — flip Req 3 + Req 7 tests to SPEC-checkbox shapes). 10/10 `RozieScriptDeclResolutionTest` GREEN; 118/118 full suite GREEN; Plan 08.2-05/16/17 regressions all GREEN. SPEC.md acceptance checkboxes 5 (Req 3) and 9 (Req 7) closed end-to-end. D-decision 3 deviation documented (isReferenceTo override unavoidable for Req 7).

**Cross-references**:

- Phase 08.2 deferred-work block (this ROADMAP) — P1-UAT-15 + P1-UAT-16 origin
- Phase 08.2 Plan 16 ambient-decl prefix (`08.2-16-SUMMARY.md`) — closest existing prior art for "inject extra context into JS injection"
- Phase 08.2 Plan 17 SCRIPT_BODY coalescing (`08.2-17-SUMMARY.md`) — `<script>` body is now ONE contiguous BODY token, prerequisite for treating the whole `<script>` as a virtual-file source
- Vue plugin reference: `intellij-vuejs/src/.../VueScriptInjector.kt` (synthetic-file pattern)
- Memory `feedback_intellij_injection_first` — architectural lesson this phase inherits

**UI hint**: no

### Phase 9: `<script lang="ts">` — TypeScript in the `<script>` block

**Goal**: A component-library author can write `<script lang="ts">` in a `.rozie` file — with type annotations on `let` declarations, function parameters and `catch` bindings, plus author-declared `interface`/`type` and type-only imports — and those annotations survive verbatim through to idiomatic, type-correct output on all six targets (React/Vue/Svelte/Angular/Solid/Lit). This closes the standing hole in the typed-output value proposition: today `parseScript` runs with `plugins: []` (the `typescript` Babel plugin is deliberately off), so authors cannot type their own `<script>` logic, and `typeNeutralizeScript` papers over the gap by injecting explicit `any` — a stopgap its own header documents as "NOT a substitute" for real `<script lang="ts">`. The work spans: a shared SFC block `lang=` attribute substrate in `splitBlocks` (also the future base for `<style lang="scss/less">`); the `typescript` Babel parser plugin enabled on `lang="ts"`; IR and semantic-pass tolerance of `TS*` AST nodes (`threadParamTypes`, `reactivity/computeDeps`, the semantic validators — the IR's own comment flags this as "Phase 2+ when the IR understands type annotations"); a rewrite of `typeNeutralizeScript` from "neutralize everything" to "fill only the untyped residue, preserve author annotations" (the untyped path stays the default and the fallback — it must stay green under `tsc`/`vue-tsc`/`svelte-check`/`ng build`); and per-target emitter changes so author annotations reconcile with the emitter-synthesized typed shell (`defineProps<T>`, `@Input()` field types, `$props<{}>`, `.tsx` interfaces) plus a `.d.ts`-synthesis interaction check.

**Success looks like**: side-by-side typed example variants live in a new `examples/typed/` directory — Counter, Dropdown, and one engine wrapper (SortableList or Flatpickr) forked from their untyped originals (never converted in place, so untyped-path coverage is preserved), plus one genuinely-new example that declares an `interface`/`type` in `<script>` and uses a type-only import. The key verification artifact is the per-target diff of `Counter` vs typed `Counter`: the only delta is author annotations preserved where injected `any` used to appear, and nothing else moved. The committed fixture surface (dist-parity, slot-matrix, VR baselines, ModalConsumer byte-identity) is untouched because no existing example is mutated.

**UI hint**: no

**Plans**: 5 plans

- [x] 09-01-PLAN.md — Wave 1: generic SFC-block `lang=` substrate in `splitBlocks` + `BlockEntry`/`ScriptAST`/`StyleAST` shapes; conditional `typescript` Babel plugin in `parseScript`; `lang` threaded through `parse()`; Wave 0 test scaffolds for splitter/parser + the OQ-1 dep-graph RED test
- [x] 09-02-PLAN.md — Wave 2: `TS*` node tolerance across `computeDeps`/semantic validators/`collectScriptDecls`/`lowerScript` (closes OQ-1 — type-reference identifiers no longer leak into the React dep graph); `typeNeutralizeScript` inverted to residue-only with lang-gated `ForOfStatement` + corrected doc header; untyped-path no-regression proof
- [x] 09-03-PLAN.md — Wave 3: author-annotation threading through the React/Vue/Svelte/Solid emitters (function/SFC residual-scope targets); OQ-2 fix — React `hoistModuleLet` renders the author's type for `useRef<T>`; rebuild-site audit; `import type`/`interface` placement; 4 `ts-passthrough` snapshot suites
- [x] 09-04-PLAN.md — Wave 3: author-annotation threading through the Angular/Lit class-based emitters; OQ-3 fix — statement-position `interface`/`type` hoisted to module scope; 2 `ts-passthrough` snapshot suites
- [x] 09-05-PLAN.md — Wave 4: `examples/typed/` fixture set (Counter/Dropdown/SortableList forks + new `TypedCard`); all 6 per-target gates wired to typed examples via a `TYPED_EXAMPLES` array; blocking Counter-vs-typed-Counter diff verification checkpoint

### Phase 10: `<style lang>` support — SCSS/Less preprocessing in `<style>` blocks

**Goal:** Let component authors write `<style lang="scss">` / `<style lang="less">` in a `.rozie` file and have the preprocessed CSS flow through Rozie's existing PostCSS scoping pass to all six targets — reusing the generic SFC-block `lang=` attribute substrate shipped in Phase 9 (which already threaded `lang` through `splitBlocks`/`BlockEntry`/`StyleAST` precisely as the base for this work).

**Note:** v1 scope is SCSS-only — `lang="less"` is explicitly deferred to a follow-up (the optional-peer model + `lang=` substrate make it a clean later add). Authoritative requirements are the 8 locked SPEC-REQ in `10-SPEC.md`, not this ROADMAP entry.
**Requirements:** SPEC-REQ-1, SPEC-REQ-2, SPEC-REQ-3, SPEC-REQ-4, SPEC-REQ-5, SPEC-REQ-6, SPEC-REQ-7, SPEC-REQ-8 (locked in `10-SPEC.md`).
**Depends on:** Phase 9 (the SFC-block `lang=` substrate).
**Plans:** 4/4 plans complete

Plans:

**Wave 1**

- [x] 10-01-PLAN.md — `sass` infrastructure: optional peer dependency + pinned devDependencies + synchronous `resolveSass.ts` resolver (Wave 1) — COMPLETE 2026-05-21 (10-01-SUMMARY.md)
- [x] 10-02-PLAN.md — TextMate `#block-style-scss` injection rule + playground `source.css.scss` registration + SCSS highlight fixture (Wave 1) — COMPLETE 2026-05-21 (10-02-SUMMARY.md)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-03-PLAN.md — Compiler core: ROZ085/086/087 codes + `parseStyle` SCSS pre-pass (`sass.compileString` before `postcss.parse`) + Wave-0 SCSS tests (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 10-04-PLAN.md — `substituteCompiledStyle` splice across all 4 entrypoints + SCSS proving fixture + 12th dist-parity example + blessed baselines (Wave 3)

### Phase 11: `r-match` conditional construct — switch-style `r-match`/`r-case`/`r-default` template blocks

**Goal:** Add a switch/match-style conditional to the `.rozie` template language. An author writes `<template r-match="expr">` (or the same on a real element, e.g. `<div r-match="column.key">`) containing `r-case="value"` children and one optional `r-default`; exactly one branch renders, selected by strict (`===`) equality against the discriminant. It lowers to an `if`/`else-if`/`else` ladder across all six targets (React/Vue/Svelte/Angular/Solid/Lit). This fills a real expressiveness gap — Vue and Svelte 5 have no native match, Angular's `@switch` is single-value-per-case with no fall-through — and it directly motivated this phase: the limited dynamic match-slots in the table demo make the per-column cell slot significantly cleaner once `r-match` exists.

**Design (resolved in discussion 2026-05-21 — carry into `/gsd-spec-phase 11`):**

- **Naming.** `r-match` / `r-case` / `r-default`. `r-match` always requires a value — there is no bare/cond form; an empty `r-match` is a compile error.
- **Comma alternatives.** Comma-separated `r-case` values (`r-case="'max', 'min'"`) are alternatives. A top-level `SequenceExpression` from `@babel/parser` is intercepted as the alternatives list — a documented Rozie sub-grammar, consistent with the modifier PEG grammar and `r-for`'s `x in xs`. Lower to a `===`-OR chain (`k === 'max' || k === 'min'`), **never** `.includes()`: `.includes()` does not narrow the discriminant for TypeScript, and the construct must preserve narrowing for the TS 5.6 floor across all four downstream type-checkers (`tsc`/`vue-tsc`/`svelte-check`/Angular template checker).
- **Literal-boolean special case.** When the `r-match` discriminant is the literal `true`, `r-case` expressions lower to a bare truthy predicate (`X`) rather than `true === X` — predicate-chain mode, with the explicitness living in the visible `r-match="true"`. Literal `false` lowers to `!X` for symmetry (defined, not advertised). Only the literal token is special-cased; `r-match="<boolean var>"` stays strict-equality.
- **Evaluate-once (correctness, not perf).** The discriminant must be evaluated exactly once per render — re-evaluating an impure discriminant per `r-case` rung can match zero or inconsistent branches. Delivered via **shape-conditional hoisting**: a bare identifier / member expression (`column.key`) is inlined into each rung (no temp); a `CallExpression` or otherwise non-trivial discriminant is hoisted to a temp that resolves the branch once. Nested `r-match` blocks that each hoist get a per-component counter (`__rozieMatch_0`/`_1`/…). Per-target hoist mechanics: IIFE in JSX (React/Solid), `@let` on Angular, `computed`-or-method on Vue, `{@const}`/snippet on Svelte; declarative targets carry a resolved-branch-token rather than the raw discriminant.
- **No `r-computed-match`.** Cross-render memoization is not the match block's job — the existing `$computed` already covers it (`r-match="someComputed"`). A dedicated memoizing attribute would be a purity footgun for exactly the impure-expensive discriminants it would most attract.
- **Error boundaries.** A direct child of an `r-match` host that is not `r-case`/`r-default` → compile error; a valueless `r-case` → error with a "did you mean `r-default`?" nudge; `r-case` + `r-for` on the same element → forbidden (use `<template r-case><tag r-for/></template>`); `r-case`/`r-default` allowed on `<template>` for multi-root branches.
- **Branch-swap DOM identity.** When the active branch changes and two branches share a tag, inherit each framework's native `v-if`/`else-if` reconciliation behavior and document it (no auto-keying). Future escape hatch if a real case appears: an `r-match.keyed` modifier — a non-breaking add that slots into the existing peggy modifier grammar.

**Success looks like:** `r-match`/`r-case`/`r-default` parse, lower, and emit idiomatically across all six targets, with the table-demo cell slot reworked to use it. Dedicated `examples/*.rozie` fixtures cover the three silent-regression risks individually — comma lowering, the literal-`true` path, and the expensive-discriminant hoist — rather than riding along on one combined example.

**Depends on:** Phase 10 — sequencing/priority only; no technical dependency on the `<style lang>` work.
**Plans:** 8/8 plans complete

Plans:
**Wave 1**

- [x] 11-01-PLAN.md — Core IR: TemplateMatchIR type, ROZ953-959 codes, getMatchDirective + match-grouping/folding/hoist-classification/diagnostics
- [x] 11-02-PLAN.md — Wave 0 scaffolding: examples/match/ probe fixtures, the typed narrowing fixture, IR/diagnostics/compile-matrix tests

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 11-03-PLAN.md — React/Vue/Svelte inline-discriminant TemplateMatch delegate + comma/literal-true snapshot probes
- [x] 11-04-PLAN.md — Angular/Solid/Lit inline-discriminant TemplateMatch delegate + comma/literal-true snapshot probes

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 11-05-PLAN.md — Evaluate-once hoist for React/Solid (IIFE) + Lit (render-prelude const) + hoist probe test
- [x] 11-06-PLAN.md — Evaluate-once hoist for Vue (computed injection) / Angular (@let) / Svelte ($derived) + hoist probe + checkpoint

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 11-07-PLAN.md — Wire the MatchUnion fixture into the 4 typecheck gates (R9) + convert the TableDemo #cell slot (R11)
- [x] 11-08-PLAN.md — VitePress r-match docs section + playground snippet + checkpoint (R12)

### Phase 12: `r-model` modifiers — built-in `.lazy`/`.number`/`.trim` + custom modifier registry

**Goal:** Add modifier support to `r-model`. Today `r-model` accepts no modifiers and the failure is **silent** — `<input r-model.number="$data.x"/>` compiles with zero diagnostics and emits a bare `<input/>` (no binding, no warning), so a Vue developer's `.number`/`.lazy`/`.trim` muscle memory produces a dead input. This phase: (1) makes the parser split a `.modifier` chain off `r-model` **only** — not `r-if`/`r-for`/etc. — respecting the `r-model:arg.modifier` colon-arg ordering, carries a `modifiers` field on the relevant `AttributeBinding` IR kinds (`'binding'` and `'twoWayBinding'`), and turns any unknown `r-model` modifier into a **diagnostic** rather than a silent drop (this subsumes the standalone "guard diagnostic" idea); (2) ships built-in `.lazy` / `.number` / `.trim` with Vue's exact semantics (`.number` ≈ Vue `looseToNumber`, `.lazy` ⇒ bind on `change` not `input`, `.trim`) emitted idiomatically across all six targets — Vue maps ~1:1 to `v-model.lazy.number.trim`, the other five need hand-emitted coercion + event-name handling; (3) adds a custom/extensible `r-model`-modifier registration API consistent with the existing (currently **undocumented**) custom event-modifier registry, threaded through `compile({ modifierRegistry })`. Ships new `ROZ` diagnostic codes, an `examples/` fixture, and documents the custom-modifier extensibility for **both** event and model modifiers.

**Open design question (resolve before planning — `/gsd-spec-phase 12` → `/gsd-discuss-phase 12`):** `ModifierImpl` in `packages/core/src/modifiers/ModifierRegistry.ts` is **event-shaped** — its per-target descriptors describe event-handler-pipeline emission. `r-model` modifiers are a different shape: a value transform (`.number` → `Number(v)`, `.trim` → `v.trim()`) and/or an event-name swap (`.lazy` → `change`). How custom `r-model` modifiers fit the registry is unresolved — candidates: (a) extend `ModifierImpl` with an optional `model` descriptor kind, (b) a parallel `ModelModifierRegistry`, (c) a unified registry with a discriminated descriptor. Planning blind here would lock in the wrong custom-modifier authoring surface — hence a spec/discuss round first.

**Success looks like (refine in spec):** `r-model.lazy.number.trim` parses, lowers, and emits idiomatically across all six targets; an unknown `r-model` modifier raises a diagnostic instead of dropping silently; a consumer can register a custom `r-model` modifier through the same surface as a custom event modifier; the six per-target typecheck/lint gates, dist-parity, and the `target-*` snapshot suites stay green; the custom-modifier extensibility (event + model) is documented in `docs/`.

**Depends on:** Phase 11 — sequencing/priority only; no technical dependency on the `r-match` work. Touches the modifier subsystem (`packages/core/src/modifiers/`) and the parser's `r-` directive branch.
**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 12-01-PLAN.md — Foundation: discriminated ModifierImpl union (EventModifierImpl | ModelModifierImpl) + 3 model builtins (.lazy/.number/.trim) + AttributeBinding modifiers field + ROZ960..ROZ963 codes + barrel exports

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 12-02-PLAN.md — Parser r-model-only modifier-chain split + inline lowering resolution + ROZ960/961/962/963 hard-error diagnostics

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 12-03-PLAN.md — AST emitters (React/Solid/Lit): valueTransform splicing + .lazy event-swap (React uncontrolled defaultValue/onBlur per D-08)
- [x] 12-04-PLAN.md — String emitters (Vue/Svelte/Angular): Vue 1:1 native v-model modifiers + hand-emit value coercion + .lazy event-swap

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 12-05-PLAN.md — .phone custom-modifier dogfood (6-target) + 3 examples/*.rozie fixtures + docs + build-hygiene rebless gate

## Progress

**Execution Order:**
Phases 1-7 execute in numeric order (v1 product ship): 1 → 2 → 3 → 4 → 5 → 6 → 7
Phase 8 is a **parallel tooling track** — picks up any time after Phase 3 completes; does not block v1.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Spike, Parser & AST | 4/4 | Complete | 2026-04-30 |
| 2. Semantic Analysis, Reactivity Model & IR | 5/5 | Complete | 2026-05-02 |
| 3. Vue 3.4+ Target Emitter | 6/6 | Complete | - |
| 4. React 18+ Target Emitter | 6/6 | Complete | - |
| 5. Svelte 5 + Angular 17+ Target Emitters | 7/7 | Complete | - |
| 6. CLI, Babel Plugin & Type Emission Hardening | 6/6 | Complete | 2026-05-07 |
| 06.1. Source map accuracy (INSERTED) | 3/3 | Complete   | 2026-05-07 |
| 06.2. Component composition + recursion (INSERTED) | 3/3 | Complete   | 2026-05-07 |
| 06.3. Solid.js Target Emitter (INSERTED) | 3/3 | Complete | 2026-05-07 |
| 7. Validation, Acceptance & Hardening | 5/5 | Complete   | 2026-05-14 |
| 07.1. Modifier Extension API — 6-Target Completion (INSERTED) | 3/3 | Complete | 2026-05-14 |
| 07.2. Named & scoped slot consumer-side support (INSERTED) | 7/6 | Complete    | 2026-05-16 |
| 07.3. Consumer-side two-way binding (`r-model:propName=`) (INSERTED) | 9/9 | Complete    | 2026-05-17 |
| 07.3.1. Consumer-side composition hardening — close 3 Phase 07.3 blockers (INSERTED) | 7/8 | Complete    | 2026-05-17 |
| 07.3.2. Consumer-side dynamic-name slot bridge across React/Solid/Angular + React re-projection (INSERTED) | 11/11 | Complete | 2026-05-17 |
| 07.3.2.1. Angular consumer-side templates input binding — close F-07.3.2-11-A (INSERTED) | 1/1 | Complete | 2026-05-17 |
| 07.4. Lit loop-scoped slot-param listeners (D-LIT-12 fix) (INSERTED) | 1/1 | Complete | 2026-05-18 |
| 07.5. Lit consumer-side scoped/portal slot bridge (INSERTED) | 1/1 | Complete | 2026-05-19 |
| 8. IntelliJ Platform Plugin v1 (parallel) | 6/6 | Complete | 2026-05-07 |
| Phase 08.1. IntelliJ — backfill: `<components>` + `r-model:` + slot-fill + `$onUpdate` + UAT (INSERTED, parallel) | 5/6 | Superseded — Plans 03/04/05 obsoleted by Phase 08.2's injection-first pivot (JFlex carve-outs retired); not pending work | - |
| Phase 08.2. IntelliJ — injection-first architectural pivot (INSERTED, parallel) | 18/18 | Complete — UAT signed off; tag cut deferred per user; P1-UAT-15+16 → Phase 08.3; member autocomplete → v0.3.0 polish | 2026-05-17 |
| Phase 08.3. IntelliJ — `<script>` decls visible from template + JS-injected blocks (INSERTED) | 3/4 | Plans 01/02/04 complete (closes SPEC Req 1–8 + Find-Usages); Plan 03 (IDE-matrix UAT) pending | 2026-05-28 |
| 9. `<script lang="ts">` — TypeScript in the `<script>` block | 5/5 | Complete   | 2026-05-21 |
| 10. `<style lang>` support — SCSS/Less preprocessing | 4/4 | Complete    | 2026-05-22 |
| 11. `r-match` conditional construct | 8/8 | Complete    | 2026-05-21 |
| 12. `r-model` modifiers | 5/5 | Complete    | 2026-05-22 |
| 13. `$classSelector` helper — cross-target class-name-to-selector bridge | 7/7 | Complete    | 2026-05-22 |

> **Note (2026-05-20 reconciliation):** Work labelled "Phase 07.6" (Lit dynamic-slot-name dispatch) and "Phase 07.7" (FullCalendar cross-target gaps) in commit messages / memory was completed ~2026-05-19 but never had formal ROADMAP entries or `.planning/phases/` directories — tracked ad-hoc, not reflected as table rows above.

## Open Questions Tracker

Surfaced by research, tracked through phases:

| OQ | Question | Resolution Plan | Phase |
|----|----------|-----------------|-------|
| OQ1 | Host-framework auto-detection (`target: 'auto'`) | Explicit `{ target: 'vue' }` config in v1; defer auto-detect to v1.1 | Decided — out of v1 scope |
| OQ2 | `dts-buddy` 0.x stability for `@rozie/core` toolchain types | Use in Phase 6; fall back to `tsc --declaration` (leaf packages) + `api-extractor` (`@rozie/core`) if 0.x proves unstable | Phase 6 |
| OQ3 | Angular Vite integration via `@analogjs/vite-plugin-angular` virtual filesystem | 1-2 day spike at start of Phase 5, before Angular emitter code is written | Phase 5 |
| OQ4 | `$expose()` imperative methods (`useImperativeHandle`/`defineExpose` analog) | **Phase 3 verdict (2026-05-02): Modal.rozie compiles + works without imperative API.** Modal opens/closes via prop binding (`v-model:open`) alone — verified by `examples/consumers/vue-vite/tests/e2e/modal.spec.ts`. Disposition: defer to v2 per D-47. Phase 4 (React) re-monitors; if React's StrictMode or controlled-form patterns force imperative methods, OQ4 reopens. | RESOLVED Phase 3 / Phase 4 re-monitor |
| OQ5 | Babel plugin timing (research said P2 "defer until first user request"; PROJECT.md lists it as Active) | Bake into Phase 6 — ~50 LOC, low cost, ships alongside CLI for distribution-path completeness | Phase 6 |

## Backlog

Unsequenced ideas parked outside the active phase order. Promote with `/gsd-review-backlog`.

<!-- BL-VUE-ROZIEATTR (Vue rozieAttr nullish-attr capability to clear listbox's 3 residual aria-label TS2322)
     DROPPED 2026-07-01 per Dan: it's a `vue-tsc` type-vs-runtime artifact on RAW `.vue` bodies (consumers
     already clean, Vue's runtime drops nullish attrs natively) — cosmetic noise, not worth a runtime
     capability. The listbox-at-3 baseline is honest and stays. ONLY revisit if unifying all six attr
     emitters ever makes rozieAttr-on-Vue fall out as a SIMPLIFICATION (to delete the Vue special-case),
     never to appease the warning. See feedback `feedback_no_cosmetic_tsc_on_emitted_bodies`. -->

### Phase 999.1: Post-v1.0 launch-day component port seed list (BACKLOG)

**Goal:** Curate and ship 3–4 `@rozie/<component>` ports of killer vanilla-JS-engine libraries as part of (or just after) the v1.0 launch. Each port lands as a quality drop-in across all six target ecosystems at once — concrete proof of the Rosetta-stone framing, and a tangible day-one story for Svelte/Solid devs who currently lack equivalents to popular React/Vue libraries.

**Requirements:** TBD — pick the launch slate during `/gsd-new-milestone` for v1.1.

**Plans:** 2 plans

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

**Selection rule (the leverage criterion):**

- ✅ Engine is framework-agnostic vanilla JS; per-framework wrappers are plumbing → port the wrapper to Rozie, get 6 idiomatic implementations
- ❌ Logic IS framework-native (e.g., react-day-picker, vue-cal) → porting means reimplementing, not bridging; skip

**Candidate ports (by category):**

| Category | Candidates |
|---|---|
| Date/time | flatpickr, Pikaday |
| Maps | Mapbox GL JS, MapLibre GL, Leaflet |
| Rich text | TipTap, Lexical, ProseMirror |
| Charting | Chart.js, ApexCharts, ECharts |
| Code editing | CodeMirror 6, Monaco |
| Drag-and-drop | SortableJS |
| File upload | Uppy (core engine) |
| Calendar / scheduler | FullCalendar (vanilla core) |

**Why launch-day:** Three or four shipped ports make the cross-framework value proposition tangible on day one rather than aspirational. "We ported flatpickr to Rozie; Svelte and Solid devs now get a quality date picker they didn't have" is a concrete story; "Rozie compiles one source to six targets" is an abstract one. Each port also doubles as a non-trivial dogfood stress test on the v1.0 compiler.

**Cross-refs:** memory `project_post_v1_killer_component_ports.md`, memory `project_rozie_overview.md`.

### Phase 999.2: Playground iframe runtime — multi-file dependency resolution (RESOLVED → folded into Phase 68)

**RETIRED 2026-07-01:** core deliverable (multi-file `<components>` resolution) shipped `7b390d4` (2026-05-20); the residual per-target harness tail (FullCalendar/Svelte PortalHost, FullCalendar/Solid jsx-dom-expressions cleanup) is now workstream 3 of **Phase 68 (Playground modernization)**. This entry is historical — do NOT re-promote; Phase 68 owns the remaining playground work.

**Status (2026-05-20): core deliverable RESOLVED** — commit `7b390d4`. Multi-file bundle snippets now resolve + render. The original "rough surface" below is largely stale: `importBundleWith` (the blob-URL sibling bundle dance) had already shipped after this entry was written. The three real gaps found and closed: (1) `rewriteRelativeImports` only matched `./`, never `../` — broke `examples/demos/*Demo.rozie` importing `../Engine.rozie`; (2) the flat `/vfs/<basename>` keying meant `../` `<components>` imports computed a path outside `/vfs` → ROZ945 — fixed with a basename fallback in the enhanced-resolve shim; (3) per-harness importmaps only declared `sortablejs` — added the other engine libs + `postcss` + `lit/directives/ref.js`. Also made the Lit harness's `customElements.define` idempotent for re-rendered bundle siblings. **Verified:** SortableListDemo / FlatpickrDemo / LeafletMapDemo / LineChartDemo render on all 6 targets; FullCalendarDemo compiles on all 6, renders on React/Vue. **Still open (NOT module-resolution — separate bugs):** ~~TipTapDemo + UppyDemo fail the harness esbuild transform (`Invalid binding pattern` / `Expected ";" but found "-"`)~~ → CLOSED 2026-05-21 (gsd-debug investigation). The `data-rozie-s-<hash>` scope-attribute hypothesis was WRONG — every `data-rozie-s-` token is correctly emitted inside `html\`...\`` / `css\`...\`` literals. The real causes were two compiler emit bugs — the Lit/Angular destructuring-param shadow rewrite (`({ editor: this.editor }) =>`) and Angular kebab-case `output()` field identifiers — both already fixed on `main` by quick task `260520-gi1` (commits `85427b8` + `265b01e`). Verified: 16/16 playground esbuild transforms pass for TipTap/TipTapDemo/Uppy/UppyDemo across react/solid/lit/angular. FullCalendarDemo on Svelte needs `@rozie/runtime-svelte/PortalHost.svelte` served + svelte-compiled by the harness (portal-slot runtime); FullCalendarDemo on Solid throws `e.cleanups[t] is not a function` (likely the babel-plugin-jsx-dom-expressions harness limit).

**Original goal:** Teach each per-target preview iframe how to resolve cross-module imports so multi-file snippet bundles (e.g. `bundle/SortableListDemo` which imports `SortableList.rozie` via a `<components>` block) actually RENDER in the grid view, instead of failing with `Failed to resolve module specifier './SortableList'` at runtime.

**Context:** Commit `e1f7295` (2026-05-17) shipped the compile-side path for multi-file bundles — VFS shims for `node:fs` + `enhanced-resolve`, snippet-bundle picker, grid mode that lays out all 6 framework iframes simultaneously. The compile path is GREEN end-to-end: SortableListDemo produces zero ROZ945 errors across all 6 targets and the emitted consumer code is idiomatic per framework (`v-model:items` on Vue, `bind:items` on Svelte, `[items]/(itemsChange)` on Angular, `onItemsChange` on React/Solid, etc.).

The gap is purely RUNTIME: each iframe (`public/preview/<target>.html`) currently eval-s the entry module's compiled output via a single blob URL through `importFromString`. When the emitted code does `import SortableList from './SortableList'`, the blob URL has no module space to resolve relative imports from. Smoke test surfaces 6× `[harness] render failed TypeError: Failed to resolve module specifier ...` per render.

**Requirements:** TBD — promote with `/gsd-discuss-phase 999.2` when ready. Rough surface:

1. **Payload protocol extension** (`parent → iframe`): replace `{ type: 'render', code, css }` with `{ type: 'render', entry: { code, css }, modules: { [name]: { code, css } } }`. Backward-compat: when `modules` is absent, fall back to current single-module path so existing single-file snippets keep working.
2. **Per-target dependency compile** (orchestrator side, `compile.ts`): when grid-rendering a bundle, compile each dependency .rozie file for the same target FIRST, then pass all module outputs in the render payload. The current `compileBundleAll` returns only the entry's compiled output — extend to a `compileBundleAllWithDeps` that returns `{ [target]: { entry, modules: { [name]: outcome } } }`.
3. **In-iframe dependency mounting** (`public/preview/_shared.js` + per-target HTML harnesses): for each dependency, mint a blob URL and register it under the dependency's import-name (`./SortableList`, `./SortableList.vue`, `./SortableList.svelte`, etc.) in a per-render `<script type="importmap">` injected into the iframe BEFORE the entry's blob URL is imported. Browsers don't support dynamic importmap updates without reloading the iframe — so this likely needs a controlled iframe-document-rewrite per render, OR moving from blob-URL imports to a `data:` URL with the dependency code inlined (uglier but avoids the importmap timing issue).
4. **Per-target import-name normalization**: each target emits the dependency import under a different specifier shape (React: `from './SortableList'`, Vue: `from './SortableList.vue'`, Svelte: `from './SortableList.svelte'`, Lit: side-effect `import './SortableList.rozie'` for the custom-element registration). The dependency module emitted for each target needs to register under the matching specifier so each target's import resolves.

**Plans:** 2 plans

Plans:

- [ ] TBD (promote with `/gsd-discuss-phase 999.2` when ready)

**Estimated scope:** ~200–300 LOC across `public/preview/_shared.js`, the 6 per-target HTML harnesses, `compile.ts`, and `preview/manager.ts`. Probably a single 1–2 day phase with no compiler changes needed (it's all playground-side wiring).

**Why backlog (not active):** The compile-side proof that "demo wrapper in Rozie compiles to six idiomatic consumers" already lands cleanly today — viewable in the Output tab. The iframe runtime is a quality-of-life upgrade for visual side-by-side demos, not a blocker for v1.0 or the launch-day component port slate. Defer until either (a) a marketing/demo push needs live cross-target rendering of multi-file bundles, or (b) a killer-component port (Phase 999.1 candidate) has multiple .rozie files and we want to dogfood it in-playground.

### Phase 999.3: Test-coverage hardening — close remaining minor unit-coverage gaps (BACKLOG)

**Goal:** One dedicated pass to close the leftover *minor* unit-coverage gaps after the 2026-05-22 coverage sweep. That sweep took `@rozie/runtime-*` to 100%, `emitPortals.ts` to 100% across all 6 targets, and the whole `rewrite/` family (`rewriteTemplateExpression` / `rewriteScript` / `rewriteListenerExpression`) to ~100% across all 6 targets. What remains is small and itemized below — none of it is urgent, hence backlog.

**Requirements:** TBD — promote with `/gsd-discuss-phase 999.3` when ready.

**Plans:** 2 plans

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

**Triage (from fresh per-package `coverage-summary.json`, 2026-05-22):**

_Clear unit gaps — pure, unit-testable, not meaningfully integration-covered (best ROI):_

| Target | File | Line / Branch |
|---|---|---|
| react | `src/emit/resolveTwoWayTarget.ts` | 40.7% / 35.7% — lowest target gap, pure resolver |
| lit | `src/emit/resolveLitSetterText.ts` | 36.1% / 40% — lowest of all, pure text helper |
| solid | `src/emit/emitSlotFiller.ts` | 0% — whole file unit-untested (foreign-slot-filler path) |
| vue / svelte / lit | `collect{Vue,Svelte,Lit}Imports.ts` | 64.7% / 61.5% / 71.4% — import collectors |
| react | `computeHelperDeps.ts` 63%, `emitSlotInvocation.ts` 63%, `rewrite/rewriteScript.ts` 68.8% | (rewriteScript had a test, stayed gappy — not in the rewrite-coverage follow-up scope) |
| react / solid | `emitPropsInterface.ts` | 78% / 61% |
| react / solid | `emitRModel.ts` | 71% / 72% |
| lit | `rewrite/scopeAwareSkip.ts` | 68% |
| angular | `emitStyle.ts` 54.8%, `emitDecorator.ts` 70.7% | |

_Lower priority — integration-covered, low UNIT number only:_ the `emitTemplateNode` / `emitTemplateAttribute` / `emitTemplateEvent` cluster across all 6 targets (67–79%), plus `shell.ts`, `emitScript.ts`, `emitConditional.ts`, `emitListener*OutsideClick`. Every dist-parity + VR fixture drives these through built `dist/`, so true exercised coverage is far higher than the per-package unit %. Worth focused unit tests for **branch** coverage, lower ROI.

_Explicitly OUT OF SCOPE — genuinely integration-only, do NOT chase to 0%:_ `cli/src/bin.ts` + `cli/src/index.ts` (process entry points); `unplugin/src/{esbuild,rollup,rolldown,lit-detect}.ts` (build-tool adapters, exercised by consumer-demo builds).

**Tooling prerequisite:** `core` / `cli` / `unplugin` / `babel-plugin` still lack a direct `@vitest/coverage-v8` devDep + `test:coverage` script (only the 4 `runtime-*` and 6 `target-*` packages were wired — by quick tasks `260521-qsh` and `260521-spv`). A hardening pass must wire those 4 first. `core`'s own lowest files (from the original full-repo report): `modifiers/builtins/debounce.ts` + `throttle.ts` ~73%, `splitter/splitBlocks.fallback.ts` 74%, `codegen/typeNeutralizeScript.ts` 74%; `babel-plugin/src/writeSibling.ts` 88%.

**Headline:** repo-wide **branch** coverage (~66%) is the weakest metric — target branch, not just line. Conventions carried from the sweep: 100% is a goal "within reason," NOT a build-failing gate; genuinely-unreachable defensive branches get a justified `/* v8 ignore */`; do NOT add `coverage.thresholds`. Full triage detail also lives in `coverage/REPORT.md` (gitignored working artifact).

**Why backlog (not active):** The coverage sweep already closed the high-value gaps (runtime, portals, the rewrite family). What's left is incremental polish — useful before a v1.0 quality bar, but not a blocker for the launch-day component port slate. A natural companion to whenever v1.0 hardening is scheduled.

**Cross-refs:** commit `e1f7295` (snippet bundles + grid mode), commit `0daf542` (SortableListDemo.rozie), commit `60a22d3` (SortableList.rozie), memory `project_playground.md`.

### Phase 999.4: Cross-family composition via authoring-time source vendoring (Option B) (BACKLOG)

**Goal:** Let one `@rozie-ui` family build on another's primitive — a command palette that *is* "a dialog shell around a real listbox," a date-range picker that *is* two date-pickers, a multiselect that *is* combobox + tags — without re-implementing the primitive's markup, ARIA, and behavior inline. Today this is structurally blocked: `<components>` carries one import path emitted to all six targets (extension-swap only), while a *published* leaf has a different package name per target (`@rozie-ui/listbox-react` vs `-vue` …), and there's no story for threading slots through a compiled (non-`.rozie`) child. Command-palette hit this wall and shipped self-contained — it reimplemented roving-nav + option ARIA inline, which is exactly the cross-framework duplication Rozie exists to kill, just moved up a layer. This phase resolves the gap with **Option B: authoring-time source vendoring** — a designated tier of building-block primitives lives once as canonical `.rozie` source, and composing families get the primitive **copied into their `src/` at codegen** (the same move `copyInternal` already makes for colocated TS helpers), then compose against it via a **local `<components>` path** — which is the already-supported case.

**The decision (B over A and C):** Recorded in RFC discussion 2026-06-25. Three forks were on the table:

- **A — Published-package composition** (a `<components>` entry resolves to `@rozie-ui/<slug>-<target>` per target; leaves declare sibling deps). Rejected for now: biggest compiler change, fights the LOCKED per-framework-package distribution model with a leaf-to-leaf version/peer graph, and needs the compiled child's slot/prop contract known at compile time (→ a generated manifest). A is the eventual *graduation* of B — revisit only if consumer install-size telemetry complains about duplicated primitive bytes across packages.
- **B — Authoring-time source vendoring (CHOSEN).** Reuses machinery that already works: local `<components>` (one path → 6 targets via ext-swap, because the child is a local `.rozie` sibling), `copyInternal` source-vendoring, and the already-supported local-child slot-threading path. No `<components>` resolution change, no cross-package runtime graph, no new manifest. The "single source is only at authoring time" objection dissolves under the compiler framing: fix `listbox.rozie` once, re-run codegen, every composing family re-vendors the fix — the *human* duplication is killed; the duplicated bytes in published packages are mechanical, build-time-resolved duplication (what compilers do). Dan's read (2026-06-25): cleanest given a monorepo with extensive test coverage — codegen interdependency "doesn't feel like cheating."
- **C — Shared headless vanilla-JS controllers** (extract behavior into framework-agnostic engines all targets call, treating primitives like the engine-wrapper families). Deferred as a niche optimization *on top of* B, not an alternative: C dedupes behavior but NOT markup/ARIA/slot structure (command-palette reimplemented both), and it forces the philosophical shift "pure-Rozie no-engine primitives become engines." Reach for C only when a behavior core grows large enough that vendoring its full template is wasteful.

**Trigger (when to promote from backlog):** The **second composite** that wants the same primitive. One consumer (command-palette, already shipped self-contained) does not justify the vendoring plumbing; two do. Likely triggers: date-range picker (two date-pickers), multiselect (combobox + tags). Promote then, and retrofit command-palette onto the listbox primitive in the same phase.

**Scope (mechanism):**

1. **Designate a primitive tier** — `listbox`, `overlay/dialog`, `combobox`, `popover`, likely `tags`. NOT all families (nobody composes a data-table into another family; reuse demand lives only in primitives). The tier gets a stricter slot/prop contract-stability bar precisely because it's vendored.
2. **Canonical primitive source** — one `.rozie` per primitive as the single authoring-time source of truth (shared location, e.g. `packages/@rozie-ui-primitives/<slug>.rozie` or a designated source dir; resolve exact home at discuss-time).
3. **Vendoring at codegen** — extend the `copyInternal`-style path so a composing family's `scripts/codegen.mjs` copies the primitive `.rozie` into its `src/` before emit, then compiles the composite against a local `<components>` path. Dedupe/idempotency + a "re-vendor on primitive change" story so fixes propagate on next codegen.
4. **Compose via local `<components>`** — no resolver change; the child is a local sibling so the compiler already has its IR in the same pass (the cross-boundary contract is free — no manifest, unlike A).
5. **Retrofit command-palette** — replace its inline roving-nav + option ARIA with the vendored listbox primitive; prove the class/classList-style one-place-fix property end-to-end.

**Open design points to resolve at `/gsd-discuss-phase 999.4`:**

- Canonical primitive home + how a primitive is marked "vendorable" (frontmatter flag? a manifest of the tier?).
- Vendoring idempotency: overwrite-on-codegen vs hash-guard; what happens when a consuming leaf has local edits to a vendored copy (should be none — generated src is regen-only, but enforce it).
- Whether the vendored primitive's own `<style>` scope composes cleanly inside the composite (scope-attribute collisions across two vendored `.rozie` in one output).
- Slot-threading depth: does a composite need to forward a *named slot* of the primitive to its own consumer, and does the local-child path already handle slot pass-through (vs only default-slot)?
- Honest cost to document: a consumer installing both `command-palette-react` and `listbox-react` gets two copies of the list code (tree-shaking won't dedup across packages). Tiny for headless primitives; the trigger to graduate to A is install-size telemetry.

**Identity note:** Under B the primitives stay **headless leaf components tagged vendorable/primitive** — shared *source*, not consumer-composed npm lego. The "primitives are runtime controllers" identity shift is C's, and is explicitly NOT taken here.

**Requirements:** TBD — promote with `/gsd-discuss-phase 999.4` when the second composite lands.

**Plans:** 4/4 plans complete

Plans:

- [x] 999.4-01-PLAN.md — Vendor-copy step + D-07 specifier remap + sibling compile (mechanism) + A1/A2/A5 de-risk spike
- [x] 999.4-02-PLAN.md — CommandPalette.rozie <Listbox> composition + D-05 slot re-projection + changeset + surface test + D-07 byte-identity
- [x] 999.4-03-PLAN.md — D-04 vendor-drift content-hash guard (RED-FIRST)
- [x] 999.4-04-PLAN.md — Rebless (typecheck/dist-parity/snapshots/VR Linux/docs) + end-to-end "fix once → re-vendor" proof

**Why backlog (not active):** Nothing is blocked today — command-palette shipped self-contained, so this is debt sitting in one place, not a v1.0 gate. Foundational for the layered design-system story (composites built from primitives), but speculative to build for a single consumer. Build it when the work-list is real (≥2 composites).

**Cross-refs:** memory `project_cross_family_components_composition_gap`, memory `project_three_headless_families_2026_06` (command-palette self-contained reimpl), memory `project_rozie_ui_distribution_model` (LOCKED per-framework packages), memory `feedback_minimize_duplicated_example_copies`, RFC discussion 2026-06-25.

### Phase 999.5: @rozie-ui component gap audit — prioritized missing-features backlog (BACKLOG)

**Goal:** Not an implementation phase — a captured reference. On 2026-07-12, 4 parallel agents read all 28 `docs/components/*-comparison.md` pages in full and extracted every ❌/⚠️ feature-matrix cell and every "what Rozie defers" bullet against the incumbent library for that component family. This entry is the synthesized, ranked output so the raw findings aren't lost. Promote individual items to real phases via `/gsd-discuss-phase 999.5` (or split into their own backlog numbers) when one becomes a priority; this entry itself is not meant to be executed as-is.

**Ranked findings (systemic/compiler-level gaps first — highest leverage since they unblock multiple leaves at once):**

1. **Generic foreign-web-component consumption.** `docs/components/captcha-comparison.md`: ALTCHA is the sole remaining deferred captcha provider because "cleanly consuming a foreign web component across all six targets needs a compiler capability Rozie does not yet have." This is **distinct** from Phase 999.4's Option A (published-*Rozie*-package composition, deliberately deferred, see above) — ALTCHA is a *third-party, non-Rozie* web component, so 999.4 doesn't cover it. No existing backlog entry tracks this specifically; candidate for its own discuss-phase if a second foreign-web-component case shows up (mirrors 999.4's own "second consumer" promotion trigger).
2. **Cross-package published-leaf composition (Option A).** `docs/components/command-palette-comparison.md`: composing the *published* `@rozie-ui/listbox` leaf "isn't expressible in the compiler today." Already tracked — this is exactly Phase 999.4's rejected-for-now Option A, revisit trigger is consumer install-size telemetry complaints. No new action here; just confirms the audit and 999.4 agree. **CLOSED 2026-08-31 — Option A shipped as Phase 75** (`<components>` resolution to published `@rozie-ui` packages ×6). Proven twice: data-table→popover, command-palette→combobox. Phase 86 will be the first *two-level* chain.
3. **Virtualization completeness (shared windowing engine gap).** Recurring across 4 leaves: Data Table lacks horizontal/column virtualization + dynamic auto-measure beyond `measureElement` (`data-table-comparison.md`); Listbox and Combobox both lack "deep" virtualization — variable row heights, sticky/grouped sections (`listbox-comparison.md`, `combobox-comparison.md`); Sortable List has no virtualization story at all (`sortable-comparison.md`, gap G3). Vertical row windowing already ships for Data Table via `@tanstack/virtual-core`; extending that engine work is the natural next investment given `project_data_table_traction_bet`.
4. **Combobox v1 gap cluster.** `docs/components/combobox-comparison.md`: no multi-select/tags, no floating-positioned popup (auto-flip/shift), no free-text/creatable mode — all explicitly framed as "today"/"yet"/v1 limitations, not permanent decisions. Combobox is the least-complete leaf in the whole audit. Natural building block already exists (`@rozie-ui/tags`'s `string[]` model) for multi-select once composition (#1/#2) is available. **PROMOTED 2026-08-31 → Phase 86.** Two corrections made at promotion time: (a) the "no option groups" item listed here is **stale** — groups shipped (`groups` prop + `role="group"` headings + `groupHeading` slot + `groupCap` "+N more"), as did opt-in `:virtual` windowing; (b) the floating-popup gap is **composition, not construction** — `@rozie-ui/popover` already wraps `@floating-ui/dom`, and Option A (#2 above) shipped in Phase 75, so it is available now. Three gaps remain, all carried into Phase 86.
5. **Toast v1 deferred UX.** `docs/components/toast-comparison.md`: `toast.promise`-style loading toasts, swipe-to-dismiss, animated stack/expand, precise hover-pause — all explicitly scoped out of "v1." Toasts are used in nearly every consuming app; modest, self-contained scope. **CLOSED 2026-07-15 — all four shipped** by the standalone `toast-ux-cluster` phase (`promise()`/`patch()` verbs, swipe-to-dismiss, `stacked` mode, remaining-time-aware hover pause).
6. **Rete/FlowCanvas chrome.** `docs/components/rete-comparison.md`: background variants, `NodeToolbar`, `NodeResizer` are explicitly "on the roadmap (config-prop first, the MapLibre stance)" — the only gap in the entire 28-page sweep with a committed roadmap statement already in the docs. **CLOSED — shipped as Phase 74** (Background variant + NodeResizer); `NodeToolbar` and edge types had already landed in Phase 44.
7. **Sortable List multi-drag + spring/FLIP animation.** `sortable-comparison.md` gaps G4/G5, marked "⏳ Deferred" (not "by design," unlike G2).

**Narrower / lower-priority (single-leaf, larger lift or edge-case):**

- PDF annotation layer / AcroForm forms (`pdf-comparison.md`) — "deliberately deferred rather than half-shipped," sizable scope.
- Dialog stacked/nested-modal scroll-lock edge cases (scrollbar-gutter compensation, multi-dialog coordination) (`dialog-comparison.md`) — explicit "does not yet compensate."
- CodeMirror non-slot injection surfaces (block/line decorations, atomic ranges) (`codemirror-comparison.md`) — reachable today via `:extensions` escape hatch, just not first-class.
- Wavesurfer plugin ecosystem (spectrogram/minimap/envelope/record) + live plugin toggling (`wavesurfer-comparison.md`) — explicit "planned follow-up," clearest roadmap wording of any single-leaf item; see the live-reconfig seed below.

**Explicitly NOT gaps (permanent scope decisions, confirmed during extraction — do not re-litigate without new evidence):** Popover's non-modal-only stance, Dialog's no-service-injection/no-composable-parts model, Slider's no-drag-physics-beyond-native-input, DatePicker's no-3+-discrete-dates / no-popover-combo / no-non-Gregorian-calendars, Tags' no-autocomplete/no-inline-edit/no-rich-token-objects, Command Palette's no-fuzzy-ranking/no-sticky-headings, Resizable's no-N-panel-layouts, CodeMirror's no-change/focus/blur-emit (would race the two-way model path), TipTap's no-JSON-two-way-channel (same reasoning), Embla's no-per-option-incremental-update (inherited from the Embla engine itself), Cropper's Cropper.js-v1-only stance.

**Cross-cutting architectural observation, RESEARCHED 2026-07-12 (`SEED-001`):** CodeMirror (`basicSetup`), Embla (`reInit`-only), Wavesurfer (plugin toggling), and Sortable List (`forceFallback`/`swapThreshold`/`cloneable`) looked like the same wall — construction-time config that can't be live-reconciled without a remount. A 4-agent research spike reading the actual `.rozie` source + engine APIs found this premise **falsified**: no shared mechanism exists. Verdicts — CodeMirror: trivial leaf-local fix (add the 8th `Compartment`+`$watch` pair to a file that already has 7). Wavesurfer: trivial leaf-local fix, and the comparison doc's "recreates the engine" claim was simply wrong — `registerPlugin`/`unregisterPlugin` are live-instance-safe. Embla: not a gap, drop it — already using the best API Embla offers. Sortable List: `forceFallback` correctly permanent (SortableJS-internal), but `swapThreshold`/`cloneable` were mislabeled "by design" — both are live-patchable and just aren't wired. No compiler primitive to build; see `SEED-001-emitter-live-reconfig-primitive.md` for the full per-leaf writeup and 3 concrete fix sites. **RESOLVED 2026-07-13** — all 3 fixes shipped same-day via quick task `260712-re0` (cold gate green: build/test/dist-parity/comparison-surface); SEED-001 closed.

**Requirements:** N/A — this is a captured-findings entry, not an implementation phase.
**Depends on:** N/A (reference only). Individual promoted items may depend on Phase 999.4 (composition) or `project_data_table_traction_bet` priorities.
**Plans:** 0/0 — nothing to execute; promote via `/gsd-discuss-phase 999.5` or split into new backlog numbers per item.

**Why backlog (not active):** This is a prioritized list, not a scoped phase — several items (composition, virtualization) need their own discuss-phase to size before they're executable.

**Cross-refs:** the 28 `docs/components/*-comparison.md` pages (source of truth for every claim above), memory `project_cross_family_components_composition_gap`, memory `project_data_table_traction_bet`, ROADMAP Phase 999.4 (composition Option A/B), `SEED-001` (live-reconfig primitive research).

### Phase 999.6: `provablyPrimitive` — see through `$computed`/method returns and loop-variable element types (CLOSED — WONTFIX 2026-08-20)

> **CLOSED WONTFIX 2026-08-20 (quick task `260820-hzc`).** The `$computed` third was built, shipped, measured, and reverted (`e0ba702fb`). It does not pay off on this entry's own stated motivation.
>
> **Measured:** emitted corpus 1,837,958 → 1,837,734 bytes = **−224 bytes (0.012%)**. Shipped `@rozie-ui` package source: **0 files changed, 0 bytes** — every candidate computed lives in `examples/demos` or test fixtures, not `packages/ui/*/src/*.rozie`. Correctness benefit: **none** — all 15 flips were text interpolations, zero attribute bindings, so no tsc or boolean-semantics win.
>
> **Ceiling (the decisive number).** The byte model is exact (15 wraps × 14 chars + 1 dropped import = 224 measured), so the full entry projects reliably. Of the 1,196 wraps standing: 371 member chains (loop-variable element types), 325 bare identifiers (loop aliases / slot params / script locals — correctly wrapping, NOT computeds), 142 accessor/call (mostly `<script>` helper calls), 358 other. **Even at 100% completion of all three parts, ~600 × 14 ≈ 8.4 KB ≈ 0.46% of generated output.** The entry cannot pay off at full completion, so the two remaining parts are not worth doing either.
>
> **Cost side.** ~200 lines of analyzer complexity, and the change introduced a crash-class **false-RAW** bug: the bare-identifier branch resolved against the component-global computed map with no scope awareness, so an `r-for` alias sharing a name with a `$computed` inherited its type and emitted RAW → the React "Objects are not valid as a React child" crash. Caught only because `tests/regressions/fixtures/spike012-new4-solid-loopvar-shadows-computed` happens to exist AND happens to iterate `[1, 2, 3]`; with object items it would have shipped.
>
> **Reusable finding (survives this closure):** any IR pass resolving a bare identifier against `ir.computed` / `ir.props` / `ir.state` must honor template scope — `TemplateLoopIR.itemAlias`/`indexAlias` and `SlotFillerDecl.params` (local binding is `bindAs ?? name`) shadow same-named declarations. Prior art: the Solid emitter's `loopValueBindings`.
>
> **Reopen only if** a motivation appears that is NOT emit size — e.g. a real attribute-binding case where a wrapped boolean breaks `tsc` or flips truthiness (`:disabled="someComputed"` bare, un-negated). Size alone will never justify it.

**Goal:** Teach `provablyPrimitive` (`packages/core/src/ir/annotateDisplayWrap.ts`) two inferences so `rozieDisplay` stops wrapping expressions that are provably primitive, shrinking generated output on every target without any author-facing change:

1. **`$computed` / method return types** — today the `CallExpression` branch returns `true` for `String(...)`/`Number(...)` and `false` for everything else, so *every* helper call wraps. `computedNames` is already threaded into the function but unused for return-type inference.
2. **Loop-variable element types** — a `r-for` binding has no `PropDecl`/`StateDecl`, so member reads off it (`opt.label`, `entry.title`, `t.message`, `segment.text`, `blk.group.label`) are unprovable and always wrap.

**Evidence (survey of every wrap that actually fires across the emitted Angular corpus, 2026-08-19):** wraps fall into three classes. Class A is pure analyzer conservatism — the two blind spots above, plus our own helper calls (`headerLabel()`, `sortIndicator()`, `monthHeading()`, `yearRangeLabel()`, `selectedLabel()`, `rowIsExpanded()`). Class B is genuinely unknown and **must keep wrapping**: `cell.getValue()` (TanStack — `unknown` by design), `FilterSelect`'s <span v-pre>`{{ opt }}`</span> (distinct keys from an arbitrary consumer data column), `Carousel`'s <span v-pre>`{{ slide }}`/`{{ item }}`</span> (consumer-supplied slot fallback). Class C is borderline (`Pagination`'s <span v-pre>`{{ item }}`</span>, already string-concatenated elsewhere). **Note the inversion:** the leaves that wrap most (data-table, embla) are generic containers whose job is rendering consumer values of unknown type — exactly where the wrap earns its keep. This phase must not weaken Class B.

**Motivation is emit size, NOT runtime perf.** `rozieDisplay` is a null check plus two `typeof` checks; against framework diffing that is noise. Do not scope or justify this as a performance win. The real payoff is less generated code and byte-identical raw emit for provable cases. (Quick tasks 260819-qo8/sg9 already removed the *duplication* cost — the helper is one shared import from `@rozie/runtime-angular`, not a per-component inlined blob; Vue is never wrapped at all, since its native `toDisplayString` already matches.)

**Rejected alternative — a triple-mustache <span v-pre>`{{{ }}}`</span> per-interpolation opt-out.** Three reasons: (a) <span v-pre>`{{{ }}}`</span> means *unescaped HTML* in Handlebars/Mustache and Rozie already ships `r-html`/`r-text`, so it would misread as raw-HTML injection — a security-relevant meaning for a feature unrelated to escaping; (b) Vue itself has no per-interpolation opt-out (`toDisplayString` is unconditional), and Rozie's existing global + per-component `safeInterpolation` flag already exceeds Vue's surface, so more syntax moves *away* from the project's "what would feel natural to a Vue developer" constraint; (c) it pushes a correctness judgment ("is this ALWAYS primitive?") to every call site, where being wrong is a React `Objects are not valid as a React child` **crash** — a false *raw* is a crash, a false *wrap* is a stringified primitive, and that asymmetry is precisely why the default is wrap-when-unsure.

**Also worth knowing:** `safeInterpolation` is set in **zero** `.rozie` files repo-wide. The documented per-component envelope opt-out (`<rozie safe-interpolation="false">`) has never been exercised on a real component, so there is no in-repo precedent for its behavior.

**Requirements:** TBD
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 13: `$classSelector` helper — cross-target class-name-to-selector bridge for engine wrappers

**Goal:** A component-library author can call `$classSelector('grip')` in a `.rozie` file — a new `$`-sigil helper in the established family (`$snapshot`/`$emit`/`$portals`/`$computed`/`$onMount`/`$watch`) — and the compiler lowers it per-target to the CSS selector that actually matches at runtime: a compile-time literal `".grip"` for Vue/Svelte/Solid/Angular/Lit (which keep literal class names, scoped via `[data-rozie-s-*]` attributes or, for Svelte, an appended scope class) and a runtime `"." + styles.grip` lookup for React (whose CSS-Modules pipeline hashes class names, e.g. `grip` → `_grip_17x98_26`). This closes Bug 3 of the SortableList drag-desync investigation — `SortableListDemo` passes `handle=".grip"` literally into SortableJS, but React's class hashing means the `.grip` handle selector never matches, so React cannot drag at all while the other five targets work. `$classSelector` is the principled, additive fix (a new callee-rewrite branch in the six target `rewriteScript.ts` files, mirroring `$snapshot`'s per-target lowering) and it generalizes to the whole post-v1.0 vanilla-JS-engine port slate — SortableJS `handle`/`filter`/`draggable`, flatpickr/TipTap/CodeMirror selectors, any third-party engine handed a CSS class selector. The work spans: the new helper recognized in the `$`-sigil substrate; per-target lowering in all six emitters; compiler validation that the referenced class exists in the component's resolved `<style>` scope; and updating `examples/demos/SortableListDemo.rozie`'s `handle=".grip"` to use it. Supersedes two rejected alternatives — ripping out React CSS Modules (large blast radius across the `compile()` output contract, snapshots, dist-parity, unplugin, VR) and forcing data-attribute handles (works around the bug, does not generalize). The two other SortableList bugs (React stale-closure, Lit dual-copy) are already fixed and committed separately.
**Requirements**: R1, R2, R3, R4, R5, R6, R7 (locked in 13-SPEC.md — the ROADMAP `TBD` was stale).
**Depends on:** None — technically independent of pending Phases 9–12 (sequencing/priority only).
**Plans:** 7/7 plans complete

Plans:
**Wave 1**

- [x] 13-01-PLAN.md — Wave 0 test scaffolds: ClassSelectorProbe dist-parity fixture, 6 per-target classSelector.test.ts + core validateClassSelector.test.ts, sortable-drag.spec.ts + dragEvent.ts skeletons

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-02-PLAN.md — Core layer: ROZ965-967 codes, validateClassSelector IR validator wired into lowerToIR, $classSelector in STABLE_IDENTIFIERS

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 13-03-PLAN.md — Per-target lowering: React (runtime styles expr) + Vue (literal) — both rewrite hooks each
- [x] 13-04-PLAN.md — Per-target lowering: Svelte + Solid (literal) — both rewrite hooks each
- [x] 13-05-PLAN.md — Per-target lowering: Angular + Lit (literal) — both rewrite hooks each

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 13-06-PLAN.md — Convert SortableListDemo.rozie to $classSelector; full force-rebuild gate sequence + dist-parity/snapshot rebless

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 13-07-PLAN.md — D-01 permanent Playwright drag spec (Vue spike then 6-cell fan-out; 5/6 cells passing, lit per-cell test.fixme) + R7 author docs

### Phase 14: Cross-framework attribute fallthrough

**Goal:** A component-library author can spread a dynamic object of attributes onto an element with `r-bind="obj"` — object form ONLY; `:attr` remains the single-named binding and there is deliberately no `r-bind:` colon syntax — and consumer-passed attributes that are not declared props fall through onto the component's root element by default, with an `inheritAttrs`-style opt-out that hands the author manual placement via `r-bind="$attrs"`. Scope: the `r-bind` object-spread directive; the `$attrs` accessor (the consumer-passed attribute cluster minus declared props); automatic root-element fallthrough plus its opt-out flag; per-target lowering across all six targets — React/Vue/Svelte/Solid get near-free object spread (`{...obj}`, `v-bind`, `$$restProps`), while Lit and Angular have no native attribute-object spread and need real per-target work; and an IntelliJ plugin + TextMate grammar sync recognizing `r-bind` as an object-form directive and `$attrs` as a magic identifier. Open questions for the spec: where the `inheritAttrs`-style flag lives and how it is spelled; merge precedence — including the special `class`/`style` merge — when an explicit `:class`/`:style` and an `r-bind` object touch the same key; and whether `$attrs` includes or excludes listeners (Vue 3 folds listeners into `$attrs`; Rozie's current direction keeps them separate — see Phase 15).
**Requirements**: R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11 (locked in 14-SPEC.md)
**Depends on:** None — independent feature work; sequenced after the current backlog (Phases 9–13), not functionally blocked by it.
**Plans:** 6 plans

Plans:
**Wave 1**

- [ ] 14-01-PLAN.md — Wave 1: spreadBinding IR variant + $attrs three-set registration + <rozie inherit-attrs> parse + ROZ969-971 codes + Wave 0 test scaffolds

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 14-02-PLAN.md — Wave 2: r-bind parser recognition + lowerTemplate spreadBinding lowering + $attrs auto-fallthrough synthesis + R8/R9 validateAttrFallthrough

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 14-03-PLAN.md — Wave 3: React + Solid spreadBinding emitters (D-03 hybrid key-normalization + normalizeAttrs runtime helpers + R6 class/style merge)
- [ ] 14-04-PLAN.md — Wave 3: Vue + Svelte spreadBinding emitters (v-bind / {...obj}, no key normalization + R6 class/style merge)
- [ ] 14-05-PLAN.md — Wave 3: Angular (inline effect()+Renderer2 applyAttrs) + Lit (rozieSpread lit-html directive) spreadBinding emitters

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 14-06-PLAN.md — Wave 4: ThemedButton dogfood + RBindProbe fixtures + IntelliJ/TextMate sync + dist-parity/typecheck/VR gates

**Cross-cutting constraints:**

- class/style merge when an r-bind literal and an explicit :class/:style coexist; other keys last-wins by source order

### Phase 15: Cross-framework listener fallthrough

**Goal:** A component-library author can spread a dynamic object of event listeners onto an element with `r-on="obj"` — object form ONLY; `@event` remains the single-named listener and there is deliberately no `r-on:` colon syntax — and consumer-passed listeners fall through following the same machinery Phase 14 establishes for attributes. Scope: the `r-on` object-spread directive; the `$listeners` accessor (the consumer-passed event-listener cluster — the listeners a consumer attached to the component, distinct from the author-side `<listeners>` block that *defines* external handlers); per-target lowering across all six targets, including a runtime listener-key adapter — a dynamic `{ click: fn }` object must be rewritten to `{ onClick: fn }` for React/Solid at runtime (a shim, not a compile-time rename), while Vue's `v-on` consumes it natively; reuse of Phase 14's fallthrough / `inheritAttrs` mechanism; and the IntelliJ plugin alignment folded in here — revert the now-incorrect `r-on:` colon-form completion (commit fd6b246), retext the `r-on`/`r-bind` quick-docs to the object-spread form, drop the `r-on:` branch from the modifier-chain parser — plus the matching TextMate grammar sync. Open question for the spec: keep `$listeners` as a separate accessor, or merge listeners into `$attrs` Vue-3-style.
**Requirements**: TBD (lock at /gsd-spec-phase 15)
**Depends on:** Phase 14 — reuses its fallthrough / `inheritAttrs` machinery and the per-target spread lowering.
**Plans:** 2 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 15 to break down)

### Phase 17: Lit ::part() cross-shadow-DOM styling bridge ✓ COMPLETE 2026-05-28

> **Completed 2026-05-28.** `::part(name)` consumer surface + producer `part="..."` passthrough shipped as a Lit-only emit divergence. Lit emits the W3C-correct `<child-tag>[data-rozie-s-<hash>]::part(<name>)` (research finalized this over the backlog's non-functional `:host()::part()` example — see 17-SPEC "Emit-shape correction"); the 5 non-Lit targets strip `::part` as a no-op; `:deep()` byte-identical (zero fixture drift). Verified **8/8 SPEC-R covered**. Code-review CR-01 blocker + WR-01 fixed, WR-02 documented (c148732). VR: render harness wired (f6f3016) + Linux baseline landed & visually confirmed — Lit cell asserts the amber cross-shadow render, 5 non-Lit gated as documented divergence (bb5c9d7); Linux verify 1 passed / 5 skipped / exit 0. Gates: dist-parity 584/584, build 29/29, typecheck 49/49, react-vite-demo e2e 21/21, docs build green. 13 commits ca87066..bb5c9d7 (unpushed).

**Goal:** Close the last cross-target CSS-parity gap. A consumer `.rozie` component can style a child **Lit** component's shadow-DOM-rendered element across the shadow boundary using a NEW `::part(name)` selector in its `<style>` block — the W3C standards-track way to pierce shadow DOM. The producer tags shadow-DOM elements with the standard HTML `part="<name>"` attribute. The SAME `.rozie` source compiles to working CSS on all six targets: load-bearing on Lit (emits `:host(<scope>)::part(<name>)` / delivered via the Phase 07.6 adoptedStyleSheets bridge), a harmless no-op on React/Solid/Vue/Svelte/Angular (where shadow DOM doesn't exist, so `::part()` has no meaning and is stripped). This is a **Lit-only emit divergence**: it ADDS a parallel `::part()` path and does NOT modify the existing `:deep()` lowerings on any target — `:deep()` keeps its current 6-target behaviour unchanged (Lit `:deep()` stays single-shadow-root).

**Locked decisions (owner-delegated 2026-05-28, autonomous kickoff):**

- Q1 → **coexist**. New `::part(name)` surface; `:deep()` unchanged on all 6 targets.
- Q2 → **explicit `part="..."`** producer attribute. No auto-derivation from class names; no new `r-part` sigil.
- Q3 → **literal part names**, treated as a producer/consumer contract (NOT scope-hashed — hashing would break consumer `::part(name)` matching).
- Q4 → **reuse Phase 07.6 prior art** (`packages/runtime/lit/src/adoptConsumerStyles.ts` consumer-side adoptedStyleSheets bridge, commit `543dd52`) for delivering `:host(<scope>)::part(<name>)` into the consumer shadow root.

**Requirements**: SPEC-R1, SPEC-R2, SPEC-R3, SPEC-R4, SPEC-R5, SPEC-R6, SPEC-R7, SPEC-R8 (SPEC-internal IDs; see 17-SPEC.md)
**Depends on:** Phase 07.5/07.6 (Lit consumer-side shadow-DOM CSS bridge) + quick task `260526-mk4` (`:deep()` cross-component escape hatch, all 6 targets). Sequentially follows Phase 16.
**Plans:** 4/4 plans complete

**Success Criteria** (what must be TRUE):

1. A consumer `.rozie` `<style>` writing `<child-selector>::part(name)` styles the child Lit component's shadow-DOM element bearing `part="name"` — verified across the shadow boundary in a working demo.
2. The same `.rozie` source compiles cleanly to all six targets: Lit emits the cross-shadow `::part()` rule (via `:host(<scope>)::part(<name>)` and/or the adoptedStyleSheets bridge); the 5 non-Lit targets strip `::part(...)` as a no-op and the producer's `part="..."` attribute passes through harmlessly.
3. The producer's `part="<name>"` attribute is emitted into the Lit shadow DOM and is a benign standard HTML attribute on the other 5 targets.
4. `:deep()` behaviour is byte-for-byte unchanged on all 6 targets (no regression to existing `:deep()` demos / dist-parity fixtures).
5. `docs/guide/features.md` `:deep()` section gains a `::part()` subsection with the cross-target translation table; `docs/guide/sortable-list.md:285-287` flips the Lit limitation → working pattern.
6. A dist-parity fixture + VR matrix cell exercises the cross-shadow `::part` pattern on Lit alongside the other 5 targets (Linux-rendered baselines). Final visual byte-identity sign-off may be deferred to a tracked HUMAN-UAT item if Linux baseline regen cannot be fully self-verified.

Plans:

- [x] 17-01-PLAN.md — Producer `part=` passthrough confirmation + PartCard/PartCardConsumer fixtures + Wave-0 per-target template-attr tests (SPEC-R3, SPEC-R4b)
- [x] 17-02-PLAN.md — Lit consumer `::part` cross-shadow emit (`<child-tag>[data-rozie-s-<hash>]::part(name)`) in scopeCss.ts (SPEC-R1 Lit arm, SPEC-R2, SPEC-R6)
- [x] 17-03-PLAN.md — Non-Lit `::part` strip on React/Solid/Svelte/Vue/Angular (SPEC-R1 non-Lit arm, SPEC-R4a) — SHIPPED 2026-05-28: React/Solid/Svelte `rule.remove()` in `scopeCss` walkRules; Vue `continue` in `stringifyRules`; Angular `.filter()` out before the `:deep`→`::ng-deep` branch. All additive, `:deep` byte-identical (SPEC-R5), no diagnostic. 5/5 per-target suites GREEN after `turbo build --force`. Commits `3ec244d` (RED) + `cf29c08` (GREEN)
- [x] 17-04-PLAN.md — Fixture wiring + rebless + `:deep`-drift diff + full CI gate + docs + VR/HUMAN-UAT (SPEC-R5, SPEC-R7, SPEC-R8)

### Phase 18: `$model.` producer-side two-way-write sigil

**Goal:** A component-library author writes to a `model: true` prop through a new producer-side `$model.` sigil (e.g. `$model.count++`, `$model.value += $props.step`, `$model.open = false`) instead of assigning to `$props.x`. `$model.x` is a read/write accessor whose valid keys are exactly the `model: true` subset of `<props>`; writes lower to the EXISTING per-target two-way path (React `onValueChange?.()` / Vue `emit('update:x')` / Svelte bind rune / Angular `valueChange.emit()` / Solid + Lit equivalents) — a front-end/syntax change reusing current lowering, NOT new lowering machinery. After this, `$props.x = y` becomes a HARD COMPILE ERROR universally — even for model props — restoring the universal "never assign to `$props`" orthodoxy. Resulting author rule: `$props.x` = read-only any prop; `$model.x` = read/write, model props only. New ROZ diagnostics for `$model.<nonModelProp>`, `$model.<nonExistent>`, and the new `$props.<modelProp> = …` hard error. IntelliJ/LSP + TextMate recognize `$model` as a namespace magic identifier with model-prop-name autocompletion (same machinery as `$props`/`$data`/`$refs`).

**Why pre-v1 / now-or-never:** the `@rozie` author surface is contract-frozen at publish. The read/write-channel split (read via `$props`, commit via `$model`) restores the cross-framework "props are read-only" orthodoxy that the current `$props.x = y`-for-model-prop form quietly violates. Cheap now, impossible after launch. Origin: 2026-05-30 pre-launch syntax-evaluation session.

**Codebase anchors (verified 2026-05-30):** the sigil/namespace registries `$model` must join are `MAGIC_ACCESSOR_NAMES` + `STABLE_IDENTIFIERS` in `packages/core/src/reactivity/computeDeps.ts` (lines 53 / 83) and `MAGIC_ACCESSORS = Set(['$props','$data','$refs','$slots'])` in `packages/core/src/semantic/validators/unknownRefValidator.ts:63`. Existing model-write recognition lives in `propWriteValidator.ts` (ROZ200 `WRITE_TO_NON_MODEL_PROP`; today it *allows* model-prop writes via the `decl.isModel return` at line ~99 — Phase 18 flips this to a hard error) and `updateExpressionValidator.ts`. Consumer-side `isWritableLValue` in `semantic/lvalue.ts` is the closest existing model-aware lvalue precedent (it is consumer `r-model:` turf, NOT producer — do not modify it). IntelliJ registries: `tools/intellij-plugin/src/main/kotlin/js/rozie/intellij/completion/RozieMagicIdentifiers.kt` + `tools/intellij-plugin/src/main/resources/rozie-globals.d.ts`. No existing `$model` token anywhere in `packages/core/src` or `tools/intellij-plugin/src` — the name is free.

**Scope notes:**

- PRODUCER-side only. Consumer-side `r-model:x="..."` binding syntax is UNAFFECTED.
- `$model` keys couple to the `model: true` subset of `<props>` the same way `$props`/`$data`/`$refs` keys couple to their blocks — reuse the existing sigil-resolution path, no new conceptual machinery.
- Large migration surface (expected): every example/fixture writing `$props.x` for a model prop (Counter, Modal, Dropdown, SortableList, Flatpickr, TodoList, Card/PartCard family, all `examples/consumers/**` mirrors, textmate fixtures, intellij testData) → `$model.x`; rebless all gate snapshots AFTER `turbo run build --force` of `@rozie/core` (dist-parity fixtures, per-target `target-*` snapshot suites, `@rozie/core` `match-*` cross-target snapshots, the 6 typecheck gates).

**Sibling (NOT this phase):** a separate consideration to migrate the `<listeners>` block body from JS-object-literal keys to template-directive syntax came out of the same session — tracked separately, out of scope here.

**Requirements**: 9 locked (see 18-SPEC.md); Plan 18-01 covers Req 1/3/4/5 at the core layer.
**Depends on:** None — independent, additive author-surface change. Higher priority than the rest of the pending backlog (9–12, 14, 15) on contract-freeze grounds; not functionally blocked by any of them.
**Plans:** 5/5 plans complete

Plans:

- [x] 18-01 — core `$model` recognition + ROZ204/205/113 diagnostics + read-dep normalization (Wave 1). Done 2026-05-31. NOTE: ROZ204 hard error turns the `@rozie/core` example-compile gate red (50 tests) until Wave 2 lowering (18-02) + Wave 3 example migration (18-03) land — expected per SPEC wave sequencing (see deferred-items.md).
- [x] 18-02 — 6-target `$model` write/read lowering (Wave 2)
- [x] 18-03 — example/fixture migration + full gate rebless (Wave 3)
- [x] 18-04 — (Wave-sequencing TBD)
- [x] 18-05 — IntelliJ + TextMate `$model` recognition (Wave 4, last)

### Phase 19: `<listener>` element form — replace object-literal `<listeners>`

**Goal:** A component-library author declares ambient/conditional event subscriptions with one or more `<listener>` **elements** inside the `<listeners>` block — `<listener :target="document" @keydown.escape="close()" r-if="$props.open" />` — instead of the JS-object-literal keyed by `"target:event.modifier"` strings. The block moves from the data-format family (object literal, shared with `<props>`/`<data>`) to the wiring-format family (markup, shared with `<template>`), which is where its content — event wiring onto targets — always belonged. A single `<listener>` may carry multiple `@event` bindings (paired events like `resize`+`scroll` under one `r-if`), fanning out to N `Listener` IR nodes. `r-if` replaces `when:` and drives conditional attach/detach (compile-time read, NOT render-tree). The existing `Listener` IR, the D-20 shared modifier pipeline, the conditional-attach lowering, and all six target emitters are reused unchanged — this is a parser front-end swap proven by per-target byte-identity against the pre-phase object-literal emit.

**Why pre-v1 / now-or-never:** sibling to Phase 18 — another contract-frozen author-surface change in the same window. Removes the one block whose format mismatched its content; makes the SFC block taxonomy coherent (wiring=markup, typed-data=object-literal, code=JS). Origin: 2026-05-30/31 pre-launch syntax-evaluation session.

**Codebase anchors (verified 2026-05-31):** front-end swap lives in `packages/core/src/parsers/parseListeners.ts` (object-walk → element-walk; splitter already treats `<listeners>` as `OPAQUE_BLOCK_NAMES`). IR is already element-ready: `ir/types.ts:461` `Listener` + `:477` `ListenerTarget` (global window/document | self/$el | ref) + existing `when: Expression|null` + `source` discriminator; `lowerers/lowerListeners.ts:decodeTarget` already maps `$refs.foo` (so D4's window/document-only limit is enforced at the new parser/validation layer, not the IR — `$refs` widening is purely additive later). D-20 byte-identity contract: `fixtures/ir/D-20-{listeners,template}-context.snap` + the shared exported `resolveModifierPipeline`.

**Locked owner decisions (2026-05-31):**

- **D1** — `<listener>` element form (rejected: directive-lines = not well-formed HTML; `<r-window>`/`<r-document>` template pseudo-elements = conditional-attach can't ride template mechanics; `$onGlobal()` sigil = owner prefers the declarative manifest surface).
- **D2** — multiple `@event` per `<listener>` tag; parser fans out to N `Listener` IR nodes (one-event-per-`Listener` IR lock + D-20 byte-identity preserved).
- **D3** — `r-if` replaces `when:` (universal Rozie conditional = "subscribed while condition holds"); `when` retired from the author surface.
- **D4** — `:target` accepts `window`/`document` only this iteration (both compile-time constants → trivial conditional-attach); `$refs` deferred with a docs signpost naming the hard part (re-attach when the ref'd element is itself `r-if`-gated / not-yet-mounted).

**Scope notes:**

- `<listener>` is FORBIDDEN in `<template>` (there `r-if` would mean conditional-render, not conditional-attach) — new diagnostic.
- `<props>`/`<data>` stay object literals — element form would stringify typed JS (`type: Foo<Bar>`, `as Shape`, `() => []`) and break the Phase 9 TS story; explicitly OUT of scope (wiring-vs-typed-data is the discriminator).
- Phase 15 consumer-side listener fallthrough (`r-on="$listeners"`, `inherit-listeners`, `$listeners`) is a distinct feature — untouched.
- Migration surface: `Modal`, `Dropdown`, all `examples/consumers/**` mirrors, textmate/intellij fixtures → element form; rebless all four gate families (dist-parity, target-* snapshots, match-* + the D-20 IR snapshot, 6 typecheck) after `turbo run build --force`.

**Requirements**: 9 locked in 19-SPEC.md
**Depends on:** None functionally — independent author-surface change. Pairs with Phase 18 (also contract-freeze). Not blocked by 18; can run after it or interleave.
**Plans:** 3/3 plans complete

Plans:

- [x] 19-01-PLAN.md — Wave 1: parser front-end swap (parseEventAttr extraction, parseListeners element-walk + synthesis bridge, :target/ROZ114, multi-@event fan-out, r-if→IR `when`, ROZ015, listenerElementValidator/ROZ206, drop dead object-walk emission) [Req 1–5]
- [x] 19-02-PLAN.md — Wave 2: byte-identity arbitration (Modal first) → migrate Dropdown + all consumer mirrors + synthetic/regression fixtures → rebless all 4 gate families + D-20 IR snapshot (--force order) [Req 6–8]
- [x] 19-03-PLAN.md — Wave 3 (LAST): IntelliJ + TextMate <listener> recognition/completion/@event go-to-def + tooling fixture migration + docs rewrite (element form + $refs-future note) [Req 9]

### Phase 20: `@rozie-ui/sortable-list` — first shippable component package family

**Goal:** Ship the first `@rozie-ui` product: six pre-compiled, per-framework npm packages (`@rozie-ui/sortable-list-{react,vue,svelte,angular,solid,lit}`) generated from one canonical `SortableList.rozie` source. A consumer runs `npm i @rozie-ui/sortable-list-react`, imports an idiomatic component, and writes ZERO Rozie-toolchain config — the dogfooding proof of the Rosetta-stone framing and the realization of backlog 999.1 for SortableJS. A single `codegen.mjs` engine emits all six targets AND generates per-package docs (READMEs + props/events/slots tables) from the parsed source so docs can never drift from the compiled output.

**Why now:** First concrete cross-framework component drop; turns "compiles one source to six targets" (abstract) into "Svelte/Solid devs get a quality SortableJS component they didn't have" (concrete). Doubles as a non-trivial dogfood stress test of the shipped v1 compiler.

**Locked owner decisions (2026-05-31):**

- **D1 — Distribution model:** PRE-COMPILED, PER-FRAMEWORK packages. NOT source-first, NOT one-package-with-subpath-exports. Consumer installs idiomatic framework code with zero Rozie awareness.
- **D2 — Scope:** `@rozie-ui` org owned by user. Each leaf: version 0.1.0, `publishConfig.access: public`.
- **D3 — Helper colocation:** `useSortableJS` MOVED out of `@rozie/runtime-engine-helpers` (RETIRED, never published) into the component package at `packages/ui/sortable-list/src/internal/useSortableJS.ts` (+ unit test travels with it). The `.rozie` source imports it RELATIVELY (`./internal/useSortableJS`) → codegen copies `src/internal/` into each leaf, relative path resolves untouched, NO import-specifier rewrite. Shipped leaves carry NO `@rozie/*` helper dependency.
- **D4 — Generic runtimes stay shared:** `@rozie/runtime-<fw>` (slot rendering / class merge — generic, not sortablejs-specific) remain normal published deps of the leaves. Any needed runtime that is `private:true` is a BLOCKER to surface.
- **D5 — Layout:** `packages/ui/sortable-list/` meta dir holds `src/SortableList.rozie` (MOVED from examples/), `src/internal/`, `scripts/codegen.mjs`, and 6 leaves under `packages/ui/sortable-list/packages/{fw}/`. pnpm-workspace gains `packages/ui/*` + `packages/ui/*/packages/*`.
- **D6 — Doc automation:** `codegen.mjs` is the single engine using `compile()` from `@rozie/core`. Props/events/slots tables DERIVED by parsing `SortableList.rozie` once (`<props>` IR → name/type/default/model/required; slots from `<slot>` nodes; events from `$emit('change'|'add'|'remove'|'start'|'end',…)`). Existing 3 sortable docs pages folded in, not rewritten.

**Canonical-source move (repoint 4 dev surfaces resolving `examples/SortableList.rozie` / `@rozie/runtime-engine-helpers`):**

- (a) `docs/.vitepress/rozie-codegen.ts` `resolveExample()` — add package-source branch/path-map.
- (b) `examples/playground/src/snippets.ts` — 6 `bundle/SortableList*` entries; iframe runtime resolves relative `./internal/useSortableJS`.
- (c) `tests/visual-regression` host/specs — build from new source path.
- (d) `examples/consumers/solid-vite` SortableListNested page.
- `KanbanColumn.rozie` + the 6 demos STAY in `examples/` (consumers of the component, not shipped API).

**Scope notes:** PACKAGING + TOOLING phase — NO compiler/emitter changes expected. If an emitter change is discovered necessary, surface as a RISK rather than silently expanding scope. Existing assets to leverage (do NOT rebuild): `examples/SortableList.rozie` (compiles clean to all 6 targets), `KanbanColumn.rozie`, 6 demos, `engine-helpers/src/useSortableJS.ts` + test, 6 VR `sortable-*.spec.ts`, 6 playground bundles, 3 docs pages.

**Requirements** (locked — every plan's `requirements` field binds to these REQ-IDs):

1. **REQ-20-1** — `packages/ui/sortable-list/` meta-package: canonical `src/SortableList.rozie` (moved from examples/), `src/internal/useSortableJS.ts` + test (moved from engine-helpers), `scripts/codegen.mjs`; pnpm-workspace globs added; `turbo`/biome wiring consistent with repo.
2. **REQ-20-2** — Six leaf packages `@rozie-ui/sortable-list-{react,vue,svelte,angular,solid,lit}` exist, each at 0.1.0, `publishConfig.access: public`, peerDeps `sortablejs ^1.15` + its framework, deps only `@rozie/runtime-<fw>`, tsdown build (dual ESM/CJS+dts for react/solid/lit; source-ship for vue/svelte/angular per `@rozie/target-*` convention).
3. **REQ-20-3** — `@rozie/runtime-engine-helpers` retired: no shipped leaf and no dev surface references it; `useSortableJS` lives only in the component package; relative import resolves with no rewrite.
4. **REQ-20-4** — `codegen.mjs` engine: `compile()` all 6 targets into leaves + copy `src/internal/` per leaf + generate per-leaf README (install cmd + idiomatic per-framework consumer usage + props/events/slots tables) + regenerate docs props-table; all tables from a single parse of the source.
5. **REQ-20-5** — 4 dev surfaces repointed (rozie-codegen resolver, playground snippets, VR host/specs, solid-vite page); `KanbanColumn` + demos remain in examples/; playground + VR still build/render SortableList.
6. **REQ-20-6** — Per-framework consumer smoke proves each shipped package imports + renders (Vite consumer demos where they exist).
7. **REQ-20-7** — Gates green: `turbo run build --force`; 6 per-target typecheck; `pnpm --filter docs build`; grep-gate asserting zero leaf references to `@rozie/runtime-engine-helpers`; dist-parity unaffected (no emitter change) or reblessed if touched.
8. **REQ-20-8** — Docs: existing 3 sortable pages folded into the package-docs structure; generated per-leaf READMEs present and accurate.

**Depends on:** None functionally — packaging/tooling layered over the shipped compiler. Realizes backlog 999.1 for SortableJS.
**Plans:** 5/4 plans complete

Plans:

- [x] 20-01-PLAN.md — Wave 1: scaffold meta-package + 6 leaf shells, move source/helper/test, workspace globs + turbo wiring (REQ-20-1, 20-2, 20-5)
- [x] 20-02-PLAN.md — Wave 2: codegen.mjs (parse-once → emit-6 → copy-internal → render-6-READMEs) + build bundled leaves (REQ-20-4, 20-6)
- [x] 20-03-PLAN.md — Wave 3: repoint 4 dev surfaces + graph-ordered engine-helpers retirement (REQ-20-3, 20-5)
- [x] 20-04-PLAN.md — Wave 4: full gate battery + consumer smoke + docs fold (validate-not-overwrite) (REQ-20-6, 20-7, 20-8)

### Phase 21: $expose imperative-handle sigil — cross-cutting compiler feature

**Goal:** A component author writes a single `$expose({ reset, focus })` call in a `.rozie` `<script>` block, and the compiler emits — for all six targets — an idiomatic, consumer-callable, typed imperative handle exposing exactly those named functions, with every type gate green and zero change to non-`$expose` output.
**Requirements**: REQ-1..REQ-11 (SPEC.md locked set)
**Depends on:** Phase 20
**Plans:** 7/7 plans complete

Plans:

- [x] 21-01-PLAN.md — Core spine: $expose sigil + RESERVED_SIGILS lockstep + ROZ115-120 + collector + ir.expose IR field + runExposeValidator + synthesizeHandleType (Wave 1)
- [x] 21-02-PLAN.md — React emit: forwardRef + useImperativeHandle + handle interface in .tsx and .d.ts, byte-identical when empty (Wave 2)
- [x] 21-03-PLAN.md — Vue emit: defineExpose macro (Wave 2)
- [x] 21-04-PLAN.md — Svelte emit: instance export functions (Wave 2)
- [x] 21-05-PLAN.md — Solid emit: callback ref prop, ref excluded from DOM spread (Wave 2)
- [x] 21-06-PLAN.md — Angular + Lit emit: public class/element methods + assert-public guarantee (Wave 2)
- [x] 21-07-PLAN.md — Dogfood: examples/ExposeProbe.rozie + dist-parity D-03 byte-identity proof + 6 typecheck paths + VR external-caller spec (Wave 3)

### Phase 22: Typed `.rozie` imports on the unplugin path

**Status:** ✓ CLOSED 2026-06-05 — 7/7 plans, VERIFICATION passed (9/9 must-haves), HUMAN-UAT 2/2 passed (Dan confirmed; both items re-run live against current HEAD). On origin/main.

**Goal:** A consumer importing a `.rozie` file through `@rozie/unplugin` gets full TypeScript types for that specific component — typed props, typed event callbacks, and the `$expose` handle type importable by name (`import Dropdown, { type DropdownHandle } from './Dropdown.rozie'`) — replacing today's untyped `ComponentType<Record<string, unknown>>` wildcard shim across all six framework consumer projects.

**Why now:** Phase 21 + quick task 260601-itw made the *compiled* output fully typed (props interfaces, exported `<Name>Handle` types, `.d.ts` on the CLI and `@rozie-ui` paths) — but the unplugin path, the primary "drop a `.rozie` file in any pipeline" story, still delivers zero type safety. The compiler already knows everything (`ir.props`/`ir.emits`/`ir.expose`, `synthesizeHandleType`, `emitTypes`); the gap is purely declaration *delivery* to the consumer's TS program. Working hypothesis: TS 5's `allowArbitraryExtensions` + generated `<Name>.d.rozie.ts` sidecars (TS floor is 5.6 ✓); mechanism details routed to research.

**Spec:** `.planning/phases/22-unplugin-typed-rozie-imports/22-SPEC.md` (9 locked requirements — bind plans to the SPEC's numbered list; `phase_req_ids` is null per the SPEC-internal-IDs convention)

**Requirements (summary — SPEC.md is canonical):**

1. Per-component prop types from `ir.props` (typo/type errors at consumer `tsc --noEmit`)
2. Named handle-type exports importable from the `.rozie` specifier (drop the demo's local re-declaration)
3. Event-callback prop types from `ir.emits`
4. All six framework consumer projects, each with its framework's component-type idiom
5. Generation automatic in dev/build (no manual codegen step)
6. Stale/missing-declaration behavior defined and gate-tested
7. Commit-vs-ignore policy for generated declarations decided + applied consistently
8. Docs: per-framework typed-import setup, replacing wildcard-shim instructions
9. Full existing battery green + new prop-typo probes wired into per-framework typecheck gates

**Depends on:** Phase 21 (complete) + quick task 260601-itw (complete)
**Plans:** 7/7 plans complete

Plans:
**Wave 1**

- [x] 22-01-PLAN.md — Wave-0 vue-tsc/svelte-check/Angular sidecar-honoring spike → SPIKE-FINDINGS.md (locked decision 3) — DONE 2026-06-01: all 3 honor `.d.rozie.ts`; Vue under bundler default, **Svelte+Angular need explicit `allowArbitraryExtensions: true`** (wildcard shadows otherwise); Angular disk-cache coexists, sidecar complementary not redundant
- [x] 22-02-PLAN.md — hoist shared renderPropsInterface into @rozie/core; refactor React emitTypes byte-identically — DONE 2026-06-01: `packages/core/src/codegen/renderPropsInterface.ts` (renderPropsInterface + renderPropType + inferParamType, slotChildrenType-parameterized, barrel-exported); React emitReactTypes consumes it BYTE-IDENTICALLY (snapshots 22/22 no rebless, dist-parity 608/608 zero drift); LOCKED CONTRACT for Wave 2 in 22-02-SUMMARY.md

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 22-03-PLAN.md — new emitVueTypes/emitSvelteTypes/emitSolidTypes renderers + barrels — DONE 2026-06-02: three per-target `.d.rozie.ts` renderers consuming the LOCKED renderPropsInterface (slot tokens Vue `unknown` / Svelte `Snippet`+conditional import / Solid `JSX.Element`), swapping only the default-export idiom (`DefineComponent` / `import('svelte').Component` / `import('solid-js').Component`); conditional `<Name>Handle` export iff ir.expose; barrelled; 13 tests; build 43/43, test 50/50, typecheck 62/62, dist-parity 608/608 zero drift
- [x] 22-04-PLAN.md — new emitLitTypes (element class + HTMLElementTagNameMap) + emitAngularTypes (disk-cache coexistence per spike) + barrels — DONE 2026-06-02: `emitLitTypes` emits `export default class <Name> extends LitElement` (public ir.expose members) + `declare global { HTMLElementTagNameMap { 'rozie-<kebab>': <Name> } }` (kebab from the SAME `emitTagName` helper as runtime `@customElement` — cannot drift); `emitAngularTypes` emits `declare class <Name>` (typed prop members + public ir.expose methods) exported as default — single class binding is value+type so NO `Type<>` const (would TS2451 duplicate-identify; Rule-1 deviation from the plan's illustrative class+const shape). LOCKED Plan-05 decision: WRITE the Angular sidecar to disk (coexists with disk-cache `.rozie.ts` per SPIKE-FINDINGS; demo adds `allowArbitraryExtensions:true`; keep disk-cache). Both barrelled; 7 tests (lit 4, angular 3); build 43/43, test 50/50, typecheck 62/62, dist-parity 608/608 zero drift. SPEC-R4 (all six idioms) complete.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 22-05-PLAN.md — unplugin emitSidecar (buildStart shared hook) + CLI fallback + staleness hash header + REQ-7 GITIGNORED — DONE 2026-06-02: `emitSidecar`/`renderSidecar`/`sidecarSourceHash` in `packages/unplugin/src/emitSidecar.ts` (parse→lowerToIR→bail-on-diagnostics→dispatch emit<Target>Types→sha256 hash header→`.d.rozie.ts` NEVER `.rozie.d.ts`→reuse emitRozieTsToDisk trust-boundary + idempotent skip); PURE `renderSidecar` shared by unplugin AND CLI (zero drift); SHARED `buildStart` hook (all 6 adapters, NOT Vite-only) + additive Vite-only `handleHotUpdate` refresh, `enforce:'pre'` preserved; CLI `build`/`watch` emit non-React sidecars via `renderSidecar`; REQ-7 GITIGNORED verified (`.gitignore:29 *.rozie.ts` covers it, NO new rule). 11 emitSidecar + 48 CLI tests green. Commits `7b5e9319`/`ae5ed0a5`/`4636596c`. SPEC-R5/R6/R7 complete. **Checkpoint Option A: finalize as-is — angular-analogjs-demo whole-repo typecheck is KNOWN-RED (cross-rozie `export *` shim shadows the sidecar → TS2614), a documented Plan-06 entry condition (NOT a Plan-05 defect); build + test gates whole-repo GREEN.**

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 22-06-PLAN.md — migrate 6 demos off wildcard shim + DropdownImperativePage handle import + per-demo prop-typo probes — DONE 2026-06-02: all six demos consume per-module `<Name>.d.rozie.ts` sidecar types; `DropdownImperativePage.tsx` imports `{ type DropdownHandle }` by name (local re-decl + cast deleted, REQ-2); six `typed-import.probe.{ts,tsx}` with consumed `@ts-expect-error` typos (REQ-9). Per-demo: vue = no flag (vue-tsc bundler default); react/solid/svelte/lit/angular = `allowArbitraryExtensions:true`. Wildcards: react/svelte/lit/angular deleted (clean), vue/solid kept `@deprecated` (cross-root `examples/*.rozie`). **Angular cross-rozie red cell RESOLVED** via type-only `emitAngularTypes` → `export declare class <Name>` (named+default); runtime AOT path unchanged (a `.rozie.js` shim rewrite was reverted — broke @analogjs AOT). Commits `eb90c1f6`/`c2bca096`. Whole-repo typecheck **62/62**, build 43/43, test 50/50, dist-parity 608/608, react e2e 22/22. SPEC-R1/R2/R3/R4/R9 complete. angular e2e JIT failure is PRE-EXISTING/deferred (vite.config.ts:18-24).

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 22-07-PLAN.md — docs + staleness gate + fresh-checkout CI ordering + full cold battery + e2e (human-verify checkpoint) — DONE 2026-06-02: docs `install.md` typed-import section (per-framework `allowArbitraryExtensions` truth as SHIPPED per 22-06: Vue no flag, react/solid/svelte/lit/angular all need it) + named `{ type DropdownHandle }` import + deprecate-don't-delete wildcard migration + REQ-7 gitignore policy + CLI fallback; `features.md` typed-imports subsection cross-linking the per-demo proof. `scripts/check-sidecar-staleness.mjs` (re-hash vs sha256 header; `--self-test` automates the tampered-sidecar negative path) + `scripts/probe-dynamic-rebuild.mjs` (SPEC AC-3: edit `<props>` → buildStart regen → consumer typecheck RED → restore → GREEN). NO new ci.yml — the six matrix workflows already `pnpm turbo run build` (incl. each demo's `vite build` = buildStart sidecar emit) BEFORE the per-demo typecheck; made the REQ-6 ordering explicit via step-name + comments; staleness gate wired into `ci-prepush.sh`. Commits `22327314`/`8ce35a5f`. Full cold battery GREEN: build 43/43, typecheck 62/62, test 50/50, dist-parity 608/608 ZERO drift, react e2e 22/22, docs 58/58 anchors; fresh-checkout sim + AC-3 + staleness negative-path all pass; REQ-7 0 sidecar-noise. SPEC-R5/R6/R7/R8/R9 complete. **Phase 22 CLOSED.**

### Phase 23: Angular CVA forms integration

**Goal:** A Rozie component with exactly one `model: true` prop works with Angular's forms system out of the box — `[(ngModel)]` and `formControlName`/`[formControl]` bind to it like any native form control. The Angular emitter auto-implements `ControlValueAccessor` (writeValue / registerOnChange / registerOnTouched / setDisabledState + `NG_VALUE_ACCESSOR` provider + focusout→touched host binding), gated by a new per-target compiler config namespace (`angular: { cva: boolean }`, **default ON**) plumbed through all four entrypoints (CLI / unplugin / babel-plugin / Vite-runtime). The `.rozie` language is untouched.
**Requirements**: Spikes MANIFEST REQ-13…REQ-17 (semantics) + REQ-18 (docs, shipped early as b1d6487d); decision + validated semantics table in `.planning/research/angular-cva-decision.md` (ADR 2026-06-02); spike scaffolding/e2e starting point committed as `61911316` (tests/visual-regression cva-probe + flatpickr-cva.spec.ts)
**Depends on:** Phase 22
**Plans:** 6/6 plans complete

Scope notes (from the ADR):

- View→model hookup at the internal model-write site (NOT effect-on-signal — echo, proven by spike 006-D)
- `writeValue(null)` → prop default (load-bearing at NgModel init, not just reset())
- `setDisabledState` → internal `__rozieCvaDisabled` signal merged into internal `disabled` reads; no-op + info diagnostic when no disabled prop
- Multiple model props → no auto-CVA + diagnostic
- New ROZ diagnostic: `$expose` name collision with reserved CVA method names
- `emitDecorator.ts` gains `providers:` support (first use)
- Ship train: emitter + config plumbing → dist-parity rebless → target-suite snapshots → VR/angular-analogjs e2e → regenerate @rozie-ui Angular leaves → close flatpickr-comparison.md CVA caveat

Plans:
**Wave 1**

- [x] 23-01-PLAN.md — Wave-0 scaffolding: register ROZ124/125/126 codes + off-state dist-parity fixture + Angular-package CVA test-input fixtures (no emit change) — DONE 2026-06-03: ROZ124 EXPOSE_CVA_NAME_COLLISION (error) + ROZ125 CVA_MULTI_MODEL_NO_ACCESSOR + ROZ126 CVA_NO_DISABLED_PROP (info) in core codes.ts registry-only (e386968e); `examples/CvaOffState.rozie` single-model off-state fixture via producer-side `$model.value` write + 8 baselines + bootstrap/parity registration, 632/632 parity green ZERO drift (c3176977); three Angular cva-fixtures MultiModelProbe(SPEC-7)/ExposeCvaCollision(SPEC-8)/SingleModelNoDisabled(SPEC-4) all compile clean, angular suite 351+1todo green (92bacf13). Pure-additive — NO emit-path edits, gate battery not triggered. 2 deviations: Rule-3 fixture source→examples/ (bootstrap wipes fixtures/); Rule-1 r-model:value→:value+@input→$model.value (ROZ950). UNPUSHED.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 23-02-PLAN.md — Core CVA emit: cvaModelProp single gate + 4 methods/3 members (emitScript) + providers/host (emitDecorator) for single-model components — DONE 2026-06-03: `EmitAngularOptions.cva?` default-ON-in-emitter (`opts.cva ?? true`) + `cvaModelProp` computed once (one-model→prop, zero/≥2/cva:false→null) threaded to emitScript+emitDecorator + signal/forwardRef/NG_VALUE_ACCESSOR imports + AngularFormsImport union + reserved cvaDiagnostics slot (44037fff); `buildCvaClassShape` writeValue(null→default)/registerOnChange/registerOnTouched/setDisabledState/__rozieCvaOnTouched + 3 private members (7a39340f); providers:NG_VALUE_ACCESSOR + host:(focusout) — first use of both in emitDecorator (66991cb8); RED test 9b0ac571. cva-emit 14/14 GREEN, build+typecheck GREEN, gate single-model-only (LeafletMap 2-model byte-identical). EXPECTED-RED: 6 single-model snapshots drift (pure CVA-shape add) — rebless DEFERRED to Plan 05. Deviation Rule-3: pkg is @rozie/target-angular not -targets-. UNPUSHED.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 23-03-PLAN.md — Dynamic wiring: __rozieCvaOnChange at all 3 model-write sites (no effect) + disabled OR-merge + cvaDiagnostics (ROZ124/125/126) — DONE 2026-06-03: Tasks 1+2 (514e22ac) — `this.__rozieCvaOnChange(<newValue>)` injected at every internal model-write for the single CVA prop across script/template/listener via `SequenceExpression([setter, onChange])` (expression-safe, Pitfall 1) + sibling stmt for `++`, NEVER via effect() (006-D, grep-verified); disabled OR-merge `(this.disabled() || this.__rozieCvaDisabled())` at every internal `$props.disabled` read (incl. ngAfterViewInit seed); gate threaded via EmitNodeCtx/EmitAttrCtx/EmitEventCtx (24 rewriteTemplateExpression sites) + emitListeners cva param, rewrites default-OFF (cva:false suppresses end-to-end). Task 3 (480259c1) — new `cvaDiagnostics.ts` (pure, never-throws) emits ROZ124 collision-error (iterates canonical ir.expose) / ROZ125 multi-model-info / ROZ126 no-disabled-info into the reserved slot. RED 8106b3da; seed test 50367ea0. cva.test 19/19 GREEN, build+typecheck GREEN. EXPECTED-RED carry-forward EXPANDED to 6 snapshots (snapshot-suite Counter/Dropdown/TodoList/Modal + model-sigil + ts-passthrough Counter — any single-model fixture with a model write now emits __rozieCvaOnChange; CVA-only drift; $model-vs-$props byte-identity STILL PASSES); rebless DEFERRED to Plan 05. Deviation Rule-3: pkg is @rozie/target-angular not -targets-. UNPUSHED.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 23-04-PLAN.md — Config plumbing: angular:{cva} default-ON through compile()/CLI/unplugin (both call sites) + off-state byte-equality fixture wired — DONE 2026-06-03: 3 commits. Task 1 (b825339d) — CompileOptions.angular?:{cva?:boolean} (FIRST per-target emit-semantics namespace) threaded into emitAngular ONLY in the angular switch branch via conditional-spread; CLI --no-cva opt-out on `rozie build`+`rozie watch` (commander `--no-` inversion → BuildOptionsExt.cva/WatchOptions.cva → compileOpts/compileOne; attaches angular:{cva:false} only on opt-out so default-ON omits byte-identically). Task 2 (a34c2710) — RozieOptions.angular shape-validated at factory-call time → **ROZ405** UNPLUGIN_ANGULAR_OPTIONS_INVALID (thrown BEFORE any Vite hook for non-object/array angular or non-boolean cva — T-23-04-OPT) + cva threaded IDENTICALLY into BOTH emitAngular() sites (Vite-runtime runAngularPipeline + disk-prebuild runAngularEmitForDisk) via createLoadHook/createTransformHook/prebuildAngularRozieFiles/emitRozieTsToDisk param chains (all default-undefined); factory passes options.angular?.cva into load hook + configResolved prebuild + HMR re-emit (Pitfall 2). Task 3 (30c02fb7) — **babel-plugin (4th entrypoint) DID need an edit** (hardcodes compile(source,{target,filename}); threaded angular.cva through RozieBabelPluginOptions→compileImport→writeSiblingIfStale→compile() — Rule 2) + dist-parity FIXTURE_ANGULAR_CVA_OFF drives CvaOffState's Angular leg cva:false on ALL FOUR legs + new off-state describe (cva:false has NO CVA surface / default-ON DOES / four legs byte-identical). Committed CvaOffState.angular.ts baseline (pre-CVA from Plan 01) already == cva:false output → NO fixture rebless. All builds GREEN; babel-plugin 11/11; dist-parity CvaOffState 24 cells + 3 off-state assertions GREEN. EXPECTED-RED: 20 on-state cells (Counter/Dropdown/TodoList/Modal/WrapperModal × 4 legs) + 1 unplugin Counter.ts.snap = Plan 23-05 rebless. UNPUSHED.

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 23-05-PLAN.md — Gate battery + rebless: build --force → dist-parity bootstrap → cold test/typecheck → VR matrix Linux Docker (human-gated) — DONE 2026-06-03: 2 commits. Task 1 (45592b96) — `turbo run build --force` FIRST (stale-core guard: turbo does NOT hash packages/targets/angular/src into @rozie/core) → dist-parity bootstrap rebless of single-model Angular .angular.ts fixtures with CVA; LeafletMap (2 models) + every zero-model fixture byte-identical (Pitfall-5 leak guard). Task 2 (592d7b27) — cold `turbo test --force` + `turbo typecheck --force` rebless of @rozie/target-angular toMatchSnapshot suites + @rozie/core match-* cross-target snapshots + **Rule-1 emitter fix**: required-no-default model props coerce writeValue(null)→this.<name>() instead of raw null (strict-tsc TS2345 — null not assignable to non-nullable signal). Full cold battery GREEN: build 43/43, dist-parity 635/635 byte-equal across 4 entrypoints (incl. CvaOffState off-state), test 50/50, typecheck 62/62, react-vite e2e 22/22 (unaffected), angular-analogjs e2e 17/17 (deferred JIT baseline resolved e02ca808, ZERO new failures). **Task-3 VR checkpoint APPROVED (orchestrator auto-mode 2026-06-02):** tools/ci-repro/vr.sh full Linux-Docker matrix = 298 passed / 2 EXPECTED-RED / 23 skipped; pixel matrix FULLY GREEN, ZERO Angular baseline shifts (CVA emit non-visual: providers + (focusout) host + class members), NO regen needed. EXPECTED-RED carry-forward to 23-06: specs/flatpickr-cva.spec.ts 005-A/005-B (spike-era probes asserting [(ngModel)]/[formControl] CRASHES NG01203) now FAIL because the binding NO LONGER crashes — the component IS a ControlValueAccessor; runtime proof CVA works + the exact inversion target of 23-06 Task 1. Deviation Rule-1: writeValue null-coercion fix. UNPUSHED.

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 23-06-PLAN.md — Ship-train tail: re-target forms e2e (delete directive, invert 005, bind direct) + regen @rozie-ui Angular leaf + close docs caveats — DONE 2026-06-03: 2 commits. Task 1 (fc9abac5) — deleted RozieFlatpickrCva/RozieFlatpickrCvaNaive from cva-probe.ts (grep==0); re-targeted 006-A/B/C to bind [(ngModel)]/[formControl]/[(date)]+[formControl] directly to <rozie-flatpickr>; INVERTED 005-A/B to assert no-crash+round-trip; repurposed 006-D as a zero-echo guard; control-state observation (ctrl.dirty/touched/value) replaces the directive viewChild; probes still mount inside NgZone.run(). **Task-2 e2e checkpoint APPROVED (orchestrator 2026-06-02):** playwright test specs/flatpickr-cva.spec.ts = 7/7 PASSED (23.6s) — 005-A/B/C + 006-A/B/C/D all green; zero hand-written CVA in the harness. Run on the macOS host (not Docker) — legitimate: the re-targeted spec is behavioral-only (no screenshots, runs without Docker pixel baselines); Docker path blocked by a host-memory/VirtioFS ENOMEM infra issue (3 documented attempts). Task 3 (5e9e9843) — regenerated @rozie-ui Flatpickr + SortableList Angular leaves via codegen.mjs carrying CVA (NEVER hand-edited; idempotent re-run reproduced the exact diff; NG_VALUE_ACCESSOR grep==2; no .d.rozie.ts sidecar — ANGULAR EXCEPTION); flipped comparison-page Angular-CVA cell ✗→✓ + replaced the "does not implement ControlValueAccessor" caveat with an at-parity statement; replaced flatpickr.md REQ-18 warning with a working formControlName/ngModel recipe + [(date)]-vs-form coexistence semantic + touched/null-coercion/disabled-merge contract + cosmetic ng-* fallthrough; `pnpm --filter docs build` GREEN (80 anchors, 0 broken). **Phase 23 ✓ CLOSED 2026-06-05 — all 6 plans done; VERIFICATION passed (11/11), HUMAN-UAT 2/2 passed (Dan confirmed).** Deviation: SortableList leaf committed alongside Flatpickr (same codegen-artifact class). On origin/main, CI green.

### Phase 24: Security self-test battery — automated assurance over emit-safety + supply-chain invariants

**Status:** ✓ CLOSED 2026-06-05 — 5/5 plans, VERIFICATION passed (8/8 must-haves), HUMAN-UAT passed (Dan confirmed). On origin/main, CI green (incl. the Dependency Drift workflow).

**Goal:** Rozie demonstrably tests itself against security red-flags — a trust asset for design-system authors adopting it upstream of their builds. Ship four net-new automated batteries (path-safety via emitSidecar guards/tests, parse-not-eval, and runtime-isolation already have gates — out of scope):

1. **Cross-target emit-escaping suite** — scan the dist-parity corpus (and any new security fixtures) for dangerous HTML/exec sinks (`innerHTML`, `dangerouslySetInnerHTML`, `bypassSecurityTrustHtml`, `v-html`, `{@html`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function(`) with an EXPLICIT, fixture-exercised `r-html` allowlist; PLUS a positive assertion that `{{ }}` interpolation lowers to each target's text-safe binding (JSX text / Vue mustache / Svelte text / Angular interpolation / Lit text / Solid text) — never an HTML path. Recon (2026-06-03): corpus is sink-clean today, but vacuously — no fixture exercises `r-html`, so the allowlist boundary is currently untested.

2. **Per-target `r-html` sanitizer-parity assertion** — document + assert which targets route `r-html` through the framework sanitizer (Angular `[innerHTML]` + `DomSanitizer`) vs raw-by-design (React `dangerouslySetInnerHTML`, Vue `v-html`, Svelte `{@html`, Solid `innerHTML`, Lit `unsafeHTML`). A genuine cross-framework-parity finding to surface, not gloss — `ROZ520` already rejects `r-html`-with-children.

3. **Adversarial-input fixture set** — hostile interpolation / attribute values (incl. `javascript:`/`data:` URI schemes on `href`/`src`, null bytes, `</script>`/`-->`/`]]>` breakouts, deep nesting) asserting the compiler emits a diagnostic OR lands the hostile content in an escaped text/attribute position — never raw markup, never a hang/OOM. Closes the playground / future user-submitted-component untrusted-input surface.

4. **Dependency-drift CI gate** — fail on unexpected new transitive deps (lockfile allowlist), the automatable slice of the supply-chain class.

Also DOCUMENT the controls-not-tests items so they don't fall off the radar: npm provenance/sigstore, publish-token 2FA, CI `pull_request_target` secret hygiene.

**Requirements**: SPEC-1, SPEC-2, SPEC-3, SPEC-4, SPEC-5, SPEC-6, SPEC-7, SPEC-8 (locked in 24-SPEC.md; not in REQUIREMENTS.md registry)
**Depends on:** Phase 23
**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 24-01-PLAN.md — Vue v-html + Lit unsafeHTML r-html emit + ROZ421/ROZ833 + relax old Lit invariant tests (SPEC-1/2)
- [x] 24-02-PLAN.md — dependency-drift CI gate: name-allowlist script + workflow + ci-prepush hook (SPEC-8)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 24-03-PLAN.md — RHtml fixture + dist-parity bootstrap/byte-equality + VR cell + Linux baseline (SPEC-3/4)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 24-04-PLAN.md — tests/security package: sink-scan + sanitizer-parity + adversarial batteries (SPEC-5/6/7)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 24-05-PLAN.md — docs/guide/security.md trust asset + full mandatory emitter-change gate battery (SPEC-6/8)

### Phase 25: React CSS emit — drop redundant CSS-Modules routing + resolve demo drift

**Goal:** React is the ONLY target that routes a component's scoped `<style>` through a sibling `.module.css` (CSS Modules); the other five scope natively. That routing is *redundant* — Rozie's real isolation is the `[data-rozie-s-HASH]` attribute selector `scopeCss` appends to every rule (the `.module.css` extension exists only to trigger Vite's lenient class-hashing). It is also the root of TWO problems: (a) the Next.js/webpack css-loader **pure-selector build break** — `button[data-rozie-s-…]` is an "impure" CSS-Modules selector, so `nextjs-rozie` fails to build from the canonical Counter (surfaced by quick task `260603-ewy`); and (b) the React class-name-hashing gotcha (`project_react_classhash_breaks_selectors`) that forces `$classSelector` and external-test-locator workarounds. Make React emit plain attribute-scoped `.css` so attribute scoping is the sole isolation layer — fixing Next, retiring the hash gotcha, and unifying React with the other targets. Then resolve, in ONE rebless pass, the canonical-wins drift the demo-dedup exposed.

1. **React emitter de-CSS-Modules** — emit plain attribute-scoped `.css` (not `.module.css`); rewrite the `className` emission path from `styles.x` / `styles[\`…${expr}…\`]` lookups to plain string classes; lower `$classSelector('x')` to a static `"." + "x"` (no `styles` object); remove the `.rozie.module.css` virtual id + routing in `packages/unplugin/src/transform.ts` and the `.module.css` sidecar write in `packages/babel-plugin/src/writeSibling.ts`. Preserve the `.global.css` `:root` escape hatch and the portal/`:deep()` CSS-scoping behavior. (Anchors: `packages/targets/react/src/{emitReact.ts,emit/emitStyle.ts,emit/scopeCss.ts,rewrite/lowerClassSelectorCall.ts}`.)

2. **Cross-target gate rebless (emitter change)** — React fixture snapshots (`*.module.css.snap`→`*.css.snap`, `*.tsx.snap`, jsx-skeleton ~30–40 files), `emitTemplate` className assertions, dist-parity corpus, `match-*` cross-target emit, and the VR matrix.

3. **Resolve demo-dedup drift (canonical-wins)** — rebless the snapshot/VR/e2e baselines for the DIFF components the `260603-ewy` SUMMARY catalogued (Dropdown, TodoList, TreeNode, Counter, Modal, SearchInput); `nextjs-rozie` builds **green honestly** off the emitter fix (NOT a `next.config` css-loader workaround — explicitly rejected as masking). Decide the astro `Counter` `console.log` SSR-log item (strip from canonical vs keep).

4. **Docs/memory follow-through** — retire/annotate the React class-hash gotcha (`$classSelector` now a convenience not a necessity; the Astro structural-locator comment becomes historical), and update any guide pages that describe React CSS-Modules class hashing.

**Depends on:** Phase 24 + quick task `260603-ewy` (demo-dedup mechanism, complete — single source of truth, turbo declared-outputs proven, 7/8 demos green; nextjs red is THIS phase's to close).
**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 25-01-PLAN.md — React emitter de-CSS-Modules: className → plain strings, `$classSelector` → static `".x"`, scoped sibling `.module.css`→`.css`, drop `.rozie.module.css` virtual routing + babel sidecar ext + obsolete ROZ968 guard (SCOPE-1)

**Wave 2** *(depends on 25-01)*

- [x] 25-02-PLAN.md — Cross-target emitter-change rebless: target-react fixtures + dist-parity bootstrap + match-* + react-typecheck shim; full cold gate battery green (SCOPE-2)
- [x] 25-03-PLAN.md — @rozie-ui React leaf regen (idempotent codegen: sortable-list + flatpickr) + canonical-wins demo VR/e2e rebless (Linux Docker) + nextjs honest-green (empty next.config diff) + astro console.log KEPT (SCOPE-3)

**Wave 3** *(depends on 25-01/02/03)*

- [x] 25-04-PLAN.md — Retire React class-hash gotcha in docs + source doc-comments; flag `project_react_classhash_breaks_selectors` memory anchor RETIRED (SCOPE-4)

### Phase 26: Portable template interpolation — safe non-primitive {{ }} rendering + bare $props/$data rejection

**Goal:** Rozie emits `{{ }}` text interpolation *raw* per target, so a non-primitive value (array/object) renders six different ways: Vue pretty-prints JSON (native `toDisplayString`), Svelte/Angular show comma-joined `[object Object]`, Solid/Lit space-joined `[object Object]`, and **React throws "Objects are not valid as a React child" — crashing the component**. Separately, a **bare** `$props`/`$data` sigil (the whole-object form, not `$props.x`) leaks the literal identifier into emitted output because the sigil rewrite only matches `MemberExpression` (`$props.`/`$data.`): it compiles on all targets but fails inconsistently (Vue renders, Angular empty, React/Solid/Lit runtime "not defined", Svelte hard build-errors on the reserved `$`-name). Close both gaps. (1) **Embrace + gated auto-wrap:** inject an internal per-target `rozieDisplay` helper (Vue `toDisplayString` semantics: string→as-is, null/undefined→'', Array|plain Object→`JSON.stringify(_,null,2)`, else `String`) so `{{ $data.columns }}` renders identical portable JSON on all six targets and React stops crashing — wrapping ONLY non-provably-primitive interpolations (declared `String`/`Number`/`Boolean` props, concatenations, `.length`, etc. stay raw, zero overhead); Vue stays raw (native `toDisplayString` already matches); Angular hoists `rozieDisplay` as a component method (its `json` pipe quotes strings, so it won't do). NO author-facing sigil (`$display()` unnecessary, out of scope). (2) **Reject bare `$props`/`$data`:** a new uniform ROZ diagnostic on a bare sigil identifier in any template/script expression, hint = reference a specific member (e.g. `{{ $data.columns }}`, which now renders as JSON automatically); whole-object portable rendering documented as post-v1 (synthesis lift).

**Boundaries:** IN — non-primitive `{{ }}` auto-wrap + gating + the `rozieDisplay` helper across all 6 targets; bare-sigil rejection diagnostic; cross-target fixtures/VR. OUT — author-facing `$display()`/`$dump()` sigils (cut, redundant with auto-wrap); whole-object bare-sigil *support* (post-v1 synthesis); the `r-html`/raw-HTML path; attribute-binding (`:x`) interpolation beyond text nodes unless trivially shared.

**Requirements**: SPEC-1..SPEC-5 (26-SPEC.md numbered list); CONTEXT additions D-04/05 ($refs/$slots), D-06/07 (gating), D-11..D-15 (safeInterpolation opt-out)
**Depends on:** Phase 25 (React de-CSS-Modules; established the per-target emit rebless machinery)
**Plans:** 7/7 plans complete

Plans:
**Wave 1**

- [x] 26-01-PLAN.md — rozieDisplay helper (4 non-Vue runtime pkgs) + algorithm unit tests (SPEC-2)
- [x] 26-02-PLAN.md — ROZ978 bare-sigil validator + compile-error fixtures (SPEC-5, D-04/05/10/14)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 26-03-PLAN.md — wrapForDisplay IR annotation + annotateDisplayWrap gate + LowerOptions.safeInterpolation + ObjectInterp fixture (SPEC-1/3/4, D-06/07/08)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 26-04-PLAN.md — React/Solid/Svelte/Lit interpolation wrap (text/attr/class) + runtime import collectors (SPEC-1/4)
- [x] 26-05-PLAN.md — Angular inlined __rozieDisplay fn + delegating class method + template wrap, no runtime pkg (SPEC-1/4, D-01/02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 26-06-PLAN.md — safeInterpolation threading (compile/unplugin/CLI) + safe-interpolation envelope attr + opt-out byte-identity test (D-11..D-15)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 26-07-PLAN.md — [BLOCKING] dist-parity registration + cold-gate rebless + react e2e (no React crash); VR skipped (D-08/09)

**Cross-cutting constraints:**

- A wrapForDisplay=false interpolation emits raw (byte-identical to pre-phase)

### Phase 27: `@rozie-ui/fullcalendar` — calendar/scheduler component package family (portal-slot engine wrapper)

**Goal:** Ship `@rozie-ui/fullcalendar-{react,vue,svelte,angular,solid,lit}` — six pre-compiled per-framework npm packages generated from one moved `FullCalendar.rozie` (portal-slot wrapper over the vanilla `@fullcalendar/core` engine) with an expanded 12-prop/6-event surface, a rich 8-verb `$expose` handle, and the full primetime publish standard.
**Requirements**: REQ-27-1, REQ-27-2, REQ-27-3, REQ-27-4, REQ-27-5, REQ-27-6, REQ-27-7, REQ-27-8, REQ-27-9 (SPEC-internal; see 27-SPEC.md)
**Depends on:** Phase 26
**Plans:** 4/4 plans complete

Plans:

**Wave 1**

- [x] 27-01-PLAN.md — Meta-package scaffold + source move + 12/6 surface expansion + 8-verb `$expose` (REQ-27-1/3/4/5)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 27-02-PLAN.md — Six primetime leaf packages + codegen/readme/manifests + run codegen (REQ-27-2/6)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 27-03-PLAN.md — Guide page + sidebar + ENFORCING props-table validation + 4 dev-surface repoints incl. Angular cross-tree trap (REQ-27-6/7)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 27-04-PLAN.md — Behavioral demo + behavioral spec + VR 6/6 + full CI-equivalent gate battery (REQ-27-8/9)

### Phase 28: `@rozie-ui/fullcalendar` parity expansion — full hook/slot coverage (passthrough + portal-slot fan-out)

**Goal:** Bring `@rozie-ui/fullcalendar`'s author-side surface to parity with the official FullCalendar connectors' *coverage* (while keeping Rozie's uniform-across-six-targets contract): add 5 high-demand typed first-class events, a single `:options` passthrough prop that forwards arbitrary FullCalendar options/callbacks into the engine, and the full `*Content` portal-slot set — verified with a tiered strategy (VR baselines for the 3 high-demand slots, one cross-target "fill every slot" behavioral DOM spec for the long tail).
**Requirements**: REQ-28-1, REQ-28-2, REQ-28-3, REQ-28-4, REQ-28-5, REQ-28-6 (SPEC-internal; see 28-SPEC.md)
**Depends on:** Phase 27
**Plans:** 4/4 plans executed — PHASE COMPLETE

Plans:

**Wave 1**

- [x] 28-01-PLAN.md — Source additions to FullCalendar.rozie: 5 typed events + `:options` passthrough (spread-first, explicit-props-win) + 6 new `*Content` portal-slots (7 total) + event-manifest lockstep (REQ-28-1/2/3)

**Wave 2** *(blocked on Wave 1)*

- [x] 28-02-PLAN.md — Regen 6 leaves via codegen.mjs + update guide Props/Emits/Slots tables + comparison page; ENFORCING props-table at 13 rows (REQ-28-5)

**Wave 3** *(blocked on Wave 2)*

- [x] 28-03-PLAN.md — Tiered verification: date-PINNED 3-slot screenshot demo (in matrix) + 7-slot behavioral demo + cross-target DOM spec (timeGridWeek + overflowing dayGridMonth) (REQ-28-4)

**Wave 4** *(blocked on Wave 3)*

- [x] 28-04-PLAN.md — [BLOCKING] cold-cache gate battery + Linux FullCalendarSlots.png baseline + conditional dist-parity rebless + orchestrator-level re-validation (REQ-28-6); date-stability catch+fix (pinned FullCalendar `now`) at the human-verify gate; ZERO rebless; build 58/58, typecheck 77/77, test 60/60, dist-parity 683/683, leaves 19/19, docs 92/0, VR 6/6, behavioral 18/18 — orchestrator-re-validated GREEN (REQ-28-6 + REQ-28-4 VR tier)

### Phase 29: `@rozie-ui/codemirror` — code-editor component package family (CodeMirror 6 engine wrapper)

**Goal:** Ship `@rozie-ui/codemirror-{react,vue,svelte,angular,solid,lit}` — six pre-compiled per-framework npm packages generated from one `CodeMirror.rozie` wrapper over the vanilla `@codemirror/*` engine — at the primetime publish standard. Surface: a two-way `value` contract (CM6 dispatches transactions, not naive sets → flatpickr-lineage suppress-echo guard, already validated); a consumer-extensible `:options.extensions` passthrough (the engine *is* an `Extension[]` array → mirrors Phase 28's merged `:options.plugins`, zero bundle cost); portal slots mapped onto CM6's DOM-injection surfaces (panels / tooltips / gutter markers / widget decorations); managed runtime reconcile (`$watch` → `dispatch` reconfigure effects); and a `$expose` handle over the `EditorView`. Engine-wrapper packaging port (NOT a compiler phase — CM6 cross-target reactivity uses already-shipped primitives). Follows the `@rozie-ui` packaging-port flow (Phases 20/27/28) and the LOCKED distribution model (colocated helpers, `codegen.mjs` doc-automation, per-leaf primetime metadata). Exact prop/event/`$expose` surface size and which injection surfaces become portal slots are gray areas to be locked in discuss/spec.
**Requirements**: TBD (to be derived in spec/discuss)
**Depends on:** Phase 28
**Plans:** 4/4 plans complete

Plans:

- [x] 29-01 — meta-package scaffold + source move + 7/0/8/1-panel surface expansion (D-01..D-06, D-08) + 6 dev-surface repoints (commits 5bedb20e, ae043a1e, 0cc23908)
- [x] 29-02+ — codegen 6 leaves + guide + tiered VR/behavioral coverage (run /gsd-plan-phase 29 for the full breakdown)

### Phase 30: `@rozie-ui/chartjs` — Chart.js data-visualization component package family (canvas engine wrapper)

**Goal:** Ship `@rozie-ui/chartjs-{react,vue,svelte,angular,solid,lit}` — six pre-compiled per-framework npm packages generated from one `Chart.rozie` wrapper over the vanilla `chart.js` engine — at the primetime publish standard. The existing VR-proven `examples/LineChart.rozie` (5 props, canvas-based) moves into `packages/ui/chartjs/src/Chart.rozie`, is renamed from line-specific to a **generic `Chart`** (the engine `Chart.register(...registerables)` already registers every controller, so the `type` prop genuinely switches chart kind across the full Chart.js set — `line`/`bar`/`pie`/`doughnut`/`radar`/`polarArea`/`scatter`/`bubble`), and the surface is expanded feature-rich: data/options/type/height/width/plugins/updateMode/redraw/ariaLabel props (the `:plugins` array is the consumer-extensibility passthrough, the Chart.js analog of CM6's `:extensions` and FullCalendar's merged `:options.plugins`); `@click`/`@hover`/`@datasetClick` events composed onto `options.onClick`/`onHover` without clobbering consumer handlers (Chart.js IS event-ful — unlike CM6's deliberate zero); an ~8-verb `$expose` handle over the live instance (`getChart`/`updateChart`/`resizeChart`/`resetChart`/`renderChart`/`stopChart`/`clearChart`/**`toBase64Image`** — the marquee PNG export); and ONE external-HTML-`tooltip` portal slot (canvas owns its own paint, so the external-tooltip handler is the single real slot showcase). Keeps the `$snapshot($props.data)` Svelte-proxy discipline and `$refs`-only-in-`$onMount` verbatim. Canvas VR is made deterministic (animation off, devicePixelRatio 1, fixed font, fixed data, multi-type baseline). Engine-wrapper packaging port (NOT a compiler phase — Chart.js cross-target reactivity uses already-shipped primitives). Follows the `@rozie-ui` packaging-port flow (Phases 20/27/28/29) and the LOCKED distribution model (colocated helpers, `codegen.mjs` doc-automation, per-leaf primetime metadata).
**Requirements**: TBD (derived in 30-SPEC.md)
**Depends on:** Phase 29
**Plans:** 4/4 waves complete — VERIFIED (ACHIEVED 8.5/10) 2026-06-05. Commits `00676690..b063958d` (9), UNPUSHED.

Plans:

- [x] 30-01 — meta-package scaffold + `examples/LineChart.rozie` → `src/Chart.rozie` move + 9/3/8/1 surface + dev-surface repoints (00676690, 87af8b61, 47b6b58d)
- [x] 30-02 — codegen + 6 primetime leaves (chart.js peerDep) + READMEs/LICENSEs (Events ships); + `canvas`→`HTMLCanvasElement` emitter fix (zero drift) + Chart.rozie leaf-typecheck corrections (fdab9ae0, 801010c6, d5c61238)
- [x] 30-03 — `docs/guide/chartjs.md` (codegen-ENFORCED Props table) + sidebar group (64932df6)
- [x] 30-04 — behavioral spec ×6 (green) + deterministic multi-type screenshot demo + VR registration + full cold gate battery (a5bbecea, b063958d). Canvas pixel baseline DEFERRED (owner-flagged pre-existing on-load render discrepancy; cell test.fixme-gated; behavioral coverage stands).

### Phase 31: `@rozie-ui/chartjs` — gap closure & ergonomics parity

**Goal:** Close the five competitor-parity gaps the `chartjs-comparison.md` research conceded — per-type components, tree-shakable registration, `datasetIdKey`, a11y `fallback`, `destroyDelay` — with NO emitter touch (codegen/source/config only → dist-parity byte-stable). Dan approved A (per-type components) + B (the `/auto` registration split) 2026-06-06. VERIFIED ACHIEVED 2026-06-06. Commits `50edc1f9..a71ede6e` (3), UNPUSHED.
**Depends on:** Phase 30

Plans:

- [x] 31-01 — G3 datasetIdKey (keyed dataset reconcile) + G4 fallback a11y slot + G5 destroyDelay (50edc1f9). Surface 11 props / 3 emits / 8 expose / 2 slots.
- [x] 31-02 — G1/B tree-shakable registration: generic Chart drops `register(...registerables)`; demos register; consumer-registers model (18f9be41).
- [x] 31-03 — A/G2 8 per-type components (Line…Bubble) via codegen-transformed full-source variants (full surface, zero forwarding ceremony) + per-leaf `/auto` entry + barrels; guide + comparison-doc cells flipped. Gates green; dist-parity 683/683 byte-stable.
- [~] 31-04 — canvas-VR baseline (G0) STILL FLAGGED: best-effort regen confirmed the hardened poll is insufficient (fooled by legend swatches; line/bar plot-area genuinely doesn't first-paint — cartesian responsive two-pass). No baseline blessed; cell test.fixme-gated; behavioral chart.spec.ts ×6 green. Root-cause fix left for owner-paired session.

### Phase 32: `@rozie-ui/tiptap` — rich-text-editor component package family (TipTap / ProseMirror engine wrapper)

**Goal:** Ship `@rozie-ui/tiptap-{react,vue,svelte,angular,solid,lit}` — six pre-compiled per-framework npm packages generated from one `TipTap.rozie` wrapper over the vanilla `@tiptap/core` + `@tiptap/starter-kit` (ProseMirror) engine — at the primetime publish standard. The existing VR-proven `examples/TipTap.rozie` (4 props, internal toolbar) moves into `packages/ui/tiptap/src/TipTap.rozie` and expands feature-rich: **8 props** (html[model], editable, placeholder, autofocus, editorClass, ariaLabel, editorProps, extensions — the `editorProps`/`extensions` passthroughs are the consumer-extensibility wedge), **4 events** (update/selectionUpdate/focus/blur), a command-rich **~13-verb `$expose` handle** (getEditor/focus/blur/getHTML/getJSON/**setContent** [not setHtml — ROZ524]/clearContent/toggleBold/toggleItalic/toggleHeading/undo/redo/chain), and **1 `toolbar` portal slot** (consumer-rendered toolbar receiving the live editor; internal batteries-included toolbar when unfilled). Node-view portal slots DEFERRED to Phase 33 (the 3-strikes-risk primitive — ship editor+toolbar, document the design). Keeps the CM6-lineage suppress-echo guard on the two-way `html` path + `$refs`-only-in-`$onMount`. Then the second deliverable: `tiptap-comparison.md` competitor matrix + Phase 33 gap-closure plan. Engine-wrapper packaging port (NOT a compiler phase — uses already-shipped primitives). Follows the `@rozie-ui` packaging-port flow (Phases 20/27/28/29/30/31) and the LOCKED distribution model. Autonomous overnight run 2026-06-06.
**Requirements**: REQ-32-1..9 (see 32-SPEC.md)
**Depends on:** Phase 31
**Plans:** 5/5 waves — VERIFIED (ACHIEVED 9/10) 2026-06-06. Commits `cf01237d..fbd4dae8` (5), UNPUSHED. Surface 8 props / 4 emits / 14 expose / 1 toolbar portal slot. Node-view slots DEFERRED to Phase 33 (documented). dist-parity 683/683 byte-stable (ZERO emitter touch).

Plans:

- [x] 32-01 — move `examples/TipTap.rozie` → `packages/ui/tiptap/src/TipTap.rozie` + feature-rich expand (8/4/14/1-toolbar) + meta package + minimal repoint. ROZ121 caught focus/blur event⇄verb → focusEditor/blurEditor; inherit-attrs/listeners=false (multi-root). (cf01237d)
- [x] 32-02 — codegen + readme + handle-manifest (CM6 single-component lineage, Events ships) + 6 primetime leaves (@tiptap/core + starter-kit peers; per-leaf @rozie/runtime-* derived; angular peers @angular/forms). Build/typecheck 6/6 (Lit dts clean). (94498328)
- [x] 32-03 — `docs/guide/tiptap.md` (codegen-ENFORCED 8-row Props table) + `tiptap-comparison.md` (folded forward) + sidebar + remaining dev-surface repoints. Docs 112 links/0 broken. (6a690343)
- [x] 32-04 — VR TipTapBehavior + TipTapScreenshot demos + behavioral `tiptap.spec.ts` ×6 + cold gate battery (build 79/79, typecheck 98/98, test 63/63, dist-parity 683/683). Repointed 4 typecheck suites + 2 regression tests (expanded emit strict-clean). (86ce1355)
- [x] 32-05 — 32-VERIFICATION.md (goal-backward ACHIEVED 9/10) + Phase 33 gap-closure proposal (in comparison doc) + Linux TipTapScreenshot.png baseline regen.

### Phase 33: Reactive portal slots (+ TipTap node-view slots as the proving showcase)

**Goal:** Evolve Rozie's mount-once portal-slot primitive (`$portals.X(container, scope) => disposeFn`, Spike 003, REQ-5-frozen-as-non-reactive) into an **opt-in reactive variant** — `<slot name="X" portal reactive />` whose closure method returns `{ update(scope), dispose() }` and **re-renders the consumer fragment IN PLACE when the engine calls `update(newScope)`, without re-mounting** — across all six targets (real `emitPortals.ts` surgery: React retain-root+flushSync · Vue re-render(vnode,container) · Lit re-render(tpl,container) · Solid scope-as-signal+setScope · Angular Object.assign(view.context)+detectChanges · Svelte a NEW `@rozie/runtime-svelte/PortalHostReactive.svelte` owning `$state`+`update` export). Engine-driven driver (ProseMirror `nodeView.update`/`selectNode`/`deselectNode` → `update(scope)`; no Rozie reactive loop). Then **dogfood it by shipping TipTap node-view portal slots** in `packages/ui/tiptap/src/TipTap.rozie` (the Phase-32 deferral): a reactive **non-editable `@mention` chip** (reads `node.attrs`+`selected`) AND an **editable `contentDOM` node** (chrome wrapping a ProseMirror-managed editable hole; graft splits the 6 by ref-timing — native-`ref` for React/Solid/Lit, query-after-render for Vue/Svelte/Angular per REQ-23). **This IS a compiler phase** — every emitter edit drifts dist-parity + the target-* snapshot suites + the core match-* snapshots; the full `--force` rebless recipe applies, UNLIKE the byte-stable @rozie-ui packaging ports. The 3 shipped mount-once slots (CM6 `panel`, Chart `tooltip`, TipTap `toolbar`) stay byte-identical — reactive is a NEW opt-in branch (REQ-22).
**Requirements**: REQ-19..26 (spike-derived; see `.planning/spikes/MANIFEST.md` + the 007/008/009 READMEs). Feasibility VALIDATED 2026-06-06 via Spikes 007 (reactive primitive — Svelte runtime-proven + all-6 compile), 008 (contentDOM editable hole — Lit+Solid runtime-proven), 009 (reactive @mention in real TipTap — 5/6 runtime + Angular prior-art). Phase-specific REQs to be finalized in 33-SPEC.md / plan.
**Depends on:** Phase 32
**Plans:** 5/5 plans complete — VERIFIED (goal ACHIEVED, high confidence) 2026-06-06. Reactive portal-slot primitive shipped + dogfooded into TipTap node-view slots; TRUE 6/6 pixel + behavioral parity (Angular live-browser-proven REQ-25, Solid working REQ-26). 16 commits `ecc03c97..415467bc`, UNPUSHED. Proving phase surfaced + fixed 3 broader compiler bugs (Solid `:class` precedence, Angular NgClass/NgStyle import latent in 13 files, Svelte inter-element whitespace collapse). REQ-19..26 all satisfied. dist-parity 683/683, full VR matrix 0 failed, cold battery 194/194. 33-VERIFICATION.md.

Plans:

- [x] 33-01-PLAN.md — Wave 1: SlotDecl.isReactive IR flag + `reactive` parser branch + @rozie/runtime-svelte/PortalHostReactive.svelte (REQ-19, REQ-22; no emitter touch)
- [x] 33-02-PLAN.md — Wave 1: the {update,dispose} reactive branch in all 6 emitPortals.ts (opt-in only) + 6 emitPortals.test.ts + [BLOCKING] zero-drift rebless of the 3 shipped slots + cold gate battery (REQ-19/20/21/22) — DONE 2026-06-06: 2 commits (42354f1e 33-01 runtime, d0d50a85 33-02 reactive branch + 6 test suites), UNPUSHED. buildReactiveSlotMethod gated on slot.isReactive in all 6 emitters; non-reactive mount-once shape byte-identical (REQ-22). 2 Rule-3 deviations (per-target REACTIVE_HANDLE_INTERFACE_<TARGET> to dodge core-inline redeclaration; tests live in src/__tests__/ not src/emit/). ORCHESTRATOR-RE-VALIDATED cold battery 194/194 GREEN (build 79/79, typecheck 98/98, test 63/63), dist-parity 683/683 + ZERO-drift rebless (3 shipped slots byte-stable), zero snapshot writes. Self-check PASSED. 33-02-SUMMARY.md.
- [x] 33-03-PLAN.md — Wave 2: reactive `nodeView` portal slot + atom @mention chip + editable contentDOM node (ref-timing graft split) in TipTap.rozie + regen 6 leaves via codegen (REQ-23, REQ-26) — DONE 2026-06-06: 3 commits (e6183587 TipTap.rozie reactive nodeView slot + rozieMention atom + rozieCallout contentDOM node + addNodeView→handle.update/dispose + compile-tiptap-check.cjs gate; 173ea62b Rule-3 fix; 32166b67 regen 6 leaves), UNPUSHED. The FIRST shipped reactive portal slot, dogfooded in real TipTap. 6/6 leaves build+typecheck GREEN, codegen idempotent, no sidecars, svelte imports both PortalHost+PortalHostReactive. 1 Rule-3 deviation: reactive renderScope/update param typed `unknown` (33-02) fails strict-tsc on react+lit (first typed-param reactive portal) → typed as scopeType. target-react 357/357, target-lit 313/313, core 1397/1397, dist-parity 683/683. Self-check PASSED. 33-03-SUMMARY.md. NEXT: 33-04 (verification wave — owns the nodeView cross-target dist/snapshot/VR rebless).
- [x] 33-04-PLAN.md — Wave 3: behavioral re-render VR spec ×6 + composition smoke + Angular-first live-browser verify + caret-neutralized Linux baseline + [BLOCKING] whole-repo nodeView rebless + cold gate battery (REQ-24, REQ-25, REQ-26) — DONE 2026-06-06, TRUE 6/6 pixel + behavioral parity. SEVEN commits UNPUSHED on top of 33-03 (32166b67): `b36cffbc` (atom renderHTML leaf-hole + contentDOM graft bridge REQ-23/24), `47ad8826` (reactive nodeView VR cells + behavioral spec ×6 + composition smoke + native-markup/no-r-if/no-literal-@ Angular-AOT constraint), `47a50b52` (bless Linux TipTapNodeViewScreenshot.png) + four follow-on emitter fixes: `b646bdfe` Solid reactive node-view re-renders in place via scope ACCESSOR (foreign-slot accessor limitation closed → REQ-26 6/6, un-fixme'd Solid cells), `c43df21f` Solid multi-source `:class` precedence paren-wrap, `1867e943` Angular NgClass/NgStyle import (the screenshot-divergence TRUE ROOT CAUSE — `[ngClass]` inert without the directive import; NOT the originally-hypothesized structural portal-CSS rewrite; latent in 13 emitted Angular files), `7586ba44` Svelte inter-element whitespace collapse (~50px reflow). Angular+Svelte converged to the EXISTING baseline (no rebless). ALL 6 targets now pixel- AND behavior-identical; Angular live-browser-proven (REQ-25), Solid working (REQ-26). 7 auto-fixed deviations (5 Rule-1 bugs, 1 Rule-2 missing-critical contentDOM bridge, 1 Rule-3 blocking-constraint), ZERO outstanding deferrals/human-decisions. Orchestrator-verified cold battery 194/194 (build 79/79, typecheck 98/98, test 63/63, dist-parity 683/683 zero-drift), VR node-view 12/12 behavioral + 6/6 screenshot, full VR matrix 0 failed, tree clean. Self-check PASSED. 33-04-SUMMARY.md.
- [x] 33-05-PLAN.md — Wave 4: flip tiptap-comparison.md node-view matrix cell + document the nodeView slot in tiptap.md + restore ENFORCING props-table validation + memory-refresh note (REQ-23/24/25/26)

Anticipated wave skeleton (from the kickoff brief + spike findings):

- Wave 1 — the reactive primitive: IR (`SlotDecl.isReactive` / parser `reactive` flag), the `{update,dispose}` return-shape across all 6 `emitPortals.ts` (opt-in branch only), `@rozie/runtime-svelte/PortalHostReactive.svelte` (REQ-19), Solid `equals:false` (REQ-20), Angular context-mutate+detectChanges (REQ-21). Core portal-slot tests + the 6 target snapshot suites + dist-parity rebless (full `--force` recipe).
- Wave 2 — TipTap node-view slots in `TipTap.rozie`: the `nodeView` reactive portal slot + the contentDOM editable-hole bridge (graft split per REQ-23), wired onto `addNodeView`. Regen 6 leaves via codegen.
- Wave 3 — verification: behavioral spec proving the node view re-renders on a transaction across all 6 (Angular = FIRST-CLASS runtime-verification target, REQ-25) + reactive-chrome-around-editable-hole composition smoke (REQ-24) + content-stable screenshot; cold gate battery + rebless inspection.
- Wave 4 — docs: `tiptap-comparison.md` matrix flip (node-view ✓), guide update, memory refresh (`project_portal_slots_spike`, `project_next_port_tiptap`).

### Phase 34: CSS engine-DOM escape hatch — style runtime engine-rendered DOM (ProseMirror/CodeMirror) from a component <style> block across all 6 targets including Lit shadow DOM

**Goal:** Give a component `<style>` block a working, all-6-target way to style **engine-rendered runtime DOM** — nodes the wrapped vanilla engine creates at runtime (ProseMirror's `.is-editor-empty`/`p`, CodeMirror's `.cm-*`, etc.) that never carry Rozie's `[data-rozie-s-*]` scope attribute, so every scoped compound silently fails to match them. Today there is **no clean cross-target mechanism**, which is why FullCalendar deliberately punts engine-`.fc-*` styling to the engine's own stylesheet and CodeMirror's `:global(.cm-*)` rules are dead on the plain-CSS targets. This is a reusable compiler capability that unblocks every engine-wrapper port (immediate consumer: TipTap G3 placeholder ghost-text; also retro-fixes CodeMirror's dead `:global` cm-* rules).

**Discovered:** 2026-06-06 while closing TipTap G3 (bundled Placeholder). Behavior wiring (Placeholder ext → `placeholder` prop) works and is target-agnostic; only the `::before` ghost-text CSS is blocked on this hatch.

**Problem evidence (empirically verified across all 6 leaves):**

- Rozie scopes every compound with `[data-rozie-s-HASH]`; runtime engine nodes lack it → scoped rules never match.
- `:root { .sel {} }` (nested selector) **double-collects**: postcss `walkRules` visits the inner rule too → it gets scoped (a dead copy) AND **React drops the unscoped global entirely** (no `.global.css` emitted). `:root` only cleanly handles FLAT custom-property declarations.
- `:global()` (CodeMirror.rozie's choice) is **dead** on React/Solid/Lit — ships verbatim into plain CSS, browser drops the rule (`scopeCss.ts:42-57`).

**Key design complication — Lit shadow DOM (the load-bearing part):** `rootRules` emit via `injectGlobalStyles()` into the **document head**. That is correct for `:root { --custom-prop }` (custom properties inherit *through* the shadow boundary) but **wrong for a selector rule** — a document-head rule cannot pierce Lit's shadow root to reach the editor mounted inside it. The real need is "unscoped, but in the component's **own** style scope (shadow `static styles` for Lit)", NOT document-global.

**Open design decisions (for spec/discuss):**

1. **Mechanism / semantic:** document-global (`:root`-family) vs. component-own-scope-unscoped (closer to `:deep`'s bare-unwrap-into-own-sheet — which is what Lit shadow content actually needs). Pick the author-facing syntax (a fixed `:root`-nesting, a new at-rule, or a `:deep`-like pseudo) and its per-target lowering.
2. **Flatten vs. native-nesting** for the emitted unscoped rule.

**Likely scope:**

1. **parseStyle** — stop double-collecting nested-`:root` (or new-mechanism) rules; mirror the existing `hasPortalAncestor` skip gate → `hasRootAncestor` (`parseStyle.ts:322-362`).
2. The chosen escape mechanism's IR lowering (`lowerStyles` buckets: `scopedRules`/`rootRules`/`portalRules` → possibly a new `engineRules` bucket).
3. **Lit emitStyle** — route engine-DOM escape rules into shadow `static styles` **unscoped**, not `injectGlobalStyles`.
4. Verify Svelte's `:global()` wrap and Angular's `::ng-deep` don't mangle a flat unscoped rule; confirm React `.global.css` / Solid runtime-inject / Vue paths.
5. **This IS a compiler phase** — full `--force` rebless: dist-parity + the 6 target snapshot suites + core `match-*` snapshots + the 6 typecheck gates. Existing `:root` usage is declaration-only (Modal `--rozie-modal-z`) so regression surface is low; add focused new fixtures/tests for the new behavior.

**Requirements**: D-01..D-08 (CONTEXT.md locked decisions — no formal REQUIREMENTS.md IDs for this phase)
**Depends on:** Phase 33
**Plans:** 3/3 plans complete

**Follow-on (separate phase, depends on 34):** TipTap gap closure — **G3** (bundle `@tiptap/extensions` Placeholder wired to the `placeholder` prop; behavior already prototyped/works, ghost-text CSS rides this hatch) + **G2** (bubble/floating menu portal slots over `@tiptap/extension-bubble-menu` / `-floating-menu`, mount-once portal pattern like the shipped `toolbar` slot). G4 (JSON `format` two-way) has a typed-model design wrinkle — defer/discuss separately.

Plans:

- [x] 34-01-PLAN.md — Wave 1: parse/lower core — hasRootAncestor skip-gate + engineRules bucket (D-02/D-05) + ROZ128 :global() hard-error (D-08) + parseStyle/lowerStyles unit tests
- [x] 34-02-PLAN.md — Wave 2: 6 emitStyle changes — engineRules unscoped-bare on 5 light-DOM targets + Lit dual-sink static-styles+injectGlobalStyles (D-04/D-06/D-03) + new EngineDomEscape dist-parity fixture + target/core snapshot rebless
- [x] 34-03-PLAN.md — Wave 3: CodeMirror :global→:root migration (D-07) + 6-leaf regen + [BLOCKING] cold --force rebless battery + D-03 Modal byte-identity canary + CodeMirror VR-rebless (Linux-Docker human gate)

### Phase 35: rozie-ui-maplibre — @rozie-ui/maplibre cross-framework MapLibre GL JS engine-wrapper port ✅ COMPLETE 2026-06-07 (10/10, UNPUSHED fb73eb86..2c57e0b5)

**Goal:** Ship `@rozie-ui/maplibre-{react,vue,svelte,angular,solid,lit}` — one `MapLibre.rozie` source compiled to 6 idiomatic, installable leaves — filling the "maps" category of the 999.1 killer-component seed slate. The wedge: React/Vue/Svelte/Angular have deep wrappers (react-map-gl 8.1.1, @indoorequal/vue-maplibre-gl 8.4.2, svelte-maplibre-gl 2.0.1, @maplibre/ngx-maplibre-gl 21.0.2) but **Solid is stale/Mapbox-first and Lit is effectively absent** — Solid+Lit get a category-leading wrapper for free from the same source. Follows the SortableList→Flatpickr→FullCalendar→CodeMirror→Chart.js→TipTap port lineage and the LOCKED `project_rozie_ui_distribution_model` template (per-framework pre-compiled packages, colocated helpers, `scripts/codegen.mjs` doc-automation, primetime leaf standard).

**Requirements**: TBD (derive in spec)
**Depends on:** Phase 34

**LOCKED v1 surface (Dan-approved, design session 2026-06-07):**

- **Scope:** FULL PARITY FLOOR.
- **Props (~16):** `style`, `center`[model:true], `zoom`[model:true], `bearing`[model:true], `pitch`[model:true] (ALL FOUR camera props two-way with a shared suppress-echo guard — the `LeafletMap` moveend pattern extended to 4 scalars), `minZoom`, `maxZoom`, `maxBounds`, `bounds`+`fitBoundsOptions`, interaction toggles (`dragPan`/`dragRotate`/`scrollZoom`/`doubleClickZoom`/`boxZoom`/`keyboard`/`touchZoomRotate`/`touchPitch`), `:sources`, `:layers`, `:interactiveLayerIds`, `:controls`, `:options` passthrough.
- **Layers:** CONFIG-PROP `:sources`/`:layers` passthrough — prop-driven `addSource`/`addLayer`/`setData`/`removeLayer` reconcile via `$watch` (the proven `LeafletMap :markers` pattern). NOT declarative `<Source>/<Layer>` children — those require the deferred provide/inject **EXP-02** primitive (out of v1 scope per `.planning/PROJECT.md`). `:interactiveLayerIds` gates click/hover to features.
- **Emits (~22):** `load`, `move`, `moveend`, `zoom`, `zoomend`, `rotate`, `rotateend`, `pitch`, `pitchend`, `dragstart`, `drag`, `dragend`, `click`, `dblclick`, `contextmenu`, `mousemove`, `mouseenter`, `mouseleave`, `idle`, `error`, `styledata`, `sourcedata`.
- **Slots (3):** `markers` (REACTIVE MULTI-INSTANCE portal — one handle per marker driven by a positions prop; CM gutter/decoration + TipTap nodeView template; portal consumer fragment into `new maplibregl.Marker(el).setLngLat().addTo(map)`, dispose=`.remove()`), `popups` (REACTIVE MULTI-INSTANCE portal — `new maplibregl.Popup().setDOMContent(el)`), `controls` (MOUNT-ONCE portal — custom control UI into a map control host).
- **Controls:** `:controls` config-array drives `addControl` for the 5 standard controls (Navigation/Geolocate/Scale/Fullscreen/Attribution, with position) PLUS the mount-once `controls` portal slot for custom UI.
- **$expose (8):** `getMap`, `flyTo`, `easeTo`, `jumpTo`, `fitBounds`, `getCenter`, `getZoom`, `resize`. MUST clear all 3 verb-collision gates at the live `compile()` gate BEFORE leaf work: ROZ524 (React model-setter auto-gen — center/zoom/bearing/pitch are model:true → `setCenter`/`setZoom`/`setBearing`/`setPitch` auto-generated, no $expose verb may collide), Lit reserved lifecycle (`update`/`render`/`firstUpdated`/`updated`/`willUpdate`/`requestUpdate`), ROZ121 ($expose verb == emitted event name, e.g. `move`/`zoom`/`rotate`/`pitch`).

**MapLibre-specific constraints:** `maplibre-gl ^5` peer; consumer imports `maplibre-gl/dist/maplibre-gl.css`; engine control/popup DOM styled via the Phase-34 `:root` engine-DOM escape hatch (`:root { .maplibregl-ctrl { … } }` — NOT `:global()`, that's ROZ128); map created in `$onMount` against `$refs.containerEl` (ROZ123); container needs explicit dimensions. **VR IS THE HARD PART** (WebGL canvas + async tiles — the Chart.js canvas-VR precedent): pinned/offline style-object map (no network tiles), disable animations/fade, wait for the map `idle` event before screenshot; ship a behavioral demo + a content-stable screenshot demo separately; if the canvas baseline can't bless deterministically, ship the behavioral cell and FLAG the screenshot cell as a tracked todo (Chart.js precedent).

**~12-surface repoint checklist:** engine-examples `PKG_WRAPPER_SRC` + `ENGINE_DEMOS`, VR cross-tree (vite + angular `prebuildExtraRoots`/tsconfig + build-cells sweep), the 4 framework-typecheck `PKG_SRC` maps, lit/angular `regression-destructuring-shadow` `compile()` helpers, rozie-codegen product list, playground snippet.

**Gates:** cold `--force` battery (turbo build→typecheck→test incl. dist-parity 683) AND Linux-Docker VR (`tools/ci-repro/vr.sh -g MapLibre`, `-u` to bless). No-autopush.

**Plans:** 2 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 35 to break down)

### Phase 36: Cross-component context primitive ($provide / $inject) — author-side provide/inject sigils compiling to idiomatic provide/inject across all 6 targets; unblocks compound components + declarative children

**Goal:** Authors can `$provide(key, value)` in a parent and `$inject(key)` in any descendant — reading the value reactively through unaware passthrough components with no prop-drilling — compiling to the idiomatic provide/inject mechanism of all six targets (React, Vue, Svelte, Angular, Solid, Lit). Unblocks the compound-component category.
**Requirements**: R1-R13 (see 36-SPEC.md)
**Depends on:** Phase 35
**Plans:** 9/9 plans complete

Plans:

**Wave 1**

- [x] 36-01-PLAN.md — Core: reserved sigils + IR provides/injects + lowerContext + ROZ129-132 diagnostics (Wave 0)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 36-02-PLAN.md — Vue emitContext: native provide/inject (Wave A)
- [x] 36-03-PLAN.md — Svelte emitContext: setContext/getContext at init (Wave B)
- [x] 36-04-PLAN.md — Angular emitContext: providers (not viewProviders) + inject(rozieToken) + CVA merge (Wave D)
- [x] 36-05-PLAN.md — Lit emitContext: @lit/context ContextProvider/Consumer + null-guard + peer dep (Wave E)
- [x] 36-06-PLAN.md — Runtime helpers: globalThis-backed rozieContext in runtime-react/solid (Wave F)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 36-07-PLAN.md — React + Solid emitContext: Provider-wrap + useContext (Wave C)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 36-08-PLAN.md — Example trio + Tabs showcase + VR behavioral cell + full rebless gate (Wave G)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 36-09-PLAN.md — Docs: features.md context section + ROZ129-132 diagnostics (Wave H)

### Phase 37: Declarative children dogfood — convert MapLibre :sources/:layers to <Source>/<Layer> and Rete :nodes/:connections to <FlowNode>/<Handle>/<Connection> using the Phase 36 context primitive; retire the two 'what Rozie defers' doc notes ✓ COMPLETE 2026-06-10

> **Completed 2026-06-10 (verification passed 8/8, orchestrator-confirmed VR 12/12).** MapLibre `<Source>`/`<Layer>` + Rete `<FlowNode>`/`<Handle>`/`<Connection>` declarative children ship alongside the config-array props (D-02 union-merge, last-writer-wins) across all 6 targets. The dogfood drove ONE intentional emitter change — `$portals.default` (default slot addressable as a portal, ROZ979, dist-parity zero-drift) — though FlowNode keeps the semantically-correct named `#body` portal slot (context-consuming `<Handle>` children can't live in a portal render root on 5/6 targets — tree-scoped `$inject`; portal-context bridging deferred). Behavioral VR 12/12 declarative + 12 config-array + 12 screenshot green; both docs defer-notes retired. Wave-0/VR gates caught: D-04 inline-slot unviable on Lit, 4 Wave-1 child registration bugs, a phase-introduced `never[]` strict-tsc regression. Deferred (logged): pre-existing `r-if`-default-slot compiler crash; portal-context bridging.

**Goal:** Component-library authors can author MapLibre maps with declarative `<Source>`/`<Layer>` children and Rete node-graphs with `<FlowNode>`/`<Handle>`/`<Connection>` children (alongside the existing `:sources`/`:layers` and `:nodes`/`:connections` config-array props, union-merged by id, last-writer-wins), proving the shipped Phase 36 `$provide`/`$inject` primitive in real engine wrappers, and the two "what Rozie defers" doc notes are retired.
**Requirements**: D37-01, D37-02, D37-03, D37-04, D37-05, D37-06, D37-07, D37-08 (derived from CONTEXT decisions D-01..D-08 + docs-retirement; no ROADMAP REQ-IDs assigned)
**Depends on:** Phase 36
**Plans:** 6/6 plans complete

Plans:

- [x] 37-00-PLAN.md — Wave 0 de-risk probes: A1 provider-that-also-consumes (Source) + A2 renderless child (Layer) compile 6×; A3 FlowNode D-04 body teleport renders on Lit
- [x] 37-01-PLAN.md — MapLibre track: $provide registry + Source/Layer children + applyLayers (registry ∪ props) + multi-source codegen
- [x] 37-02-PLAN.md — Rete track: $provide('rete:canvas') registry + FlowNode/Handle/Connection children (D-04 body teleport, separate provenance) + multi-source codegen
- [x] 37-03-PLAN.md — Two declarative+mixed demos + VR host wiring (EXAMPLES/LIT_TAGS) + behavioral VR matrix (6 targets, Angular real-build); D-02 union + D37-08 provenance assertions — declarative VR 12/12 green via named `#body` portal slot (37-05 kept this — bare-default-slot revert deferred)
- [x] 37-05-PLAN.md — `$portals.default` emitter feature SHIPPED (surfaced by 37-03 VR gate): default slot addressable as a portal under protected key "default" across 6 emitters + core + ROZ979 diagnostic; gated → dist-parity 827 + target-*/match-* snapshots ZERO-DRIFT (no rebless). FlowNode bare-default-slot revert DEFERRED — nested context-consuming `<Handle>` children can't live in a portal render root on 5/6 (tree-scoped context); kept the proven named-`#body` (declarative VR stays 12/12). See 37-05-SUMMARY + deferred-items.md.
- [x] 37-04-PLAN.md — Retire both docs defer-notes + flip comparison-table cells; full cross-target verification gate (certifying the single intentional $portals.default emitter change + zero OTHER emitter drift)

### Phase 38: Portal-scoped-style Lit diagnostic — compile-time warning when a scoped `<style>` rule targets portal-teleported content (won't reach the engine DOM on Lit; use `:root`)

**Goal:** A new collected compile-time **warning** (`ROZ088` `STYLE_SCOPED_RULE_TARGETS_PORTAL_CONTENT` — corrected from the proposed `ROZ087`, which is already allocated to Phase 10 `STYLE_UNRECOGNIZED_LANG`) fires when a component's plain **scoped** style rule targets content it renders into a **portal slot fill** (`<template #body>` / `#node` / any `<slot portal>` fill incl. `$portals.default`). Such content teleports into the wrapper's shadow root on Lit, where the scoped rule (no `[data-rozie-s-*]` attr there) silently never applies — correct on the 5 light-DOM targets, broken on Lit, and invisible to every existing gate (behavioral VR asserts DOM presence, not computed style). The diagnostic steers the author to the `:root {}` engine-DOM escape hatch, converting today's biggest recurring Lit pain point — a silent visual regression only caught by human inspection of `/compare.html` — into a programmatic author-time signal. Leverages the already-threaded `filler.isPortal` (threadParamTypes.ts:284) + `SlotFillerDecl.body`; warn-only; NO emit change (dist-parity zero-drift). Live validation: must flag `FlowCanvasDemo.rozie` `.rozie-demo-node` (open latent twin) and not the fixed `FlowCanvasDeclarativeDemo.rozie`.

**Requirements**: No formal REQ-* IDs — authoritative requirements are the acceptance criteria in `38-SPEC.md §Validation/acceptance` + locked decisions D-01..D-05 in `38-CONTEXT.md` (planned against directly).
**Depends on:** Phase 34 (`:root` engine-DOM escape hatch + `adopt-document-styles`), Phase 37 (`$portals.default`, the declarative-children portal cases that surfaced this)
**Plans:** 2/2 plans complete

Plans:

- [x] 38-01-PLAN.md — ROZ088 detection pass + codes.ts registration + unit suite + compile() post-threading wiring (Wave 1)
- [x] 38-02-PLAN.md — @rozie/unplugin pipeline wiring (7 sites) + live-validation pair (FlowCanvasDemo flags / FlowCanvasDeclarativeDemo does not) + repo-wide audit (12-file pre-fix baseline) + diagnostics-doc regen + zero-emit-drift gates — DONE 2026-06-10: Task 1 wiring (8129ee3c); Task 2 audit test EXPECTED_ROZ088_FILES = 12 flagged demos, exact-set assertion both directions (0c4818bc); Task 3 zero-drift proof — build 107/107, dist-parity 827/827 fixtures-empty, test 1515/1515 core, typecheck 136/136, ROZ088 renders `warning` in diagnostics HTML; NO demo modified (D-02). 11 latent-bug files cataloged for Wave 3 (`.planning/todos/pending/portal-scoped-style-lit-wave3-fixes.md`). Deviation: diagnostics-codegen renders into HTML at build (no `.md` source diff); audit cold-`--force` build-race flake (stable warm). UNPUSHED. (Wave 2)

### Phase 39: rozie-ui-embla-carousel — @rozie-ui/embla cross-framework Embla Carousel v8 engine-wrapper port

**Goal:** A component-library author writes one `Carousel.rozie` source and ships working, idiomatic `@rozie-ui/embla-{react,vue,svelte,angular,solid,lit}` Embla Carousel v8 packages — filling a genuine cross-framework gap (Lit has NO Embla wrapper; Angular's is a single-maintainer community package; the 4 official wrappers are 4 divergent APIs). Surface ≈16 props / 1 two-way model (`selectedIndex`) / 4 emits / 9 `$expose` / 2 slots (default `<slot/>` slides + scoped `slide` config-array). Two-way `r-model:selectedIndex` round-trips (echo-guarded), `autoplay` toggles the `embla-carousel-autoplay` plugin, and the SortableList own-host pattern (attach engine in `$onMount`, `$watch`→reInit reconcile) ports cleanly — MINUS SortableList's r-external/$reconcileAfterDomMutation/DOM-restore complexity (Embla only reads + transforms slide DOM, never reorders framework children). NO new compiler capability; NO emitter/core change (dist-parity ZERO-DRIFT). Biggest risk = screenshot-VR determinism (autoplay OFF + fixed startIndex + fixed-pixel widths → single shared `CarouselScreenshot.png` byte-identical across 6, neutralized on Linux).

**Requirements**: P39-01 (one Carousel.rozie → 6 codegen'd leaves), P39-02 (dual authoring model: default <slot/> + :slides config array), P39-03 (two-way r-model:selectedIndex echo-guarded + 4 emits), P39-04 (9-verb $expose with collision-suffix discipline), P39-05 (autoplay plugin toggle + :plugins escape-hatch), P39-06 (VR behavioral 6/6 + screenshot 6/6 + docs guide/sidebar/live-demo, dist-parity zero-drift)
**Depends on:** Phase 35 (MapLibre model⇄emit collision precedent + @rozie-ui port template), Phase 20+ (@rozie-ui distribution model)
**Plans:** 1 plan (3 waves)

Plans:

- [ ] 39-PLAN.md — Wave 1: scaffold @rozie-ui/embla + Carousel.rozie + codegen 6 leaves + surface gate + dep-drift snapshot (build/typecheck/dist-parity zero-drift). Wave 2: CarouselDemo + CarouselScreenshotDemo + all VR-wiring touchpoints + docs page/sidebar/comparison/live-demo. Wave 3: full gate sweep + VR behavioral 6/6 (drag + two-way index) + VR screenshot 6/6 rebless (pinned Linux container).

### Phase 40: FlowCanvas typed-socket connection validation + advanced demo

**Goal:** Give `@rozie-ui/rete` FlowCanvas a first-class `canConnect` connection-validation callback prop (plus a `connection-rejected` emit) so component-library authors can declare which ports may interconnect — enforced uniformly across drag-to-connect, imperative `addConnection`, and config-array connections by cancelling Rete's `connectioncreate` signal — and prove it with an advanced typed data-pipeline demo (multiple node kinds, typed number/string ports, per-node actions, multi-cardinality merge, two-way zoom) that compiles from ONE `.rozie` source and behaves identically on all six targets (React/Vue/Svelte/Angular/Solid/Lit), fully rolled out to the playground, docs, and a 6/6 cross-target VR matrix asserting both accept and reject. The function-typed prop is the load-bearing cross-framework risk (esp. Lit property binding + Angular `@Input`); success = it works on all six with NO emitter/core change (dist-parity zero-drift).
**Requirements**: TBD (additive feature + dogfood demo; no pre-existing REQUIREMENTS.md IDs map to this phase)
**Depends on:** Phase 39
**Plans:** 3/3 plans complete

Plans:

- [x] 40-01-PLAN.md — Wave 1 (feature): canConnect prop + connectioncreate-cancel editor pipe + echo-guarded connection-rejected emit in FlowCanvas.rozie; regenerate 6-target leaves; docs props 13→14 + events row; dist-parity zero-drift + turbo typecheck/test green (D1/D2/D3).
- [x] 40-02-PLAN.md — Wave 2 (demo + VR): FlowCanvasAdvancedDemo.rozie typed data-pipeline (3 node kinds, typed ports, same-type-only rule, per-node remove, two-way zoom/fit/counts) + VR host wiring + rete-flow-advanced accept+reject suite 6/6 Linux container; existing rete-flow 24/24 stay green (D4/D5).
- [x] 40-03-PLAN.md — Wave 3 (rollout): playground bundle snippet + rete-demo.md live-demo section + human-verify cross-target port colors incl Lit (D6).

### Phase 41: FlowCanvas controlled-graph + node-type templates redesign

**Goal:** Redesign the `@rozie-ui/rete` FlowCanvas authoring model so it owns the flow middleware and puts minimal work on the consumer — separating three concepts the current API conflates: (1) node **TYPE templates** declared once as children (how a "source"/"merge" node renders + its typed port schema), (2) graph **STATE** as a single two-way `r-model` JSON object (`{ nodes:[{id,type,x,y,data}], connections:[...] }`) that the canvas WRITES BACK to as the user drags/connects/disconnects (the controlled-component model, à la React-Flow `nodeTypes` + controlled nodes/edges), and (3) FlowCanvas as the **middleware** that renders each graph node by its type template, owns drag/zoom/connect, and syncs layout + connections back into the r-model. Typed-socket validation becomes (likely) automatic from the declared port types, with Phase-40's `canConnect` repositioned as the optional custom-rule override. MUST compile + behave identically on all six targets (React/Vue/Svelte/Angular/Solid/Lit) from ONE `.rozie` source. HYPOTHESIS (verify in Wave-0): achievable with NO emitter/core change — two-way write-back via `model:true` on the graph object (consumer-side two-way shipped in Phase 07.3), render-by-type as the existing reactive `#node` portal slot generalized, port schema from `<Handle type>` on templates — all `packages/ui/rete` + demo/docs/VR. Success = a developer binds ONE graph JSON + declares node-type templates, and gets a working, identical, controlled flow editor on all six with the canvas reconciling everything.
**Requirements**: TBD (architecture redesign of a shipped component; builds on Phase 40's canConnect)
**Depends on:** Phase 40
**Plans:** 7/6 plans complete

Plans:

- [x] 41-01-PLAN.md — Wave 0 (GATING): engine-less `r-model:graph` deep write-back de-risk probe on all 6 + validation-feasibility micro-check + HALT-on-emitter-change checkpoint
- [x] 41-02-PLAN.md — Wave 1: FlowCanvas controlled-graph core (graph model + immutable write-back + render-by-type + per-TYPE port schema + validate-types pipe; remove one-way :nodes/:connections)
- [x] 41-03-PLAN.md — Wave 1: NodeType.rozie + Port.rozie (repurpose FlowNode/Handle) + remove Connection (clean break) + codegen COMPONENTS + docs props-table + dist-parity zero-drift gate
- [x] 41-04-PLAN.md — Wave 2: rework demos to controlled-graph + NodeType/Port typed pipeline (source/merge multi-port) + VR host EXAMPLES/LIT_TAGS wiring (MODEL_PROPS empty)
- [x] 41-05-PLAN.md — Wave 2: rework rete-flow VR cells (drag/connect write-back asserts BOUND readout, render-by-type, automatic typed validation + canConnect override, remove) + VR 6/6 in pinned container
- [x] 41-06-PLAN.md — Wave 3: playground + docs live-demo/API/comparison + authoring playbook refresh + human-verify (DX-feel + cross-target port colors incl Lit)

### Phase 42: FlowCanvas MiniMap + viewport API (setCenter/setViewport)

**Goal:** Add a built-in MiniMap overview panel to @rozie-ui/rete FlowCanvas — measured node rectangles + a viewport mask (dim outside the current view) + PANNABLE (click/drag the minimap recenters the main viewport) — plus the small viewport API it needs (`setCenter(x,y,opts?)` / `setViewport({x,y,k})` $expose verbs, the T11 gap). Opt-in via a `:minimap` prop (default off, React-Flow-style). The minimap is an in-tree absolute-positioned SVG overlay (sibling of the Phase-41-quick Controls widget — NO portal/foreign-slot/Lit-shadow issues), reading engine node-view element sizes for measured dims (target-agnostic, same Rete engine on all 6). NO emitter/core change (dist-parity zero-drift). Compile + behave identically on all 6 targets; full cross-target VR (node rects + viewport rect render + pannable recenters) + demo + docs. Autonomous overnight build — Claude locks the gray-area decisions; verification is Claude's own cross-target screenshots/computed checks (no human-verify pause).
**Requirements**: TBD
**Depends on:** Phase 41
**Status:** ✅ COMPLETE + VERIFIED 2026-06-12 (autonomous overnight build), PUSHED origin/main=ad848287 (commits 6eddc5be+fdb925a4+ad848287).
**Plans:** delivered as a single autonomous build (design pre-locked in 42-CONTEXT.md).

Plans:

- [x] MiniMap overlay (opt-in `:minimap`, default OFF) — absolute light-DOM SVG (bottom-right), MEASURED node rects (engine node-view offsetW/H) + viewport window (evenodd dim mask) + PANNABLE (drag → setCenter recenters). Imperative createElementNS + inline-attr styling (no SVG-in-template cross-target risk). rAF-coalesced redraw off render-pipe/translated/zoomed/drag/selection/graph-$watch.
- [x] `setCenter(x,y,opts?)` / `setViewport({x,y,k})` $expose verbs (the T11 gap) — AreaPlugin transform writes (zoom origin-omitted leaves x/y + absolute translate), echo-guarded, echo `$model.zoom` + fire `translated`.
- [x] Demo `examples/demos/FlowCanvasMinimapDemo.rozie` (`:minimap="true"`) + docs `docs/components/rete.md` (props 15→16, expose 13→15) + VR cell `rete-flow-minimap`.
- [x] Verification: NO emitter/core change (dist-parity ZERO-DRIFT); build 114/114, typecheck 144/144 (one strict-tsc arity finding fixed in-band), test 79/79, rete surface 29/29; pinned-container VR `rete-flow` 48 passed (rete-flow-minimap 6/6 + existing 7 green); own cross-target screenshots 6/6 MD5-IDENTICAL, pannable tx 0→985 identical incl Lit.

### Phase 43: FlowCanvas workflow-builder bundle (palette drag-drop · top/bottom handles · edge labels + types)

**Goal:** Make `@rozie-ui/rete` FlowCanvas the obvious pick for the #1 node-editor use case — workflow / no-code builders — by filling the three gaps that block it, all reusing the existing vanilla render pipe + `<NodeType>`/`<Port>` registry pattern (feasibility-confirmed NO emitter/core change, dist-parity zero-drift): (1) **palette drag-drop** via a `screenToFlowPosition(clientX,clientY)` $expose verb (E7/T11 — the #1 no-code-builder interaction); (2) **top/bottom handle positioning** via `<Port position="left|right|top|bottom">` (T10 — vertical flows; solved through `getDOMSocketPosition`'s `offset` override since the default 12px shift is hardcoded horizontal); (3) **edge labels + `<EdgeType>` custom edges** via an optional `connection.label`/`connection.type` + render-by-type edge styling (T8/T9 — conditional/labeled edges are core to workflow graphs). Identical on all 6 targets; full cross-target VR + demos + docs (flip the comparison matrix T8/T9/T10/E7 → ✅). Built feature-by-feature, each gate-verified before the next. Design locked in 43-CONTEXT.md.
**Requirements**: TBD
**Depends on:** Phase 42
**Status:** ✅ COMPLETE + VERIFIED 2026-06-12 (autonomous build, all 3 features), UNPUSHED on main (commits 614fcb8b F1 + bbf4a819 F2 + dd2154fb F3 + c3228a65 docs). NO emitter/core change (dist-parity zero-drift throughout); each feature gate-verified + container VR 6/6 before the next.
**Plans:** built autonomously feature-by-feature (design pre-locked in 43-CONTEXT.md).

Plans:

- [x] F1 — `screenToFlowPosition` verb + palette drag-drop demo + docs recipe. SHIPPED 2026-06-12 (commit 614fcb8b, UNPUSHED). Expose 15→16, NO emitter change (dist-parity zero-drift), gates green, container VR 53 passed (rete-flow-palette 5/6; angular fixme = documented `$refs`-to-child-host edge). Surfaced+logged a latent `$refs` self-shadow TDZ emitter gap (`.planning/todos/pending/refs-self-shadow-tdz.md`).
- [x] F2 — `<Port position>` (left/right/top/bottom) + conditional render-pipe 3-row node layout (classic stays byte-identical → FlowCanvasScreenshot untouched) + custom `getDOMSocketPosition({ offset })` (Y-shift for top/bottom). SHIPPED 2026-06-12 (commit bbf4a819, UNPUSHED). NO emitter change; container VR 65 passed (rete-flow-vertical 6/6 dx=0/dy=12.1 + FlowCanvasScreenshot 6/6 byte-identical).
- [x] F3 — edge labels + per-edge styling: optional `connection.label`/`stroke`/`dashed` on the bound graph (REVISED from a `<EdgeType>` component — edges are per-instance data, RF edge.label/style model, simpler+more flexible; custom edge RENDERING/edgeTypes deferred). SHIPPED 2026-06-12 (commit dd2154fb, UNPUSHED). NO emitter change; container VR 65 passed (rete-flow-edges 6/6, labels+green/red+dash+live-relabel). Comparison-matrix update c3228a65.

### Phase 44: FlowCanvas Editable Canvas bundle — edge selection/delete, step/smoothstep edge types, undo/redo, marquee selection, reconnectable edges, auto-layout, connect-end-on-pane hook, NodeToolbar

**Goal:** Turn `@rozie-ui/rete` FlowCanvas from "an editor you can view" into "a workflow builder you can confidently *edit*" by closing the Tier-1 + Tier-2 day-1 gaps from the post-Phase-43 gap analysis — all reusing the existing vanilla render pipe + controlled-graph write-back + `<NodeType>`/`<Port>` registry (prefer NO emitter/core change → dist-parity zero-drift). Eight features, built feature-by-feature, each cross-target gate-verified before the next:

**Tier 1 (a user bounces without these):**

1. **Edge selection + delete** — click an edge to select it; Delete/Backspace removes it (extend the existing node selection + keydown path to `connEntries`; the connection `__path` already has `pointer-events:auto`). Surface `@edge-click` / `@edge-selected`. Removal flows through the controlled-graph write-back (`writeBackConnectionRemoved` → fresh `{ ...g, connections }`), echo-guarded.
2. **Step / smoothstep / straight edge types** — per-edge `connection.type` selects a path generator in `renderConnection` (bezier `classicConnectionPath` remains the default; add orthogonal/straight generators). Pure render-pipe change.
3. **Undo / redo** — a **graph-snapshot stack** over the bound `r-model:graph` (target-agnostic JSON snapshots; NOT `rete-history-plugin`). `undo()` / `redo()` `$expose` verbs + Ctrl+Z / Ctrl+Shift+Z keybinds on the canvas container. Each restore writes a fresh top-level graph object back through `$model.graph`; the existing reconcilers apply it; echo-guarded via `programmatic`.

**Tier 2 (define the "builder" feel):**

4. **Marquee / box selection** — rubber-band drag on empty canvas to multi-select nodes (today only Ctrl-click accumulate). Feeds the same selector → `@selection-change`.
5. **Reconnectable edges** — drag an existing edge endpoint to a new socket instead of delete+redraw (ConnectionPlugin reconnect preset); write-back the moved edge as a fresh graph object.
6. **Auto-layout** — `autoArrange()` `$expose` verb via `rete-auto-arrange-plugin` (elkjs); reuse the MEASURED node sizes already computed for the MiniMap (`measureNodeSize`); write the arranged x/y back through `$model.graph`.
7. **Connection-drop-on-pane hook** — a drag that ends on empty canvas (no target socket) surfaces `@connect-end { source, sourceOutput, position }` (graph coords via `screenToFlowPosition`) — the n8n "drop edge → create + wire a node" pattern. Component owns only the hook; the consumer creates the node in the bound graph.
8. **NodeToolbar** — a floating delete / duplicate / config toolbar over the selected node, positioned from the engine node-view rect (component-template overlay DOM in the canvas, positioned absolutely; reuses the selection state). Buttons emit `@node-action` / drive `deleteNode` + a duplicate path.

**Constraints (carried from the family):** controlled-graph write-back discipline (fresh top-level graph object on every edit, echo-guarded by `programmatic` + no-op-diff); `:root` engine-DOM escape hatch for any engine-mounted chrome (engine DOM carries no `[data-rozie-s-*]` scope attr; component-template overlays use plain scoped CSS); behavioral parity verified across all 6 targets (incl. Angular real-build); dist-parity zero-drift unless an emitter change proves unavoidable (prefer none); pixel-baseline safety (new chrome opt-in / additive so FlowCanvasScreenshot stays byte-identical unless a demo opts in). Design to be locked in 44-CONTEXT.md during discuss/plan.
**Requirements**: No REQ-IDs mapped; coverage driven by features T1.1–T2.8 + decisions D-01..D-08 (cited per-plan).
**Depends on:** Phase 43
**Plans:** 9/9 plans complete

Plans:
**Wave 1**

- [x] 44-00-PLAN.md — T2.6 prerequisite: install rete-auto-arrange-plugin/elkjs/web-worker (gated) + bundle smoke on all 6 incl Angular AOT + Lit

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 44-01-PLAN.md — T1.1 edge selection + delete (@edge-click/@edge-selected, echo-safe)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 44-02-PLAN.md — T1.2 edge types step/smoothstep/straight (connection.type, bezier default unchanged)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 44-03-PLAN.md — T1.3 undo/redo (per-gesture graph-snapshot stack + verbs + Ctrl+Z/Y)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 44-04-PLAN.md — T2.4 marquee + r-model:mode pan/select (gated mode button, pixel-safe)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 44-05-PLAN.md — T2.5 reconnectable edges (coalesce remove+add into one undo entry)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 44-06-PLAN.md — T2.8 NodeToolbar (opt-in #toolbar slot, default delete/duplicate)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 44-07-PLAN.md — T2.6 auto-layout (autoArrange() verb, read-back to $model.graph)

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 44-08-PLAN.md — T2.7 connect-end-on-pane (@connect-end pure emit, consumer owns creation)

### Phase 45: $clone sigil — cross-target safe deep clone for reactive objects

**Goal:** Introduce a `$clone(x)` author-side sigil that lowers to a per-target safe, **independent DEEP clone** of a value — including framework-reactive objects — closing the cross-target footgun where a bare `structuredClone()` THROWS on a Vue `reactive()` / Svelte `$state` proxy ("could not be cloned"), silently leaving snapshot/history state empty on Vue + Svelte ONLY while React/Solid/Lit work (the target-asymmetric trap surfaced by the Phase 44 rete undo stack, folded into authoring-playbook §8). `$clone` is deliberately distinct from the existing `$snapshot` sigil, which is an UNWRAP (identity on 5/6 targets, `$state.snapshot` only on Svelte) and does NOT produce an independent copy suitable for a history stack — so an author building undo/redo or any cross-render scratch snapshot has no correct primitive today and must hand-roll a JSON clone (as `FlowCanvas.rozie`'s `cloneGraph` does). After this phase the author writes `$clone(x)` once and gets a proxy-safe deep copy on all six targets.

**Scope (planning to finalize per-target strategy + ROZ code):**

1. Register `$clone` as a first-class sigil — bare-sigil validator, reactivity dep-graph (a `$clone(x)` read tracks `x` as a dependency), and the call-form lowering hook in core.
2. Per-target lowering in all six emitters to an independent deep clone that is proxy-safe — candidate strategies: JSON round-trip (`JSON.parse(JSON.stringify(x))`, also strips functions), `structuredClone` over a raw-unwrapped value (`toRaw` on Vue), `$state.snapshot(x)` on Svelte. Exact per-target choice is a planning decision (D-01).
3. A lowering-time ROZ diagnostic that flags `structuredClone(<reactive binding>)` — `$props.*` / `$data.*` / `$model.*` — and points the author at `$clone` (the established ROZ123/127/128 target-asymmetry-guard pattern). Conservative syntactic detection acceptable for v1 (D-02).
4. Dogfood: retrofit `FlowCanvas.rozie`'s hand-rolled `cloneGraph` helper to `$clone` and confirm the rete undo/redo + reconnect-coalesce VR cells stay green.
5. dist-parity rebless (emitter change) + full six-target gate (typecheck / test / dist-parity / VR).

**Requirements**: New sigil surface; coverage driven by D-01 (per-target clone strategy), D-02 (diagnostic detection scope), cited per-plan.
**Depends on:** Phase 44
**Plans:** 10/10 plans complete

Plans:
**Wave 1**

- [x] 45-01-PLAN.md — Core registration ($clone in STABLE_IDENTIFIERS + RESERVED_SIGILS) + D-02 ROZ135 diagnostic

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 45-02-PLAN.md — Vue (structuredClone(toRaw(x)) + toRaw auto-import) + Svelte (bare $state.snapshot(x)) lowering
- [x] 45-03-PLAN.md — React + Solid $clone → structuredClone(x) lowering
- [x] 45-04-PLAN.md — Angular + Lit $clone → structuredClone(x) lowering

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 45-05-PLAN.md — CloneProbe fixture + FlowCanvas dogfood retrofit + full gate/rebless + rete VR + playbook update

**Wave 4** *(gap-closure — code review WR-01)*

- [x] 45-06-PLAN.md — ROZ136 `$clone` arity validator (validateClone) — DONE 2026-06-13: 2 commits (90d155cb / 0c1a42ae). `$clone()` / `$clone(a,b)` / `$clone(...x)` now a HARD compile error (ROZ136, error severity) at lowerToIR instead of a dangling `$clone` identifier (runtime ReferenceError on all six targets). Mirrors validateRestoreFocus (ROZ976): never-throws (D-08), script + template + listener coverage, at-most-one-diagnostic-per-call. NO emitter change → valid unary `$clone(x)` byte-identical (dist-parity 827 zero drift, no rebless). @rozie/core test 1541/1541 + typecheck green.
- [x] 45-09-PLAN.md — ROZ135 one-hop reactive-alias detection (WR-03) — DONE 2026-06-13: commit 807a890e. ROZ135 now also fires on `const g = $data.graph; structuredClone(g)` (the dominant engine-wrapper shape the direct-member match caught ~none of). Shared `asReactiveMember` predicate (direct + alias agree on "rooted at a reactive accessor"); conservative D-02 — const-only, single-declaration, same-scope; `let`/reassigned/multiply-declared/two-hop/non-reactive → tombstone → NOT flagged (zero false positives). Direct-member takes precedence; ≤1 diagnostic per call; message names alias + member. D-08 hardened (both `traverse` calls wrapped — @babel scope-binding throws on duplicate decls). 13 new tests; validator-only → dist-parity 827 zero-drift, NO rebless. @rozie/core test 1556/1556 + typecheck green.

**Cross-cutting constraints:**

- Neither target emits toRaw or $state.snapshot (Vue/Svelte-only)
- ~~$clone with arity != 1 or a spread argument is left untouched~~ → CLOSED by 45-06 (WR-01): now a ROZ136 hard error (the untouched-fallthrough was the footgun — a dangling `$clone` identifier with zero compile signal)
- The $clone argument's reactive reads still rewrite (no path.skip)

### Phase 46: Emitter hardening: smooth cross-target authoring caveats

**Goal:** Eliminate the class of cross-target authoring footguns surfaced by the `@rozie-ui/listbox` port (the first no-engine, class-emitting component) by fixing them at the emitter/diagnostic layer instead of requiring per-author source workarounds. Each work item is either (a) correct-by-construction emit, or (b) a compile-time diagnostic — so a component author never has to discover these the hard way again.

**Requirements**: ITEM-1, ITEM-2, ITEM-3, ITEM-4, ITEM-5, ITEM-6
**Depends on:** Phase 45

**Scope / work items** (rough plan ordering: clean win → bigger lift):

1. **Duplicate prop-destructure dedupe (React)** — an event emitted from 2+ functions hoists `const { onX: _rozieProp_onX } = props` once *per emit-site* → duplicate `const` → "already declared". Fix: collect emitted event names, destructure each ONCE at component-body top. (Small, unambiguous.)
2. **Component bare-boolean-attr coercion (parser→emit)** — `<Child combobox />` emits `combobox=""` on all 6; only Vue+Lit coerce to `true`. Fix: a bare (value-less) attr on a `<components>` element emits boolean `true` (`combobox={true}` / `[combobox]="true"` / `:combobox="true"`); a bare attr on a DOM element keeps `=""` (correct HTML). (Has come up before.)
3. **`$expose`-verb == inherited-DOM/Object-member diagnostic (warn)** — target-aware (Lit element ⊃ HTMLElement+Object; Lit/Angular class ⊃ Object; React fn-component ⊃ nothing). Warn when an *exposed* verb (public, can't auto-rename) shadows an inherited member (`focus`/`blur`/`scrollTo`/`click`/`valueOf`/`toString`…). New ROZ code.
4. **React stale-read diagnostic (warn)** — within one function body, a read of `$data.x` / model / prop dominated by a write to the same key is STALE on React (setState is async). Warn → "capture the written value in a local." Silent, target-asymmetric correctness bug typecheck can't see (only behavioral VR caught it: listbox combobox `onInput`). New ROZ code.
5. **General collision-aware deconfliction pass (architectural; React first)** — generalizes the existing `deconflictRefShadows` / `deconflictAccessorShadows` / `deconflictPropShadows` / `ROZ524` point-fixes into ONE pass. Compute the emitter's generated-symbol set (state vars + `setX` setters, ref vars, prop accessors, watch refs) ∪ user top-level symbols; rename ONLY colliding symbols on the RENAMEABLE side (internal state/setter/local — NEVER public `$expose` keys or prop names), deterministic suffix, gated on actual collision so the non-colliding corpus stays byte-identical. Subsumes the `$data`-key==`$expose`-verb collision (listbox `$data.open` vs `$expose open`) and the local==`Object.prototype`-member collision for class-emitting targets (`valueOf` → cascades TS1240 to every Lit `@property`). Biggest leverage; needs the renameable-vs-contract rules + a dist-parity rebless.
6. **Solid `$computed` access-form completeness (lowest priority / candidate docs-only)** — extend the bare-read→`accessor()` rewrite to cover the assignment-RHS read position (`const opts = visibleOptions` → `visibleOptions()`) in NON-reactive scopes only (scope-aware: don't auto-call inside `createMemo`/`createEffect` where the accessor itself is wanted). A clean plain-function workaround already exists, so this may be scoped to documentation.

**Verification (load-bearing — all changes are emitter/core/runtime):** full `turbo build --force`; **dist-parity rebless** (`pnpm --filter dist-parity bootstrap`) — drift MUST be confined to the currently-broken fixtures the fixes correct (zero drift elsewhere); **target-\* snapshot + core match-\* rebless**; 6-target typecheck/test gates via `turbo run … --force --continue`; **VR matrix** (prove zero BEHAVIORAL drift on the existing corpus). New ROZ diagnostic codes for items 3 + 4 (register in `packages/core/src/diagnostics/codes.ts` + regen `docs/reference/diagnostics.md`).

**Source of findings:** the `@rozie-ui/listbox` build (memory `[[project_next_port_listbox]]`, playbook §6 collision catalogue + §8 gotchas).

**Plans:** 4/4 plans complete

Plans:

- [x] 46-01-PLAN.md — Wave A: ITEM-1 React dup prop-destructure dedupe + ITEM-2 component bare-bool-attr coercion (correct-by-construction emits)
- [x] 46-02-PLAN.md — Wave A: ITEM-3 ROZ137 expose-verb-reserved-member warn + ITEM-4 ROZ138 React stale-read warn + Wave-A 7-stage gate
- [x] 46-03-PLAN.md — Wave B: ITEM-5 unified target-parameterized collision-aware deconfliction pass (absorbs deconflictRefShadows + deconflictAccessorShadows + ROZ524) + class-target reserved sets + listbox dogfood + Wave-B gate
- [x] 46-04-PLAN.md — Wave C: ITEM-6 Solid $computed access-form docs (docs-only)

### Phase 47: @rozie-ui/slider — pure-Rozie headless accessible slider / range input (second no-engine family)

**Goal:** Ship the **second no-engine `@rozie-ui` family** — one `Slider.rozie` compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit — proving Rozie can author **rich engine-less interaction** (native pointer + touch drag, full keyboard, ARIA slider pattern) with **no third-party engine**. Where listbox proved popup selection, slider proves continuous pointer-driven value manipulation. Surface mirrors listbox's contract discipline: two-way `r-model:value` as the sole `model: true` prop (→ Angular `ControlValueAccessor`), single value **and** range/multi-thumb, `min`/`max`/`step`, `disabled`, RTL, optional vertical orientation, optional ticks/marks, scoped slots (thumb / track / mark), an `$expose` imperative handle, and fully token-driven `--rozie-slider-*` CSS theming with shadcn/Material/Bootstrap bridges. Follows the established `@rozie-ui` distribution model (`packages/ui/slider` + `codegen.mjs` doc-automation, 6 pre-compiled per-framework leaves, colocated helpers, component + comparison + demo docs pages, behavioral VR matrix). Reuses listbox patterns and the Phase-46 emitter hardening (auto-deconfliction, bare-bool-attr coercion, ROZ137/138 diagnostics) so no per-author collision workarounds are needed.
**Requirements**: 12 locked (see 47-SPEC.md req-1..req-12)
**Depends on:** Phase 46
**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 47-01-PLAN.md — Wave 0 test infra: slider.spec.ts + 4 demo .rozie + host/main.ts registration (failing behavioral contract)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 47-02-PLAN.md — Slider.rozie source authoring (props/script fill+range+$expose, overlap/rotate-90/pseudo-element scoped CSS, 4 theme files)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 47-03-PLAN.md — Distribution: meta + codegen/manifests/readme + 6 leaf shells; emit 6 leaves via codegen (idempotent)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 47-04-PLAN.md — Docs: slider.md + comparison + demo pages + sidebar wiring + docs Vue dep

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 47-05-PLAN.md — Verification gate: cold build/typecheck/test + dist-parity zero-drift + full slider VR matrix ×6 + Firefox re-skin checkpoint

### Phase 48: @rozie-ui/data-table — headless, accessible, cross-framework DataTable family (most complex @rozie-ui component to date)

**Goal:** Ship the next (and most complex to date) `@rozie-ui` family — one `DataTable.rozie` compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit at full parity (all verification gates + behavioral VR matrix ×6 + component/comparison/demo docs), following the established `@rozie-ui` distribution model (`packages/ui/data-table` + `codegen.mjs` doc-automation, 6 pre-compiled per-framework leaves, colocated helpers). A DataTable stresses the slot / render-prop / keyed-list machinery harder than any prior family; it builds on the Phase-46 emitter hardening + slider's repeated-named-slot dedup, and the standing rule is **fix-emitter-then-rebless**, not work-around-in-source. Where slider proved continuous pointer manipulation and listbox proved popup selection, DataTable proves **stateful tabular data presentation** — sorting, filtering, pagination, selection — at cross-framework parity.

**This phase is intentionally SPEC-FIRST.** A `/gsd-spec-phase` pass (48-SPEC.md) must resolve four pivotal decisions BEFORE any planning:

1. **ENGINE CHOICE** (pivotal): wrap **@tanstack/table-core** (framework-agnostic headless table; React/Vue/Svelte/Solid adapters exist but are uneven, Angular is community/younger, **Lit is MISSING** — a textbook Rozie wedge) **vs** build a **pure-Rozie headless table from scratch** (a 3rd no-engine family after listbox/slider, but an order of magnitude larger). Decision must weigh cross-target fidelity, maintenance surface, bundle, dep-allowlist cost, and the market-wedge story.
2. **FEATURE SCOPE**, tiered v1 / deferred: column defs, sorting, column + global filtering, pagination, row selection (single / multi / select-all), column visibility / reorder / resize / pin, expandable / sub rows, sticky header, **ROW VIRTUALIZATION** (the perf question — likely `@tanstack/virtual`; explicit in/out for v1), editable cells, grouping / aggregation. Pick a defensible v1; defer the rest explicitly.
3. **PER-COLUMN CELL/HEADER RENDERING** (make-or-break): the scoped-slot authoring API keyed by column (`#cell` / `#header` with a `{ row, value, column }` shape) and how a consumer maps slots → columns across all six targets — this is where React's documented render-prop slot caveat bites hardest.
4. **STATE SURFACE**: which pieces are two-way `r-model` models (sorting / filters / pagination / rowSelection — mirror slider's sole-model discipline but with multiple models) vs one-way props + change events, including Angular `ControlValueAccessor` implications.

**Traps to design around up front** (from the slider/listbox ports): ROZ127 (a slot name must not equal a prop name); r-for loop-var must not equal a slot name (Svelte mount throw); the new-`@rozie-ui`-package Angular VR prebuild-roots registration (`tests/visual-regression/vite.config.ts` `prebuildExtraRoots` + `tsconfig.app.json` include + `build-cells.mjs` cross-tree sweep — missed on slider, broke all Angular VR cells); and the dep-allowlist re-snapshot (`scripts/check-dep-drift.mjs --update`, after verifying provenance) if TanStack is added. Expect NEW emitter findings — a datatable stresses slots/render-props/keyed-lists hardest — fix at the emitter then rebless.

**Requirements**: 20 locked (see 48-SPEC.md req-1..req-20) — engine=wrap @tanstack/table-core; Rich v1 scope (sort/filter/paginate/select/visibility + resize/reorder/pin + sticky header; virtualization+expandable+editable+grouping deferred); declarative `<Column>` children w/ per-column reactive-portal templates (+ `:columns` coexist, Wave-0 perf probe); multi-`r-model` state surface (no CVA)
**Depends on:** Phase 47
**Plans:** 8/8 plans complete

Plans:

- [x] 48-01-PLAN.md — Wave 0: install @tanstack/table-core, provenance-verify, dep-allowlist re-snapshot (req-20)
- [x] 48-02-PLAN.md — Wave 1: Wave-0 reactivity + portal-cost probe; portal-vs-slot decision + row-count ceiling (req-3 gate)
- [x] 48-03-PLAN.md — Wave 2: core table — meta scaffold + Column.rozie + inline bridge + column union + single/multi sort + sticky header (req-1,2,3,4,12)
- [x] 48-04-PLAN.md — Wave 3: filter (global + per-column) + pagination (manual hook) + row selection (single/multi/select-all) (req-5,6,7)
- [x] 48-05-PLAN.md — Wave 4: column visibility/resize/reorder/pin + WAI-ARIA + nine-slice multi-model no-CVA (req-8,9,10,11,13,14)
- [x] 48-06-PLAN.md — Wave 5: distribution — codegen + 6 leaves + themes + LICENSE + per-leaf metadata (req-15,16)
- [x] 48-07-PLAN.md — Wave 6: docs — component + comparison + demo pages, sidebar, IR-validated tables (req-17)
- [x] 48-08-PLAN.md — Wave 7: behavioral VR x6 + 3-file Angular registration + full gates + dist-parity (req-18,19)

### Phase 49: @rozie-ui/data-table grid interaction mode: WAI-ARIA role=grid, roving-tabindex cell focus, 2D arrow-key navigation (interactionMode='grid' seam from phase 48)

**Goal:** When interactionMode='grid', @rozie-ui/data-table switches to the WAI-ARIA Grid pattern (role=grid/gridcell, roving single tab-stop, 2D arrow-key cell nav over header+body, Enter/Escape cell-vs-control) on all six targets, while interactionMode='table' (default) stays behaviorally identical to phase 48. Source-only; dist-parity zero-drift.
**Requirements**: REQ-1 (grid ARIA roles gated by mode), REQ-2 (roving single tab-stop), REQ-3 (2D arrow-key nav, full APG key set), REQ-4 (Enter/Escape cell-vs-control), REQ-5 (active-cell $expose API, no new model slice), REQ-6 (index-based nav + scroll-into-view seam), REQ-7 (edge & visible-model nav semantics)
**Depends on:** Phase 48
**Plans:** 4/4 plans complete
**Status:** ✓ COMPLETE + VERIFIED 2026-06-18 — VERIFICATION passed (7/7 must-haves; REQ-1..REQ-7 mapped to source + behavioral VR ×6). Grid mode fully 6/6 on all targets; interactionMode='table' default behaviorally unchanged; dist-parity zero-drift. Gates: typecheck 168/168, test 85/85, data-table-grid VR 12/12 (incl React). One emitter fix landed inline (4bec3b8e numeric-attr tabIndex) + the React $expose stale-read closed by quick task 260618-ao9 (e6805518/a663b0d3/9c98c000). UNPUSHED on main. Advisory code-review follow-ups WR-02..06 + IN-01/02 (grid-interaction polish) deferred to a follow-up pass — see phase deferred-items.md. NOT pushed (per no-autopush).

Plans:

- [x] 49-01-PLAN.md — Wave-0 cross-target focus-probe (data-* querySelector-off-root focus mechanism, proven x6)
- [x] 49-02-PLAN.md — Grid ARIA roles + roving tabindex + active-cell index state + focusActiveCell() seam
- [x] 49-03-PLAN.md — Delegated keydown nav + edge/visible-model clamp + in-cell focus trap + 3 $expose verbs + activecell-change event
- [x] 49-04-PLAN.md — Behavioral grid-nav VR cell + x6 spec (the gate) + table-mode non-regression + dist-parity zero-drift

### Phase 50: @rozie-ui/data-table TanStack round-out (expandable rows + grouping/aggregation + faceted filtering)

**Goal:** @rozie-ui/data-table rounds out the three unleveraged TanStack row models in one coordinated phase — expandable rows (`getExpandedRowModel`: a `#detail` slot AND nested sub-rows), grouping (`getGroupedRowModel`: multi-column nested grouping + full aggregation set + collapsible group-header rows, driven by a binding `grouping` model/prop with a headless `#groupBar` exposure slot — no built-in drag UI), and faceted filtering (`getFacetedRowModel`/`UniqueValues`/`MinMaxValues`: headless per-column unique-value + min/max exposure) — authored once in `DataTable.rozie` and compiled to idiomatic React/Vue/Svelte/Angular/Solid/Lit with no per-framework wrappers, all features OFF by default (byte-identical-off).
**Requirements**: SPEC reqs 1-11 (see 50-SPEC.md; phase_req_ids null — SPEC-internal numbering, as in prior @rozie-ui phases)
**Depends on:** Phase 49 (grid focus model). Absorbs the former Phase 52 (grouping).
**Plans:** 5/5 plans complete

> Scope expanded 2026-06-19: rounds out the unleveraged TanStack row models in one phase —
> expandable rows (`getExpandedRowModel` + detail/sub-row slot), grouping/aggregation
> (`getGroupedRowModel` + group-header rows), and faceted filtering
> (`getFacetedRowModel`/`getFacetedUniqueValues`/`getFacetedMinMaxValues`). Co-designs the shared
> sub-row render seam once. **Absorbs the former Phase 52 (grouping).** Column (horizontal)
> virtualization remains deferred/out of scope. Interactive drag-to-group DnD RETIRED (D-02 revised);
> grouping is a binding model/prop + `applyGrouping`/`clearGrouping` + headless `#groupBar` slot.

Plans:

**Wave 1**

- [x] 50-01-PLAN.md — Wave-0 scaffold: data-table-roundout VR spec (reqs 1-9) + expand/group/facet demo fixtures + Angular cross-tree registration + :5176 render-shape probe (req 11)

**Wave 2** *(blocked on Wave 1)*

- [x] 50-02-PLAN.md — expandable rows: getExpandedRowModel + expanded two-way slice + writeExpanded funnel + EXPANDER_COL + unified D-04 render seam (#detail slot + getSubRows depth indentation) + expand $expose verbs + expanded-change (reqs 1,2,3,10,11)

**Wave 3** *(blocked on Wave 2)*

- [x] 50-03-PLAN.md — grouping + aggregation: getGroupedRowModel + grouping two-way slice + group-header rows off the D-04 seam + full aggregationFns + per-column custom + applyGrouping/clearGrouping + grouping-change + headless #groupBar slot (no drag) (reqs 4,5,6,7,10,11)

**Wave 4** *(blocked on Wave 3)*

- [x] 50-04-PLAN.md — faceted exposure: getFacetedRowModel/UniqueValues/MinMaxValues + keys-only facet helpers + getFaceted* $expose verbs + #filter scoped slot props (cross-filtered, headless) (reqs 8,9,10,11)

**Wave 5** *(blocked on Waves 2-4)*

- [x] 50-05-PLAN.md — docs + phase gate: expand/group/facet USAGE/HANDLE_USAGE x6 + no-adapter/props-table validators + full roundout VR x6 single-worker clean + final byte-identical-off rebless (reqs 2,6,10,11)

### Phase 51: @rozie-ui/data-table editable cells (inline edit; rides on the phase-49 grid focus model)

**Goal:** @rozie-ui/data-table gains spreadsheet-grade cell editing — single-cell inline edit, full-row edit, and cell-range selection with clipboard copy/paste + drag-fill — authored once and compiled to idiomatic React/Vue/Svelte/Angular/Solid/Lit with no per-framework editor wrappers, riding the Phase-49 grid focus model and surviving Phase-53 row virtualization, all editing OFF by default (byte-identical to today's table).
**Requirements**: SPEC reqs 1-11 (see 51-SPEC.md; phase_req_ids null — SPEC-internal numbering, as in prior @rozie-ui phases)
**Depends on:** Phase 49 (grid focus model) + Phase 53 (row windowing) — both shipped. Phase 50 (expandable rows) is NOT a hard technical prerequisite (confirmed in 51-SPEC.md); editing is independent and was prioritized ahead of 50/52.
**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 51-01-PLAN.md — Wave-0 D-02 pin-row probe + clipboard-permission spike + data-table-edit.spec.ts scaffold + edit/virtual/probe demo fixtures (req-9, req-11)

**Wave 2** *(blocked on Wave 1)*

- [x] 51-02-PLAN.md — Column editable config + data model:true slice + writeData funnel + display↔editor branch + built-in editors + #editor slot + edit lifecycle + write-back + sync validation (D-01) + byte-identical-off (req-1,2,3,4,5,10)

**Wave 3** *(blocked on Wave 2)*

- [x] 51-03-PLAN.md — full-row edit: editingRowIndex + rowDraft + Shift+F2 + editRow verb + one model write + row-edit-commit + Escape-reverts-row (req-6) — DONE 2026-06-19, commits f849a33d (feat: state + beginRowEdit/commitRow/cancelRow + Shift+F2 + editRow verb + manifests) + 336d4cf2 (test: full-row VR ×6 + demo row-commit readout + byte-identical-off re-verify). isEditing covers BOTH modes via one predicate (RESEARCH Pattern 6, no editor-template fork); rowDraft keyed-by-columnId so simultaneous editors own their own draft; commitRow validates every edited col (D-01 keep-open) → ONE replaceRowValues fresh-array write + ONE row-edit-commit { rowId, changes } (changed-cols-only). Source-only → dist-parity 875/875 + ZERO drift; data-table-edit VR 30/30 (full-row block green ×6, 6 fixme remain for 51-04); grid+virtual 66/66 (no read-only regression); typecheck 13/13. UNPUSHED on main.

**Wave 4** *(blocked on Wave 1 probe + Wave 3)*

- [x] 51-04-PLAN.md — cell-range selection (index-based, one-way) + clipboard copy/paste TSV (D-03 skip-invalid, T-51-01 paste-as-text) + drag-fill (D-04 value-copy) + pin-row wired into real windowing (req-7,8,9,10) — DONE 2026-06-19, commits 4779cf5c (feat: index-based range + getSelectedRange verb + range-change event, model:true stays 10) + 5d84db4d (feat: clipboard TSV copy/paste D-03 skip + N-of-M announce + drag-fill D-04 value-copy + T-51-01 paste-as-text verified ×6) + cbe16b6b (feat: D-02 pin-row union + getMeasurements spacer subtraction wired into real windowing — editor + index-based range survive recycle, req-9). Caught+fixed 3 cross-target bugs (focus-settle range-collapse ×6, Shift+Click-via-mousedown ×6 since focusin has no shiftKey, React ROZ138 stale-read emit). Byte-identical-off FINAL: dist-parity bootstrap ZERO drift (virtual + non-virtual) + 875/875 parity; typecheck 13/13; data-table-edit VR req-7/8/9 promoted to real ×6; read-only grid+virtual VR 66/66 (no regression). One pre-existing Plan-02 editor-open flake deferred (deferred-items.md). UNPUSHED on main.

**Wave 5** *(blocked on Wave 4)*

- [x] 51-05-PLAN.md — editing USAGE/HANDLE_USAGE docs ×6 + no-adapter/props-table validators + full data-table-edit.spec.ts green ×6 single-worker in the pinned container (req-10,11) — DONE 2026-06-19, commits b26c54bf (docs: SET_D editing USAGE — editable/editor/editorOptions/validate + r-model:data + @cell-edit-commit/@row-edit-commit + #editor slot in each target idiom + editRow/getSelectedRange in HANDLE_USAGE, regen 6 READMEs) + bce89f78 (test: root-cause the editor-open-after-Escape flake — focusBodyCellStable holds focus across a settle window + enterEditAt settles to grid-idle/full-unmount before F2; retire stale fixme prose). PHASE GATE GREEN: tools/ci-repro/vr.sh data-table-edit → 48/48 (8 blocks ×6), exit 0, pinned Linux container single-worker, ZERO permanent fixme (KNOWN_FAILING empty; runnerFor build-gate keeps the lone test.fixme, P49/P53 precedent); typecheck 168/168; dist-parity bootstrap 327 fixtures ZERO drift; assertNoAdapterImport green (no editor adapter); validateDocsPropsTable green (18 rows). Flake was a HARNESS-timing artifact (component focus-return correct), fixed in the spec only — no DataTable.rozie change. 51-VALIDATION.md → wave_0_complete: true. UNPUSHED on main.

### Phase 52: @rozie-ui/data-table grouping — ABSORBED into Phase 50 (TanStack round-out)

**Goal:** Folded into Phase 50. Grouping (`getGroupedRowModel` + aggregation + group-header rows)
is co-designed with expandable rows + faceted filtering under the Phase-50 round-out so the shared
sub-row render seam is built once. Do not plan this phase number directly — see Phase 50.
**Requirements**: see 50-SPEC.md
**Depends on:** n/a (absorbed)
**Plans:** 0 plans (absorbed)

### Phase 53: @rozie-ui/data-table virtualization (row windowing; traction-gated; grid-nav must be windowing-aware)

**Goal:** Opt-in vertical row virtualization for @rozie-ui/data-table built on @tanstack/virtual-core (peer dep, no per-framework adapter) — byte-identical when off, and when on renders only viewport-near rows while keeping grid keyboard-nav, accessibility (aria-rowcount/rowindex), sticky header, column pinning, row selection, and #cell slot dispatch correct across the window boundary; the published row-count ceiling is dropped to a falsifiable tested-to figure.
**Requirements**: SPEC reqs 1-11 (see 53-SPEC.md; phase_req_ids null — SPEC-internal numbering, as in prior @rozie-ui phases)
**Depends on:** Phase 52
**Plans:** 6/6 plans complete

Plans:
**Wave 1**

- [x] 53-01-PLAN.md — virtual-core peer dep on six leaves + extend codegen no-adapter guard (req-4)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 53-02-PLAN.md — windowing engine in DataTable.rozie: props, virtualizer wiring, spacer-tr slice, aria mapping, maxHeight/token, pagination suppression, byte-identical-off (req-1,2,3,6,9,10)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 53-03-PLAN.md — 100k + non-uniform-height demo fixtures + Wave-0 measureElement alignment probe (req-2,11)
- [x] 53-04-PLAN.md — grid scroll-then-focus across the window boundary (double-rAF) + grid VR case (req-5)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 53-05-PLAN.md — docs/READMEs/comparison: virtualization usage set + props table + retire deferral + published tested-to ceiling (req-11)
- [x] 53-06-PLAN.md — windowing VR + DOM verification matrix: windowing/aria, var-height, bounded container, sticky+pinning, selection, pagination, #cell recycling (req-1,2,3,6,7,8,9,10)

### Phase 54: Rozie script partials — `.rzts` / `.rzjs` compile-time inline modules

**Goal:** A component author can split a large `<script>` block across `.rzts` (TS) / `.rzjs` (JS) script partials carrying full sigil-bearing reactive logic; the compiler inlines each partial's exported declarations into the host component's `<script>` AST BEFORE lowering, so a partial rides the host's single per-target lowering and reuses 100% of the existing sigil machinery (never a target-native composable). Byte-identical inline-vs-partial output across all six targets + all entrypoints; proven by decomposing `DataTable.rozie`'s ~3,200-line `<script>` into `expand.rzts` / `group.rzts` / `facet.rzts` with ZERO dist-parity drift.
**Requirements**: SPEC reqs R1–R8 (see 54-SPEC.md; phase_req_ids null — SPEC-internal numbering, as in prior @rozie-ui/toolchain phases). Decisions D-01..D-05 in 54-CONTEXT.md.
**Milestone:** v0.1.0 (D-05 — Dan's call; toolchain/author-surface feature wired into the current milestone rather than opening v0.2.0).
**Depends on:** Phase 50 (DataTable round-out provides the expand/group/facet surfaces extracted in the dogfood).
**Plans:** 6/6 plans complete

Plans:
**Wave 1**

- [x] 54-01-PLAN.md — Wave-0 scaffolding: inlineScriptPartials unit-suite stubs (R1–R7) + inline-vs-partial dist-parity fixture pair + bootstrap registration + negative-route stub

**Wave 2** *(blocked on Wave 1)*

- [x] 54-02-PLAN.md — core routing + single-level inline splice: resolver extensions, LowerOptions threading, inlineScriptPartials pass wired first in lowerToIR (R1, R2, R3)

**Wave 3** *(blocked on Wave 2)*

- [x] 54-03-PLAN.md — inline robustness: import hoist/dedup, recursive partial inline + cycle detection, ROZ139 collision, source-map fidelity (R4, R5, R6, R7)
- [x] 54-04-PLAN.md — entrypoint threading + negative routing: resolver into all 7 unplugin lowerToIR calls; .rzts/.rzjs fall through resolveId/sidecar/babel guards (R1)

**Wave 4** *(blocked on Wave 3)*

- [x] 54-05-PLAN.md — dist-parity parity proof: cold build, bless inline-vs-partial fixtures, un-skip parity/smoke/negative gate (R2, R3)

**Wave 5** *(blocked on Wave 4)*

- [x] 54-06-PLAN.md — dogfood: decompose DataTable.rozie into expand/group/facet .rzts partials, regen leaves, data-table VR x6 (R8) — DONE 2026-06-20 (continuation after decision checkpoint). Extracted to src/{expand,group,facet}.rzts; DataTable.rozie thinner orchestrator (3 mid-body imports); codegen.mjs absolute host filename at both compile+lowerToIR sites. DECISION Option-1 code-byte-identical: react/angular/lit byte-identical, solid(-3)/svelte(-34)/vue(-34) comment+blank-line ONLY (no code token changed ×6; svelte/vue de-dupe a doubled comment header). Gate: build 135/135, leaf typecheck 11/11, dist-parity 881/881 (zero fixture drift), turbo test 85/85, **data-table VR 168/168 ×6 green in pinned container (roundout/grid/edit/virtual)**. Commit 4b75579f. Option-B follow-up todo filed (decouple @babel/generator emit-location from source-map-location to restore literal byte-identity w/o sacrificing R7).

### Phase 55: Script-partial literal byte-identity — decouple @babel/generator emit-location from source-map-location so spliced .rzts/.rzjs nodes emit with host-position spacing/comment placement while retaining .rzts origin in the source map; reclaims literal byte-identity for large-component partial extraction (closes the Phase 54 code-byte-identity override) without sacrificing R7 source-map fidelity

**Goal:** Spliced `.rzts`/`.rzjs` partial nodes emit with host-position spacing/comment placement — reclaiming LITERAL byte-identity (comments + blank lines) for large-component partial extraction (closes the Phase 54 code-byte-identity override) — while their source maps still resolve to the `.rzts` origin (file + line), preserving R7 fidelity.
**Requirements**: SC-1 (literal byte-identity x6: synthetic comment-bearing oracle + DataTable), SC-2 (R7 maps resolve to .rzts origin file+line), SC-3 (dist-parity >=881 + both oracles 6/6 + turbo test + data-table VR x6), SC-4 (Phase 54 override retired)
**Depends on:** Phase 54
**Plans:** 4/4 plans complete

Plans:

- [x] 55-01-PLAN.md — Wave 1: comment-bearing oracle fixture pair + skipped literal byte-identity gate + pending R7-line/source-map assertions (Nyquist scaffold) [SC-1, SC-2]
- [x] 55-02-PLAN.md — Wave 2: normalizeSplicedEmitLines seam (host-contiguous emit-line + .rzts origin stash) + bless comment-bearing oracle 6/6 [SC-1, SC-2]
- [x] 55-03-PLAN.md — Wave 3: composeMaps line-restore (R7 line fidelity) + un-skip spliced-statement source-map assertion [SC-2]
- [x] 55-04-PLAN.md — Wave 4: DataTable DIRECT re-bless to literal byte-identity x6 + full gate + container VR x6 + override retirement [SC-1, SC-3, SC-4]

### Phase 56: Script-partial cross-target comment-placement parity — generalize strict byte-identity (×6) to ARBITRARY partial boundaries so real large-component decomposition is lossless

**Goal:** Make spliced `.rzts`/`.rzjs` partial extraction byte-identical across all six targets at ANY boundary shape — not just the "clean" boundaries (a partial trailing into a no-leading-comment successor) that Phase 55 happened to cover. Fix the emitter/inliner comment-placement parity gaps that today force solid/svelte/vue (and one react case) to diverge when a partial seam abuts a commented declaration, a shared-comment module-`let`, or a zero-blank adjacency. Acceptance proof: the full ~16-partial DataTable.rozie `<script>` decomposition (host `<script>` ~3125 → ~650 lines) compiles byte-identical ×6.

**Why:** Phase 55 achieved literal byte-identity ×6 for the existing `expand`/`group`/`facet` partials, but those sit at clean boundaries (trailing into `$onMount`/`$expose`/imports). Dogfooding a real decomposition of DataTable's ~2900-line `<script>` (2026-06-20) proved arbitrary boundaries still drift, blocked by three emitter-parity gaps the synthetic HostC/HostD oracles never exercised — under strict-×6 only 3 of 16 candidate partials are extractable today. So the partial feature's headline use case (reorganize a giant component at zero compiled-output cost) is gated on this fix. Diagnosed in quick-task 260620-jyc (`DECOMPOSE-PLAN.md`, `SHIP-CLEAN-SUBSET-SUMMARY.md`); first 3 strict-clean partials already shipped (commit 587a38c6).

**Requirements (provisional — refine with `/gsd-spec-phase 56`):**

- SC-1: svelte/vue no longer DROP a comment at a partial's TRAILING seam when the next inline declaration has a leading comment (the keystone/dominant blocker).
- SC-2: `normalizeSplicedEmitLines` preserves the ORIGINAL gap above a spliced block — a zero-blank (gap-0) source adjacency stays gap-0, no spurious injected blank (e.g. `columnChrome` after `const tick`, `fillDrag` after `let fillDragUp`).
- SC-3: a module-`let` whose adjacent comment is SHARED with a neighbor declaration reproduces that comment placement on all six emitter families when the neighbor is extracted into a separate partial (svelte/vue duplicate vs solid/react object-dedup divergence).
- SC-4: react preserves an after-`let` leading comment at a partial boundary (the P15 case).
- SC-5 (acceptance/dogfood): the full ~16-partial DataTable decomposition per `DECOMPOSE-PLAN.md` compiles BYTE-IDENTICAL ×6 (contamination-immune A==B protocol); host `<script>` ~3125 → ~650 lines; HostC + HostD oracles stay 6/6; dist-parity stays green; a new multi-boundary DataTable-shaped dist-parity fixture added as a permanent guard; NO Option-1 tolerance reintroduced.

**Depends on:** Phase 55 (seam + line-restore), quick-task 260620-jyc (WR-01 block-split + the gap diagnosis).
**Plans:** 14/10 plans complete

- [x] 56-01-PLAN.md — R2 gap-0: thread originalGap onto SplicedEmitBlock (core) + HostF guard
- [x] 56-02-PLAN.md — R1 svelte/vue trailing-seam: broaden mirror trigger + HostE guard
- [x] 56-03-PLAN.md — R3 shared module-let: solid/react dedup suppression + HostG guard (5 shapes)
- [x] 56-04-PLAN.md — R4 react after-let: hoistModuleLet re-attach + HostH guard
- [x] 56-05-PLAN.md — R7 multi-boundary permanent guard fixture (HostMulti, DataTable-shaped)
- [x] 56-06-PLAN.md — R6 DataTable decomp Wave 1: P0/P1/P2 (A==B ×6)
- [x] 56-07-PLAN.md — R6 DataTable decomp Wave 2: P5/P6 (gap-0 dogfood)
- [x] 56-08-PLAN.md — R6 DataTable decomp Wave 3: P7/P8
- [x] 56-09-PLAN.md — R6 DataTable decomp Wave 4: P9/P10/P11/P12 (gap-0 dogfood)
- [x] 56-10-PLAN.md — R6 DataTable decomp Wave 5: P13/P14/P15 + final leaf-0-diff vs 4b75579f^ + host ~650 lines

### Phase 57: Vue emitter param-vs-`defineModel`-ref deconflict — the missing 4th shadow-deconflict case

**Goal:** When a closure/callback param shares the name of a `model:true` prop, the Vue emitter lowers `$model.x = x` to `x.value = x`, where the param shadows the `defineModel('x')` ref — so the write hits the string param, not the model ref, and `v-model:x` silently never updates. Add an emitter/lowering deconflict pass that renames such a shadowing param (and rewrites its in-scope references), gated to fire ONLY on a real collision so the existing corpus stays byte-identical ×6. This is the missing 4th case alongside `deconflictPropShadows` / `deconflictAccessorShadows` / `deconflictRefShadows`.

**Why:** Found dogfooding `@rozie-ui/captcha-vue@0.1.0` (2026-06-21) — the success callback `(token) => { $model.token = token }` emitted `const token = defineModel('token'); callback: (token) => { token.value = token }`; the param shadowed the model ref, so `v-model:token` never populated on solve. Vue-only (React/Solid lower `$model.x` to a `setX(...)` call — no same-named ref to shadow). A source workaround shipped in `@rozie-ui/captcha-vue@0.1.1` (renamed param → `response`), but any future component with a closure param matching a `model:true` prop name silently regresses the same way. Compiles + typechecks + surface-gates clean — a runtime semantic bug only a mount-and-drive test catches.

**Requirements (provisional — refine with `/gsd-spec-phase 57`):**

- SC-1: a closure param shadowing a `defineModel`-backed model ref is renamed in the Vue emit and its in-scope references rewritten — `x.value = x` becomes `x.value = <renamed>`.
- SC-2: the deconflict fires ONLY on a real param-vs-model-ref collision; the existing dist-parity corpus + target-`*` snapshots stay BYTE-IDENTICAL ×6 (no broad rebless / no over-apply, cf. the perl-rename-overreach lesson).
- SC-3: a new `examples/` fixture exercises the collision (callback/closure param == `model:true` prop name) with six byte-verified target outputs added to dist-parity as a permanent guard.
- SC-4 (design): settle Vue-only vs a shared deconflict pass, and silent-rename (matching the existing three passes) vs emitting a new ROZ diagnostic. Recommendation to validate: silent-rename, Vue-targeted (the shadow is Vue-`defineModel`-specific).
- SC-5 (verification/acceptance): the full emitter gate is green — `turbo run build --force` → dist-parity rebless/verify → target-`*` snapshot rebless/verify → typecheck-via-turbo → cold `turbo run test --force --continue` → pinned-Linux VR matrix; plus a behavioral proof that `v-model:x` populates for the collision fixture.

**Depends on:** the existing deconflict passes (refs-lowering-cross-target work — `deconflictProp/Accessor/RefShadows`); Phase 21 `$expose` / model-emit lowering.
**Plans:** 2/2 plans complete

### Phase 58: First-class prop documentation — `docs: { description, deprecated, example }` on `<props>`, surfaced as JSDoc ×6 + the docs props-table

**Goal:** Add a structured, optional `docs` object to each prop descriptor in the `<props>` block of `.rozie` sources — `docs: { description: string, deprecated?: true | string, example?: string }`. Lower it into the IR as `ir.props[i].docs` (single source of truth), then surface it two ways from that one field: (1) JSDoc on every target's synthesized prop type via one shared `buildPropJsdoc()` helper in `@rozie/core` so cross-framework parity holds — React interface members, Vue `defineProps<T>`, Svelte `$props`, Angular `@Input`, Solid props, Lit `@property`; (2) the docs props-table Description column, which `renderReadme` / `validateDocsPropsTable` already iterate over `ir.props` but today fill with empty descriptions. Mapping: `description` → leading JSDoc; `deprecated` (`true` → bare `@deprecated`, string → `@deprecated <msg>`); `example` (string) → `@example`.

**Why:** The props side of the docs story is empty — the docs props-table Description column ships blank, and consumers get zero IntelliSense prose on emitted prop types across all six frameworks. The event-manifest pattern (`scripts/event-manifest.mjs`) is itself a workaround for missing IR ("events… have no first-class `<emits>` IR source — so the prose lives here [in a hand-kept sidecar]"). Props can do better by putting the prose IN the source, co-located with each prop — impossible to drift, no sidecar, and it feeds BOTH docs and TypeScript from one field. This is the purest expression of the project thesis (one source → idiomatic docs + types across six frameworks, killing wrapper-maintenance). Surfaced while dogfooding `@rozie-ui/data-table-vue@0.1.0` (2026-06-23) — the prop types carry no descriptions in consumer IntelliSense.

**Requirements (provisional — refine with `/gsd-spec-phase 58`):**

- SC-1: the `<props>` parser accepts an optional `docs: { description, deprecated, example }` object per prop and lowers it to `ir.props[i].docs`; keys are whitelisted to `{description, deprecated, example}` with a NEW ROZ diagnostic on unknown/mistyped keys (`description` must be string, `deprecated` `true|string`, `example` string).
- SC-2: a single shared `buildPropJsdoc(docMeta)` helper in `@rozie/core` produces the JSDoc block (description + `@deprecated`/`@example` tags), consumed by all 6 target emitters at their prop-type synthesis site so output is parity-consistent.
- SC-3: JSDoc surfaces in each target's emitted consumer types — React interface member, Vue `defineProps<T>`, Svelte `$props`, Angular `@Input`, Solid props type, Lit `@property` — verifiable in the emitted `.d.ts`/SFC.
- SC-4: the docs props-table Description column (`renderReadme` / `validateDocsPropsTable`) is populated from `prop.docs.description`; deprecated props get a marker.
- SC-5 (inert-when-absent): a prop WITHOUT `docs` emits exactly as today — no JSDoc, zero change to the existing dist-parity corpus + target-`*` snapshots ×6 (capability ships cold; opt-in per family).
- SC-6: `docs` is stripped from any runtime prop-options emission (metadata only — never reaches runtime).
- SC-7 (pilot): opt `@rozie-ui/data-table`'s `.rozie` props into `docs:` and regen all 6 leaves + READMEs + docs props table; this is the only intended snapshot churn.
- SC-8 (verification/acceptance): full emitter gate green — `turbo run build --force` → dist-parity rebless/verify → target-`*` snapshot rebless/verify → typecheck-via-turbo → cold `turbo run test --force --continue` → pinned-Linux VR matrix; plus a new `examples/` fixture exercising a documented prop with byte-verified six-target outputs added to dist-parity as a permanent guard.

**Depends on:** the existing IR-lowering + per-target prop-type synthesis paths; the codegen docs pipeline (`renderReadme` / `validateDocsPropsTable`); the event-manifest / handle-manifest lockstep pattern as prior art.
**Plans:** 6/6 plans complete

Plans:

- [x] 58-01-PLAN.md — Red-first PropDocs.rozie fixture + EXAMPLES wiring + RED SC-1 unit test stub
- [x] 58-02-PLAN.md — Parser/IR: accept docs, lower to PropDecl.docs, ROZ018, SC-6 inert guard
- [x] 58-03-PLAN.md — Shared buildPropJsdoc() + renderPropsInterface thread + 5 trivial targets (React/Solid/Svelte/Angular/Lit)
- [x] 58-04-PLAN.md — Vue target (hard): defineProps/defineModel JSDoc, vue-tsc-gated Open-Q1 resolution
- [x] 58-05-PLAN.md — data-table pilot: README Description column + DataTable.rozie docs + regen 6 leaves (SC-4/SC-7)
- [x] 58-06-PLAN.md — SC-5 inert-when-absent proof + full 7-step SC-8 emitter gate

### Phase 59: Prop-doc single source of truth — close the data-table loop + build reusable rollout machinery

**Goal:** Make a prop's `.rozie docs:` field (shipped in Phase 58) the SOLE origin of its documentation across three surfaces — the package README props table, the JSDoc on all six target types (already universal via `buildPropJsdoc`), AND the VitePress docs-site API props table — proven end-to-end on the data-table pilot family, with the supporting machinery built to be drop-in for the remaining 18 families. Concretely: (1) factor the Description-column logic (`renderPropDescription` + `escapeTableCell`, incl. the WR-03 unmatched-backtick guard) out of `packages/ui/data-table/scripts/readme.mjs` into a shared `@rozie/core` codegen helper consumed by every family's `readme.mjs`; (2) migrate/enrich the rich hand-authored prose currently in `docs/components/data-table-api.md`'s `## Props` Description column INTO `DataTable.rozie`'s `docs:` fields (enrich, not copy — today's `docs:` descriptions are shorter than the `-api.md` prose); (3) make `data-table-api.md`'s `## Props` table GENERATE from `ir.props[].docs` and RETIRE the hand-authored table (extend `docs/scripts/gen-usage-pages.mjs` or a small dedicated generator the `-api` page includes); (4) verify via the full emitter gate plus a VitePress docs build.

**Why:** Phase 58 created the `docs:` source field and wired it to JSDoc (universal across six targets) + the data-table package README — but the docs *site* API table is still hand-authored prose that can silently drift from the `.rozie` source, and the Description-column logic exists only as a single per-family copy in data-table's `readme.mjs`. Closing the loop on ONE family proves the source → (README + JSDoc + docs-site) round-trip and turns the fan-out to the other 18 families into a turn-the-crank recipe (author `docs:` prose + flip two switches) rather than a per-family re-derivation. This is the purest expression of the project thesis: one co-located source field → idiomatic docs + types everywhere, impossible to drift.

**Requirements (provisional — refine with `/gsd-spec-phase 59`):**

- SC-1: the Description-column codegen (`renderPropDescription` + `escapeTableCell`, incl. the unmatched-backtick guard) lives in a single shared `@rozie/core` codegen helper; data-table's `readme.mjs` consumes it (no local copy remains).
- SC-2: `DataTable.rozie`'s `docs:` descriptions are enriched to carry the full prose previously hand-authored in `data-table-api.md` (no information lost in the migration).
- SC-3: `data-table-api.md`'s `## Props` table is GENERATED from `ir.props[].docs`; the hand-authored table is retired; the rendered site table matches the source prose.
- SC-4 (MANDATORY — family-agnostic): the docs-site props-table generator has ZERO data-table-specific assumptions — it renders any family's API props table from that family's IR (`ir.props[].docs`); proven on data-table but structurally general.
- SC-5 (MANDATORY — rollout recipe): `packages/ui/ADDING-A-FAMILY.md` gains the prop-docs rollout recipe so the remaining 18 families are turn-the-crank (author `docs:` prose + wire the shared helper + flip the docs-site generator), not a re-derivation.
- SC-6 (byte-identity): docless props stay byte-identical (emitter-seam discipline holds); the ONLY intended churn is the data-table pilot (its `.rozie`, leaves, README, and generated `-api.md` table).
- SC-7 (acceptance gate): full emitter gate green — `turbo run build --force` → dist-parity verify → typecheck-via-turbo → cold `turbo run test --force --continue` — PLUS a VitePress docs build (run with `--max-old-space-size=6144` per the known OOM) that renders the generated data-table props table.

**Boundary:** Broad fan-out to the other 18 families is OUT of scope here (deferred to a follow-up phase) — this phase proves the loop on data-table and ships the reusable machinery + recipe only.
**Depends on:** Phase 58 (the `docs:` field, `buildPropJsdoc`/`hasPropJsdoc`, the shared `renderPropsInterface`); the codegen docs pipeline (`renderReadme`/`validateDocsPropsTable`); the docs-site generation pipeline (`docs/scripts/gen-usage-pages.mjs`).
**Plans:** 4/4 plans complete

Plans:

- [x] 59-01-PLAN.md — Extract shared @rozie/core Description-column helper + family-agnostic renderPropsTable generator + slider generality test (SC-1, SC-4)
- [x] 59-02-PLAN.md — data-table pilot: rewire readme.mjs to core helper, migrate full -api.md prose into DataTable.rozie docs.description, swap -api.md table for rozie-props fence + adjust validator, regenerate leaves/READMEs (SC-1, SC-2, SC-6)
- [x] 59-03-PLAN.md — docs-site props-codegen.ts markdown-it plugin (rozie-props fence → renderPropsTable html_block) + config.ts wiring (SC-3, SC-4)
- [x] 59-04-PLAN.md — ADDING-A-FAMILY.md prop-docs rollout recipe + full four-gate turbo acceptance + OOM-flagged VitePress docs build (SC-5, SC-6, SC-7)

### Phase 60: Next-round pure-Rozie headless families — tags/token input, NumberField (stepper), and pagination (three no-engine families in the otp/dialog/combobox/listbox/slider lineage; each shipped ×6 targets via the dist+source standard with VR + docs + ADDING-A-FAMILY recipe; plans split per family plus shared scaffolding; deliberately-unstyled headless primitives — caret-between-chips + paste-split + dedup for tags, clamp/step/hold-accel/locale-format/scrub for numberfield, sliding-window ellipsis page-model for pagination)

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 59
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 60 to break down)

### Phase 61: Cross-target name-collision systemic fix — proactive collision linter + generalized auto-deconfliction

**Goal:** Make author-side name collisions proactively avoidable instead of discovered one-by-one at per-leaf typecheck (gate 3) / Angular `ng-packagr` build (gate 4). Turn the prose collision catalogue (memory `project_pure_rozie_collision_classes_2026_06` + playbook §6 + `ADDING-A-FAMILY.md`) into compiler data via two additive halves. **Half A** (emitter, byte-identity-gated): generalize each target's EXISTING deconfliction (`deconflict.ts` groups, Phase 57 `deconflictGeneratedSymbols`) so EVERY internal author-identifier kind (`<data>`, `$computed`, `<script>` helpers/lets/fns, `$refs`, `$inject` locals, imports) is checked against the FULL per-target reserved set and auto-renamed (`X$local` suffix / import alias). **Half B** (core semantic validator, additive / no-rebless): a per-target reserved-name DATA TABLE × every PUBLIC-CONTRACT identifier (props plain+model, slot names, emit names, `$expose` verbs, `$provide`/`$inject` keys) → actionable ROZ error with did-you-mean, checked against the UNION of shipped targets; folds in and widens ROZ127 (slot==prop) + ROZ137 (expose verb → full Lit Groups A/B/C + Angular lifecycle/`constructor`/CVA). Answers Dan's flagged "why do we STILL have naming collisions?"

**Success Criteria:**

- SC-1: per-target reserved-name tables encoded as compiler data, sourced from the completed research (`.planning/research/collision-linter/`).
- SC-2: Half A auto-deconflicts all internal kinds — a red-first fixture per target proving a previously-colliding internal name now compiles clean ×6; byte-identity / dist-parity reblessed.
- SC-3: Half B lint fires ROZ error + did-you-mean for each public-contract collision class, SILENT danger tier FIRST (Vue props `key`/`ref`/`is` strip; React `key`/`ref`/`children` swallow; Svelte runtime-only loop-var==snippet / slot-param shadow — none caught by any typecheck today).
- SC-4: every known catalogue case has a regression fixture (Lit `inputMode`/`id`/lifecycle/`$computed`-getter; Angular `writeValue`/CVA/lifecycle; React declare-then-assign ref + `hoistModuleLet`-misses-`$expose`; Solid `<data>`/`$computed` ungrouped; Vue generated-binding shadow + reserved props; Svelte runtime-only).
- SC-5: full emitter gate green — compile×6, typecheck×4, build×6 (incl Angular `ng-packagr`), dist-parity, `turbo run test`.

**Requirements**: TBD — derive during planning (per-target reserved tables, Half A emitter generalization ×6, Half B validator, SILENT-tier-first lint, catalogue regression fixtures, full-gate green).
**Depends on:** the existing deconflict infrastructure — Phase 57 `deconflictGeneratedSymbols`; `packages/core/src/rewrite/deconflict.ts` (`deconflictRef`/`Accessor`/`Prop`/`ReservedClassFields`); ROZ127 `validateSlotPropCollision`; ROZ137 `exposeReservedMemberValidator`; ROZ202 `reservedIdentifierValidator`; ROZ420 (Vue ref-shadow). Not functionally blocked by Phase 60 (independent compiler-hardening work).
**Plans:** 9/9 plans complete

Plans:

- [x] 61-01-PLAN.md — shared reserved-name data module (single source of truth) + widened reservedClassMembers + new ROZ codes (SC-1)
- [x] 61-02-PLAN.md — Half B public-contract collision linter (ROZ142) + widened ROZ137 + generalized ROZ127, SILENT-tier-first (SC-3)
- [x] 61-03-PLAN.md — Half A Lit: route $computed + $inject-local through reserved-class-field rename (SC-2)
- [x] 61-04-PLAN.md — Half A Angular: single-model-gated CVA set + data/computed/ref/inject-local rename (SC-2)
- [x] 61-05-PLAN.md — Half A React: declare-then-assign ref + hoistModuleLet-expose + synthesized-internal group (SC-2)
- [x] 61-06-PLAN.md — Half A Solid: data/computed/ref/emitter-local/import binding groups + expose-vs-computed (SC-2)
- [x] 61-07-PLAN.md — Half A Vue: generated-binding + vue-import deconfliction group (SC-2)
- [x] 61-08-PLAN.md — Half A Svelte: RUNTIME-ONLY slot-param/loop-var==helper auto-fix + computed==slot + emitter-name group (SC-2)
- [x] 61-09-PLAN.md — catalogue regression suite + full-gate green + dist-parity (SC-4, SC-5)

### Phase 62: @rozie-ui/date-picker range selection — `selectionMode='range'` + customizable presets + direction-agnostic hover-preview

**Goal:** Extend the existing single-date `DatePicker.rozie` (no new family) with a `selectionMode: 'single' | 'range'` prop so it selects a date RANGE with hover-preview highlighting and an optional preset rail ("Last 7 Days", "This Month"), authored once and compiled ×6 (React/Vue/Svelte/Angular/Solid/Lit). `selectionMode='single'` (default) is byte-identical to today — full backward compatibility. The branchy range math (per-day `inRange`/`inPreview`/`rangeStart`/`rangeEnd` flags, endpoint ordering, preview band, preset resolution) lands in the existing pure, unit-tested `src/internal/buildMonthGrid.ts` vendored into every leaf. Selection is **direction-agnostic**: the first click is an anchor, not a forced start — clicking today then a week earlier yields the identical range to the reverse, at both the preview and commit steps via `min`/`max` ordering. Approved design spec: `docs/superpowers/specs/2026-06-25-datepicker-range-support-design.md`.

**Success Criteria:**

- SC-1: `selectionMode` prop ships with `'single'` default; the single-date path is unchanged (dist-parity bootstrap ZERO drift on the existing single-mode output ×6).
- SC-2: range mode selects two endpoints with a fully-controlled value (`value: string | {start, end}` via `type: [String, Object]` → `string | Record<string, any>`), one new view-only `$data.hoverIso`, no other local date state; Angular CVA `writeValue`/`registerOnChange` accept the union.
- SC-3: direction-agnostic — a unit test asserts anchor-then-earlier and earlier-then-anchor click orders produce the identical ordered `{start, end}`; hover preview spans `min(anchor,hover)…max(anchor,hover)` (backward preview never suppressed).
- SC-4: customizable presets — `presetRanges: Array<{ label, range }>` (prop named `presetRanges`, NOT `presets`, to clear the ROZ127 collision with the `#presets` slot — research finding) where `range` is a literal `RangeValue` OR a `() => RangeValue` thunk (thunks recompute on click); default `<button>` rail renders with active-state on the matching preset; `#presets` slot overrides the rail.
- SC-5: `change` fires on every model write (anchor-only AND complete); `rangeComplete` fires when the second endpoint lands; `clear()` writes the mode-appropriate empty.
- SC-6: full emitter gate green — compile×6, typecheck×4 (incl the object-payload model round-trip through React/Vue setters), build×6 (incl Angular `ng-packagr`), dist-parity reblessed; pure-helper unit tests; VR cells ×6 with Linux baselines (forward preview, backward preview, completed cross-month range, preset-active) + behavior assertions (not snapshot-only); docs (api/usage/demo) regenerated.

**Requirements**: TBD — derive during planning from the approved spec (buildMonthGrid range extension + pure helpers, `.rozie` range commit funnel + presets + hover, polymorphic value normalization, `#presets` slot + `rangeComplete` event, ×6 regen + `.d.ts`, VR + docs). Object-payload model round-trip risk RESOLVED by `62-RESEARCH.md` (works ×6, no model-machinery change); ROZ127 `#presets`-slot-vs-prop collision resolved by naming the prop `presetRanges`.
**Depends on:** the shipped Phase-(date-picker) single-date family — `packages/ui/date-picker/src/DatePicker.rozie` + `src/internal/buildMonthGrid.ts`; the union-prop-type support in all six `renderType` emitters; the dist+source ×6 family standard (`ADDING-A-FAMILY.md`).
**Plans:** 5/5 plans complete

### Phase 63: @rozie-ui/data-table grid mode — correctness hardening + full behavioral test battery

**Goal:** Eliminate the 26 audited correctness bugs in DataTable grid mode (the flagship component) and land four locked feature expansions, each gated by a RED-FIRST 6-target behavioral spec (prove the bug/gap across targets → fix in shared `.rzts`/`.rozie` → re-emit + re-bless dist-parity/VR → green), then round out a comprehensive Playwright behavioral battery covering every grid feature set. Findings come from four read-only audits (focus/nav, range/clipboard/fill, edit-lifecycle, data-model integration), each verified against source AND Lit+Solid compiled output — shared-logic bugs, not emitter divergence. Working doc: the consolidated audit (scratchpad `grid-audit-consolidated.md`). Follows the shipped grid stack: Phase 49 (role=grid nav), 50 (grouping/expand/facet), 51 (editable cells), 53 (virtualization). Three concerns:

- **(A) 12 P1 bugs [data-loss / keyboard-trap]:** B1 click-away-to-another-cell wedges grid (built-in editor stuck + nav frozen); B2 type-to-edit loses leading char (unconditional `el.select`); B3 number editor commits string not `Number`, empty commits `''` not `null`; B4 Shift+Tab advances forward; B5 last-cell Tab drops focus to `<body>`; B6 empty/all-filtered grid has zero tab-stops (keyboard-unreachable + focus lost on filter-to-empty); B7 fill-drag clobbers multi-column data + wrong source on up/left drag; B8 range corners never clamped/cleared on sort/filter/paginate (stale range + phantom copy rows); B9 paste stores raw strings, no coercion; B10 TSV copy/paste no tab/newline/quote escaping; B11 Ctrl+C/V fire while a header cell is active (silent body mutation — borderline P0); B12 grouped multi-level headers break the roving invariant (multiple `tabindex=0`) + ArrowUp resolves the wrong header.
- **(B) 14 P2 bugs:** B14 `focusCell` emits on no-op; B15 `getActiveCell` blind to header-active; B16 verbs not `isGrid`-gated; B17 PageDown-from-header lands row 0; B18 `extendRange` emits on clamped no-op; B19 `clearRange` never emits; B20 fill-drag spams `range-change`; B21 row-mode Tab escapes the row (nav frozen); B22 row-mode validation focuses first editor not the offending one; B23 commit-under-sort/filter relocates/loses focus; B24 type-to-edit/Space on checkbox/select seeds nonsense; B25 `clampActiveCell` never re-focuses on programmatic shrink (focus to `<body>`); B26 drop-in vs built-in click-away commit inconsistency; B27 paginated grid missing `aria-rowindex`.
- **(C) 4 LOCKED feature expansions (Dan, 2026-06-26):** **C1** unify the focus index to the ABSOLUTE filtered+sorted position (`getPrePaginationRowModel`) in BOTH paginated and virtual modes + add `getRowIndexRelativeToPage()` converter + `aria-rowindex = abs+1` (research-backed — AG Grid/Glide/react-data-grid/SlickGrid/Handsontable all absolute; viewport-relative is impossible for off-window `focusCell`); **B13** full virtual↔grouping/expand/`#detail` render parity in the windowed `<tbody>` (`isExpanderColumn`/`cellIsGrouped`/`#detail` branches + `data-group` markers + `bodyCellStyle` indent) ×6; **C2** treegrid row semantics (active cell lands on group rows + `aria-expanded` + treegrid roles/`aria-level`); **C3** range-tiling paste (single→range fill, smaller-tiles-into-larger) + Cut (copy + clear source through the write-funnel).

**Success Criteria:**

- SC-1: each of the 26 bugs has a RED-FIRST behavioral spec that FAILS on the buggy build across the affected targets, then PASSES after the fix — no bug cemented in a snapshot (house rule).
- SC-2: C1 — `focusCell`/`getActiveCell`/`activecell-change` address the absolute filtered+sorted row in BOTH paginated and virtual mode; `getRowIndexRelativeToPage()` ships; `aria-rowindex = abs+1` on every body row; a spec pins identical `focusCell` semantics across modes (closes B27 for free).
- SC-3: B13 — a virtual+expandable grid renders the chevron and a `#detail` row; a virtual+groupable grid renders the group toggle + `(n)` count + depth indent — parity with non-virtual, asserted ×6.
- SC-4: C2 — group-header rows are addressable grid cells with `aria-expanded` + treegrid row semantics; Enter toggles; nav coherence asserted.
- SC-5: C3 — paste a single cell into a selected range fills it; a smaller clipboard tiles into a larger selection; Cut copies then clears the source through the write-funnel (one `writeData`); copy/paste are no-ops while a header cell is active.
- SC-6: full emitter gate green — compile×6, typecheck×4, build×6 (incl Angular `ng-packagr`), dist-parity reblessed, `turbo run test` (cold) — validated via turbo, not `pnpm -r`.
- SC-7: the behavioral battery covers every grid feature set (range-selection, clipboard copy/cut/paste/escaping/coercion/tiling, fill-drag, edit-under-grid-nav, grouping nav + treegrid a11y, expand, virtual+groups parity, empty/all-filtered keyboard-reachability, header-active guards, `aria-rowindex`, RTL logical-nav contract) with BEHAVIOR assertions (not snapshot-only), Linux-rendered VR baselines.

**Requirements**: TBD — derive during planning. Likely plan split by concern/wave: P1-edit cluster (B1–B5,B21–B24,B26), P1-clipboard/fill cluster (B7–B11), P1-nav cluster (B6,B12), P2 sweep, then the four expansions (C1 index-unify, B13 virtual parity, C2 treegrid, C3 tiling+cut) each red-first, then the battery round-out + full-gate green.
**Depends on:** the shipped grid stack — `DataTable.rozie` + `gridFocusNav`/`gridKeydownHandlers`/`gridActiveCellVerbs`/`rangeSelection`/`clipboardFill`/`fillDrag`/`editCellLifecycle`/`editRowLifecycle`/`editorBindings`/`writeFunnels`/`virtualization`/`group`/`expand` `.rzts`; the VR host harness (`tests/visual-regression`) + existing `data-table-grid`(`.spec`/`-probe`) + `data-table-edit` specs; dist-parity + VR Linux-baseline tooling.
**Plans:** 10/10 plans complete

Plans:

- [x] 63-01-PLAN.md — Cell-edit-under-grid-nav cluster (B1,B2,B3,B4,B5,B24,B26) red-first ×6
- [x] 63-02-PLAN.md — Row-mode edit cluster (B21,B22,B23) red-first ×6
- [x] 63-03-PLAN.md — Clipboard/fill cluster (B7,B8,B9,B10,B11) red-first ×6
- [x] 63-04-PLAN.md — Nav-edge cluster: empty/all-filtered reachability + grouped headers (B6,B12) ×6
- [x] 63-05-PLAN.md — P2 emit-contract/gating/re-focus sweep (B14,B15,B16,B17,B18,B19,B20,B25) ×6
- [x] 63-06-PLAN.md — C1 absolute-index unify + getRowIndexRelativeToPage + aria-rowindex=abs+1 (closes B27)
- [x] 63-07-PLAN.md — B13 virtual ↔ grouping/expand/#detail windowed-body parity ×6
- [x] 63-08-PLAN.md — C2 group-header treegrid semantics (land + aria-expanded/level + Enter-toggle) ×6
- [x] 63-09-PLAN.md — C3 range-tiling paste + Cut ×6
- [x] 63-10-PLAN.md — Battery round-out: RTL contract + coverage audit + full ×6 gate + Linux baselines
- [x] 63-11-PLAN.md — Gap closure: C2 [solid] collapsed-coherence (post-collapse focus re-seat) + B6 [react] recovery-timing (gridEmptyFallback stale-immune let); treegrid + navedge GREEN ×6 in pinned Linux Docker
- [x] 63-12-PLAN.md — Code-review fixes: WR-01 full-row commitRow → pendingEditFollow B23 focus-follow (resolves IN-02) + Rule-1 row-value coercion; WR-02 React numeric-attr raw emit when nullability unprovable (resolves IN-01); WR-01 Docker 24/24 ×6, typecheck 278/278, dist-parity 1001/1001 no drift

### Phase 64: Headless windowing + listCore extraction — extract windowing.rzts + listCore.rzts into new @rozie-ui/headless-core source-only package; dedupe listbox/combobox/command-palette; add windowed long-list demo

**Goal:** Stand up a new source-only `@rozie-ui/headless-core` package that holds two shared `.rzts` script-partials — a generic `windowing.rzts` (TanStack `virtual-core` windowing math, lifted from data-table's `virtualization.rzts` behind a no-op pin-extension seam so B13 parity holds byte-for-byte) and a focus-/input-mode-parameterized `listCore.rzts` (collection model + arrow/home/end/enter reducer + type-ahead + single/multi selection + filter). Refactor data-table onto `windowing.rzts` and listbox/combobox onto `listCore.rzts` (collapsing the duplicated list logic), retire Listbox's combobox/filterable mode in favor of the standalone Combobox family, migrate command-palette to vendor Combobox ×6, and add windowed long-list support + a demo + red-first behavioral specs ×6 for listbox/combobox.

**Design doc:** `docs/superpowers/specs/2026-06-27-headless-windowing-listcore-design.md` (brainstorm-approved; load-bearing cross-package `.rzts`-resolution question resolved — `.rzts` are compile-time script-partials, resolved via enhanced-resolve + `exports`, dissolving into leaves with zero runtime dep).

**Requirements**: TBD — derive during planning. Likely plan split mirrors the design's P0–P4 sequencing: P0 prove the cross-package `.rzts` boundary ×6 (smoke partial + VR cross-tree registration) BEFORE moving real code → P1 extract `windowing.rzts` (data-table first consumer, existing virtual specs are the green gate) → P2 extract `listCore.rzts` (Listbox consumer) → P3 Combobox owns type-to-filter + retire Listbox combobox mode + migrate command-palette ×6 → P4 windowed long-list demo + red-first specs ×6 (budget Solid rAF-defer).

**Success criteria:**

- SC-1: `@rozie-ui/headless-core` exists as a source-only package (no codegen, no compiled leaves); a consumer imports a `.rzts` from it via bare specifier and compiles-inline + builds + mounts ×6 (proven in P0 before any real code moves).
- SC-2: data-table consumes `windowing.rzts` from `@rozie-ui/headless-core`; `data-table-virtual.spec.ts` + `data-table-grid-virtual-parity.spec.ts` stay green (B13 parity preserved); target zero emitter change.
- SC-3: Listbox + Combobox both consume `listCore.rzts`; the duplicated list logic is collapsed; existing listbox/combobox specs stay green.
- SC-4: Listbox's `combobox`/`filterable` props are retired; command-palette vendors the Combobox family ×6; command-palette specs stay green.
- SC-5: a windowed long-list demo renders a small windowed slice for a long option list ×6, backed by red-first behavioral specs (slice size, arrow-nav window scroll, selection survival, activedescendant tracking) with Lit shadow-piercing.
- SC-6: full emitter gate green — compile×6, typecheck×4, build×6, dist-parity reblessed if any `targets/*` touched, `turbo run test` (cold), Linux-rendered VR baselines.

**Depends on:** Phase 63 (stabilized `virtualization.rzts` / B13 windowed-body parity); the shipped `@rozie-ui/listbox`, `@rozie-ui/combobox`, `@rozie-ui/command-palette` families; the Phase 54 `.rzts` script-partial inline architecture (`inlineScriptPartials` + `ProducerResolver`/enhanced-resolve); the VR host harness + cross-tree bare-import registration (`resolveCrossTreeBareImports`/`prebuildExtraRoots`).
**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 64-01-PLAN.md — P0: prove the cross-package .rzts boundary x6 (smoke partial + VR cross-tree trio) [LOAD-BEARING HARD GATE] (SC-1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 64-02-PLAN.md — P1: extract windowing.rzts; data-table consumes it; B13 parity A==B (SC-2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 64-03-PLAN.md — P2: extract listCore.rzts; Listbox consumes it (select-only+multi+typeahead) (SC-3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 64-04-PLAN.md — P3: Combobox owns type-to-filter + retire Listbox combobox/filterable + migrate command-palette x6 (SC-3, SC-4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 64-05-PLAN.md — P4: windowed long-list demo + red-first specs x6 + full SC-6 emitter gate (SC-5, SC-6)

### Phase 65: Strict-null emitter conformance — React+Solid+Lit (Bundle C / Item 2)

**Goal:** Emitted React/Solid/Lit leaf code typechecks under `strictNullChecks` + `noImplicitAny` + `exactOptionalPropertyTypes` for the emitter-fixable error classes, so a strict consumer of a pure-Rozie family (combobox/slider/listbox) builds clean — and a real gate prevents silent regression. A diagnosis spike (2026-06-30) refuted the original "Solid/Lit only" premise: **Lit is also affected** (138 errs sampled) and the relaxed flags span **5 targets** (react/vue/svelte/solid/lit), with React equally affected (24 errs, identical classes). Vue/Svelte aren't plain-`tsc`-measurable (need vue-tsc/svelte-check; Vue is Phase 67/Item 3's domain). Driving to literal ZERO via the emitter alone is not realistic — Classes 1+2+5 are emitter-fixable; Classes 3/4/6 are inherent body-passthrough.

**LOCKED DECISIONS (Dan, 2026-06-30):**

- Fix **Class 1** (nullable prop → attr typed `string|null` not `…|undefined`; route nullable-prop attr reads through `rozieAttr()`/`?? undefined` like their wrapped siblings; Lit `@property` typing) + **Class 2** (narrow signal/data defaults — emit type args / widen null-defaulted signals to `T|null`) + **Class 5** (null iterable into `For`/`repeat`, fallout of Class 2) across **React + Solid + Lit together** (one shared root-cause pattern, one fix per target emitter; splitting just duplicates work).
- **Baseline-split gate** mirroring `tests/vue-typecheck/family-children.test.ts`: re-enable the 3 strict flags per-leaf as each goes clean; leaves with inherent residual (data-table) get a reported/baseline split that locks the residual and flips RED on regression or when the emitter improves.
- **Class 3 (`windowing.rzts` shared-helper `return null`→`never` narrowing, the TS2339 bulk): fence LIFTED as a SEPARATE gated task.** One authoring fix in `@rozie-ui/headless-core`'s `windowing.rzts` clears many leaves, BUT re-emits/reblesses data-table + everything sharing `headless-core` — **B13 / data-table A==B byte-identity MUST be re-verified**. Highest-risk plan; gate hard.
- Classes 4 (un-guarded nullable/`$refs` body reads) + 6 (noImplicitAny tail) = inherent body-passthrough, stay in residual (no fragile blanket `as any`/`!` injection).

**Requirements**: SC-1, SC-2, SC-3, SC-4, SC-5 (success criteria function as the requirement set — emitter-hardening phase, not requirements-registry-bound).
**Success criteria:**

- SC-1: Class 1 fixed in react+solid+lit emitters (`packages/targets/{react,solid,lit}/src/emit/**`) — nullable-prop attr bindings no longer typed `string|null` into JSX/property slots; red-first fixture per target proves the TS2322 pre-fix, byte-identity carve-out keeps non-nullable attrs unchanged.
- SC-2: Class 2 (+5) fixed — narrow signal/`<data>` defaults emit correct type args / widened types; `For`/`repeat` over those no longer TS2769.
- SC-3: pure-Rozie sample leaves (combobox/slider/listbox) reach strict-clean ×3 targets and have the 3 strict flags re-enabled in their leaf tsconfigs (the real gate); a new baseline-split conformance test locks data-table's inherent residual and flips RED on regression/improvement.
- SC-4 (separate gated task): Class 3 `windowing.rzts` authoring fix lands with **data-table A==B byte-identity re-verified** + B13 virtual parity specs green + full dist-parity rebless; residual baseline shrinks accordingly.
- SC-5: full emitter gauntlet green — red-first per class, `build --force` → dist-parity `bootstrap` (every drifted fixture a verified-intended typing change) → cold `test --force` → `typecheck --force` → Linux-rendered VR (never bless macOS PNGs).

**Depends on:** Phase 64 (`@rozie-ui/headless-core` `windowing.rzts` now lives here — Class 3 touches it); the shipped pure-Rozie families (combobox/slider/listbox) as the strict-clean canaries; the Bundle A vue-typecheck baseline-split gate as the gate pattern.
**Plans:** 4/4 complete (EXECUTED + VERIFIED, UNPUSHED on main)

Plans:

- [x] 65-01-PLAN.md — Class 1 nullable prop → attr `string|null`: react/solid rozieAttr/`?? undefined` carve-out + Lit `@property` widen; red-first witness + new `tests/strict-conformance/` harness; 0 dist-parity drift (commit `877184e1`, test `41a6c390`)
- [x] 65-02-PLAN.md — Class 2(+5) narrow signal/`<data>` defaults: type-arg widen ×3 targets; Class 5 = fallout; 6 fixtures reblessed (commit `231b7ac0`, test `1b4148e0`)
- [x] 65-03-PLAN.md — Baseline-split conformance gate. FINDING: 0 leaves fully strict-clean (inherent Class-4/6 body-passthrough) → 0 flags re-enabled, all 12 baselined; gate ships as regression lock 18/18 (commit `6656e31d`)
- [x] 65-04-PLAN.md — Class 3 `windowing.rzts` typed-wrapper fix (fence-lifted, ONLY that .rzts): **A==B byte-identity HELD** (dist-parity 0 drift / 1001-1001); combobox/listbox −8 TS2339, listbox/lit → enforced-clean; Dan-approved at blocking checkpoint (commit `f6f3817b`)

**Outcome (honest):** Class 1+2 emitter fixes (byte-identity-safe) + Class 3 cleared + a regression-locking baseline-split gate shipped. SC-3's "strict consumer of a pure-Rozie family builds clean" is NOT reached for any leaf — inherent Class-4/6 body-passthrough residual remains (known limitation; the locked baseline-split decision anticipated this — not a gap).

### Phase 66: Composed-component ref → Handle typing across all 6 targets (Bundle C / Item 1)

**Goal:** A `<components>`-composed child referenced via `$refs.X` is typed as that child's `$expose`-synthesized `<Name>Handle` — uniformly across all 6 targets — so `$refs.someChild.someExposedMethod()` typechecks everywhere. Verified current-source state (2026-07-01): **Angular alone** types composed-component refs correctly (`viewChild<ComponentType>()` via `collectComponentRefTypes`/`componentRefs.ts:33` matching `RefDecl.elementTag` against `ir.components[].localName`); **React, Vue, Svelte, Solid, and Lit all fall back to `HTMLElement`** because their ref-typing switches key only on `RefDecl.elementTag` (DOM cases) and never consult `ir.components` nor `synthesizeHandleType.ts`'s `<Name>Handle`. `RefDecl` (`packages/core/src/ir/types.ts:290`) carries no `isComponent`/`handleType` field. The single real fixture, `command-palette` (composes `Combobox`), works around the gap with a hand-written Lit shadow-pierce DOM query (`CommandPalette.rozie:249-256`, with an in-source comment attributing it directly to this gap). This is the "refs-lowering type gap" logged in the cross-family composition backlog (Option B / Phase 999.4 shipped self-contained; this closes the follow-on).

**LOCKED DECISIONS (Dan):**

- Bring the **5 broken targets (React/Vue/Svelte/Solid/Lit)** in line with Angular's component-instance approach: a composed-component ref types as the child's exposed `<Name>Handle`. Prefer a **shared core resolver** ("is this ref a composed component, and what is its Handle type") so all 6 share one source of truth rather than 6 copies of Angular's ad-hoc `elementTag`-vs-`ir.components` match.
- **Retire the command-palette Lit shadow-pierce workaround** for a real `$refs.combobox.focusControl()` handle call — the reward that proves the fix end-to-end (requires `focusControl` or equivalent exposed on Combobox and consumed from CommandPalette).
- **DEFER Option A** (per-target published-package resolution / leaf-to-leaf version graph / manifest) — out of scope; this phase is authoring-time-local composition only.
- Byte-identity carve-out **gated**: a `targets/<t>` edit re-emits every family's leaves for that target → commit all; **command-palette re-vendor / A==B re-verified** (it is the composition fixture and the only leaf whose emitted body should change).

**Requirements**: SC-1..SC-5 (success criteria function as the requirement set — emitter-hardening phase, not requirements-registry-bound).
**Success criteria:**

- SC-1 (Handle-INTERFACE route): **React** (`useRef<ComboboxHandle | null>`) and **Solid** (`let XRef: ComboboxHandle | null`) type a composed-component ref as the child's already-exported `<Name>Handle` interface (imported at the parent ref site); red-first typecheck witness proves the pre-fix `HTMLElement`-typed `$refs.child.method()` TS error. (Probe 2026-07-01: only react/solid ship a named `<Name>Handle`; see CONTEXT D-2.)
- SC-2 (component-INSTANCE route): **Vue** (`ref<InstanceType<typeof Child>>()`) and **Svelte** (`bind:this` component-instance type) type the composed-component ref as the child component instance — whose `defineExpose`/instance surface carries the exposed members — with NO named-Handle import and NO `codegen.mjs` barrel change; red-first witness each.
- SC-3: **Lit** composed-component ref typed as the child element class (`$expose` verbs are public members; `HTMLElementTagNameMap['rozie-<name>']` resolves the tag) — not `HTMLElement` — so the inner control is reachable without a shadow-pierce; **Angular** unchanged / regression-covered (already correct via `viewChild<ComponentType>`).
- SC-4: **command-palette Lit shadow-pierce workaround retired** — `CommandPalette.rozie:249-256` replaced by a real handle call; A==B byte-identity re-verified for command-palette (intended body change is the ONLY drift), full dist-parity rebless, VR blessed (Linux-rendered).
- SC-5: full emitter gauntlet green — red-first per target, `build --force` → dist-parity `bootstrap` (every drifted fixture a verified-intended change) → cold `test --force` → `typecheck --force` → Linux-rendered VR (never bless macOS PNGs). No auto-push.

**Depends on:** Phase 999.4 (cross-family composition authoring-time vendoring — the composition machinery + command-palette→vendored-combobox fixture this hardens); Phase 21 (`$expose` imperative-handle + `synthesizeHandleType.ts`); the existing Angular `componentRefs.ts` component-instance branch as the reference implementation.
**Plans:** 4/5 plans executed

Plans:

- [x] 66-01-PLAN.md — Shared core resolver (D-1) lifted from Angular + Angular refactored to consume it (byte-identical) + red-first 6-target witness harness (D-4)
- [x] 66-02-PLAN.md — React + Solid: composed-ref → `<Name>Handle` interface route (D-2 / SC-1); witness green; non-composed refs byte-identical
- [x] 66-03-PLAN.md — Vue + Svelte: composed-ref → component-instance route (D-2 / SC-2); no Handle import, no codegen.mjs change; witness green
- [x] 66-04-PLAN.md — Lit: composed-ref → child element-class route (D-2 Lit branch / SC-3); riskiest target; witness green — DONE 2026-07-01, commits `7e4fc8d4` (feat: emitRefField consumes resolveComponentRefs → `@query private _refX!: <ChildClass>` + additive `import type { <C> }` in userImports; DOM refs HTMLElement byte-identical) + `a1053c21` (test: witness lit RED→GREEN `FIXED_ELEMENT_CLASS_TARGETS`, full witness 7/7 no expected-fails; harness real-green sidecar `ExposeChild.rozie.d.ts` so the named `.rozie` type import resolves to the real element class — ambient `declare module` alone → TS2709 false-green). Gates: build 227/227, dist-parity 524, consumer-lit-ts (strict tsc) exit 0, lit-lint 4/4, target-lit 335/335. ZERO shipped lit-leaf drift (command-palette shadow-pierce CommandPalette.ts:295 UNCHANGED — retired in 66-05). react/solid/vue/svelte/angular emitters + codegen.mjs + RefDecl IR untouched. UNPUSHED on main.
- [x] 66-05-PLAN.md — command-palette shadow-pierce retirement (D-5 / SC-4): add `ref="combobox"`, swap `focusInput` to `$refs.combobox.focus()`, correct the stale "blocked" comment; re-vendor + A==B re-verify + full dist-parity rebless — DONE 2026-07-01, commits `c1a7e61c` (feat: source edit — ref on composed `<Combobox>`, `focusInput` → `$refs.combobox?.focus()`, shadow-pierce + stale comment removed; vendored Combobox untouched) + `dfcae95c` (feat: re-emit x6 with the typed handle call; codegen.mjs D-07 lit-plumbing extended to rewrite the P4 named element-class `.rozie` type import → default type import off the compiled sibling). Gates: build 227/227, dist-parity bootstrap 524, **typecheck 280/280** (the x6 `$refs.combobox.focus()` calls prove out in SHIPPED output — phase payoff), cold test 117/117, vendor-drift (A==B) GREEN. **command-palette is the SOLE drifting family** (6 CommandPalette.* leaves); every other family + vendored Combobox (D-3) byte-identical. Focus-path shadow-pierce GONE from all 6 emitted leaves. **Focus evidence** (macOS local, no baseline blessed): behavioral spec 5/5 light-DOM green (Lit fixme per known select-report backlog) + auto-focus probe **6/6 incl. Lit** — clicking open lands `document.activeElement` on `<input role="combobox">` via the typed handle. **LINUX VR BLESSING DEFERRED** to the human/CI-Docker step (macOS PNGs never blessed — `feedback_vr_linux_baselines`). UNPUSHED on main.

### Phase 67: Vue family-child emitter attr-nullability conformance toward baseline zero (Bundle C / Item 3)

**Goal:** Shrink the Vue family-child SFC vue-tsc baseline (`tests/vue-typecheck/family-children.test.ts`) toward zero by clearing the **emitter-fixable** error class in the Vue emitter — driving the listbox Vue leaf to fully clean and tightening data-table's baseline — while honestly baselining the inherent body-passthrough residual that no emitter change can fix (the Phase-65 finding, applied to Vue). Verified current-source (2026-07-01, post-Phase-66): the gate holds a per-family vue-tsc error-COUNT baseline (total **34**) over 3 families — **data-table `DataTable.vue` = 30** (TS2322:6, TS2345:9, TS7006:2, TS7022:1, TS7023:1, TS7053:11), **listbox `Listbox.vue` = 4** (TS2322:4), **sortable-list = 0** (enforced clean); it fails BOTH directions (regression OR improvement-without-baseline-tighten). Phase 66 did NOT shift it (only command-palette got a composed ref; not a gated family). Vue is the last strict-typecheck target unaddressed by the Phase-65 wave (react/solid/lit done there; Vue/Svelte weren't plain-`tsc`-measurable — Vue needs `vue-tsc`, this gate). Consumer builds are already clean (published `.d.ts` generated separately — see the data-table-vue consumer typecheck gap); this hardens the RAW `.vue` SFC bodies.

**LOCKED DECISIONS (Dan pattern — mirrors Phase 65):**

- Fix **Class A — attr-nullability TS2322** ONLY (10 total: data-table 6 + listbox 4): raw `:attr="expr"` bindings whose expression's inferred type includes `null`, bound to a DOM-attr slot typed `X | undefined`. Fix = emit `(expr) ?? undefined` for nullable-**shaped** bindings, porting react's Phase-65 `emitTemplateAttribute.ts` nullish-drop heuristics (Vue has NO `rozieAttr` path and does NO type inference → decide by expression shape, with provably-non-nullish exclusions to avoid TS2869 "unreachable right operand").
- **Class B — inherent body-passthrough (24, all data-table:** TS2345×9 script-body call sites, TS7006×2 inline-handler implicit-any, TS7022/7023 untyped recursive helpers, TS7053×11 `{}`/`Object.create(null)` index) stays baselined — NO `as any`/annotation injection into user `<script>` bodies (the Phase-65 discipline).
- **Baseline-split gate is the durable artifact:** as Class-A clears, TIGHTEN the baseline — listbox → `{}` enforced-clean (first Vue family to zero), data-table 30→24. The gate then locks the tightened residual and flips red on regression OR further improvement.
- Byte-identity carve-out **gated**: only nullable-shaped `:attr` bindings re-emit (`(expr) ?? undefined`); every non-matching binding byte-identical. Drift is BROADER than Phase 66 — ANY vue leaf with a nullable-shaped binding re-emits (intended) → audit each dist-parity drift as a correct `?? undefined` add.

**Requirements**: SC-1..SC-4 (success criteria ARE the requirement set — emitter-hardening phase).
**Success criteria:**

- SC-1: Vue emitter wraps nullable-shaped `:attr` bindings as `(expr) ?? undefined` in `packages/targets/vue/src/emit/emitTemplateAttribute.ts` (extending the `emitSingleAttr` binding branch / `normalizeNullAttrBinding`), porting react's shape heuristics; red-first fixture proves a nullable `:attr` TS2322 pre-fix and TS2869-clean post-fix.
- SC-2: All 10 Class-A TS2322 cleared — **listbox `Listbox.vue` → 0 vue-tsc errors** (baseline `{}` enforced-clean) and **data-table `DataTable.vue` 30→24** (6 TS2322 removed); baseline file tightened accordingly; gate green both directions.
- SC-3: Class-B inherent residual (24, data-table) untouched and correctly baselined; NO `as any`/annotation injected into `<script>` bodies; provably-non-nullish bindings NOT wrapped (no TS2869 introduced anywhere).
- SC-4: full emitter gauntlet green — red-first, `turbo run build --force` → dist-parity `bootstrap` (every drifted `:attr` binding a verified-intended `?? undefined` add; non-matching bindings byte-identical) → cold `test --force` → `typecheck --force` → vue-typecheck gate green → Linux VR (behavioral-neutral: `?? undefined`≡`null` for Vue attr presence, so VR pixel-neutral — Linux-CI-deferrable). No auto-push.

**Depends on:** Phase 65 (the react/solid Class-1 `?? undefined` heuristic being ported + the baseline-split gate pattern); the Bundle A `tests/vue-typecheck/family-children.test.ts` gate (the artifact this tightens); the shipped listbox/data-table Vue leaves as the subjects.
**Plans:** 1/2 plans executed

Plans:

- [x] 67-01-PLAN.md — Port react shape heuristic into Vue emitter (`(expr) ?? undefined` wrap) + red-first both-direction witness
- [ ] 67-02-PLAN.md — Tighten vue-typecheck baseline (listbox→0, data-table 30→24) + dist-parity drift audit + full gauntlet

### Phase 68: Playground modernization — family coverage + `.rzts` partials + dep bump + harness limits

**Goal:** Bring the `examples/playground/` (Vite + Monaco + TextMate editor, per-target sandboxed preview iframes, in-browser live `@rozie/core` compile) back up to date with the shipped project — it has been frozen at ~Phase 41 coverage while ~26 phases of families landed. Verified current-source survey (2026-07-01, read-only). **Note:** the original 999.2 premise ("multi-file `<components>` resolution fails") is STALE — that was RESOLVED in commit `7b390d4` (2026-05-20) via blob-URL specifier rewriting (`rewriteRelativeImports`/`importBundleWith` in `preview/_shared.js`); this phase retires that entry and does the actual freshening. Full scope confirmed by Dan (all 4 workstreams).

**LOCKED DECISIONS (Dan, 2026-07-01 AskUserQuestion — all four selected):**

- **WS1 — Family coverage + `.rzts` partials (CORE):** the bundle registry `BUNDLE_DECLS` (`src/snippets.ts:106-248`) wires only ~7 of 27 shipped families; ~20 (data-table's ~40 demos, date-picker, combobox, dialog, listbox, popover, slider, tags, toast, number-field, otp, pagination, pdf, resizable, cropper, codemirror, embla, captcha, command-palette, switch) appear in the picker but FAIL to render (their `<components>` sibling never lands in the in-memory VFS → ROZ945). Extend `BUNDLE_DECLS` to all shipped families + wire each engine lib into the 6 harness importmaps. Also glob `.rzts`/`.rzjs` script-partials into the VFS (snippet globs are `.rozie`-only today, `snippets.ts:17,23,46`) so partial-consuming demos (HeadlessCore/virtualized combobox+listbox/grid-RTL) compile; allow bundle deps to be partials / nested `src/internal/*`.
- **WS2 — Dependency/tooling bump:** playground pins `vite ^5` while the repo is `^8.0.10` (Rolldown) — bump it to match; refresh the hand-pinned esm.sh framework/engine lib versions in the harness importmaps + `esbuild-wasm`.
- **WS3 — Portal/CSS/Solid harness limits (HARDEST — planner may split to a later phase):** no harness serves `PortalHost` (runtime middleware `vite.config.ts:16` serves react/solid/vue/lit/engine-helpers only — no svelte/angular); `stubUnresolvableImports` (`_shared.js:41-51`) DROPS engine CSS side-effect imports (engine families render unstyled); Solid throws `e.cleanups[t] is not a function` (jsx-dom-expressions harness limit). Make portal/engine families live-render.
- **WS4 — Retire stale 999.2:** mark 999.2 RESOLVED (multi-file done `7b390d4`); its residual tail (FullCalendar/Svelte PortalHost, FullCalendar/Solid cleanup) folds into WS3.

**Requirements**: SC-1..SC-5 (success criteria ARE the requirement set — tooling/DX phase).
**Success criteria:**

- SC-1 (WS1 coverage): every shipped `@rozie-ui` family that has an `examples/demos/*.rozie` demo either renders in the playground grid ×6 or is explicitly, visibly marked unsupported with a reason (no silent ROZ945). `BUNDLE_DECLS` extended; harness importmaps carry the needed engine libs.
- SC-2 (WS1 partials): `.rzts`/`.rzjs` partials glob into the VFS; a partial-consuming demo (e.g. HeadlessCore/virtualized listbox) compiles + renders (or is marked unsupported with a reason).
- SC-3 (WS2 deps): playground builds + runs on Vite ^8/Rolldown matching the repo; pinned esm.sh lib + esbuild-wasm versions refreshed; `pnpm --filter rozie-playground build` green.
- SC-4 (WS3 harness): portal-using and engine-CSS families live-render in the iframe (PortalHost served for the targets that need it, engine CSS injected, Solid teardown fixed) — **SPLIT to a follow-on phase (Phase 69), explicit and documented (see the WS3 residual note below + the Phase 69 forward entry), not silently dropped.** Portal/engine families blocked by WS3 stay visibly marked unsupported-with-reason via the 68-01 mechanism, so WS1/WS2 shipped without WS3.
- SC-5: 999.2 marked RESOLVED in ROADMAP; playground smoke works end-to-end (editor compiles, grid renders the newly-wired families); no regression to the already-working 7 families; playground e2e/smoke (if any) green. No auto-push.

**Depends on:** the shipped `@rozie-ui` families (the subjects); the resolved multi-file bundle machinery (`7b390d4`); the Vite 8/Rolldown repo migration (WS2 target). Non-emitter phase — playground app only (`examples/playground/**`), no `packages/targets`/`packages/core` changes expected.
**Plans:** 6/6 plans executed — COMPLETE (WS1 coverage + `.rzts` partials + WS2 dep bump shipped; WS3 harness limits split → Phase 69).

Plans:

- [x] 68-01-PLAN.md — WS1 coverage A: unsupported-with-reason picker mechanism (D-2) + serve @rozie/runtime-svelte + 11 partial-free pure-Rozie family bundle decls
- [x] 68-02-PLAN.md — WS1 partials: glob `.rzts`/`.rzjs` into VFS + cross-package headless-core partial keying; wire combobox/listbox/command-palette + HeadlessCore (SC-2)
- [x] 68-03-PLAN.md — WS1 internal helpers: nested `./internal/*.ts` blob-sibling wiring (regex nested-segment fix + importBundleWith sibling-rewrite + vue/svelte passthrough branch). date-picker/pagination/resizable UN-MARKED (render x6); popover STAYS marked (also emits @floating-ui/dom engine → 68-04) + command-palette helper wired but STAYS marked (@tanstack/virtual-core → 68-04). verify-coverage 15×6 exit 0, build exit 0. Commits 79276b9c, 14f1a552 UNPUSHED (SC-1/SC-2)
- [x] 68-04-PLAN.md — WS1 engine A: engine libs in 6 importmaps + embla/codemirror/cropper/pdf/captcha (render-or-mark)
- [x] 68-05-PLAN.md — WS1 engine B (data-table): @tanstack/table-core@8.21.3 added to 6 importmaps (+ virtual-core@3.17.1 from 68-04); declarative family-partial auto-inclusion (FAMILY_PARTIAL_SOURCES + partialFamilies + vfsPartials + seedVfsPartials) carries all 20 relative `.rzts` partials basename-keyed into the VFS (+ cross-package windowing.rzts via 68-02 global seed); 5 representative bundles (Sort/Columns/Edit/Virtual/GridNav) UN-MARKED via RENDERED_KEYS exact-key exemption (every runtime import resolves); ~29 long-tail DataTable* entries stay marked via the `DataTable` token (reason → representative subset), no silent ROZ945 (D-2). verify-coverage 25×6 exit 0, typecheck exit 0, build exit 0, packages/* diff empty. Commits de63856f, 6bf7f436 UNPUSHED (SC-1/SC-2)
- [x] 68-06-PLAN.md — WS2 dep bump (Vite ^5→^8.0.10/Rolldown, resolves vite@8.1.0) + refresh esm.sh/esbuild-wasm pins (within-major, no floor crossed; esbuild-wasm 0.24.0→0.25.5) + confirm 999.2 RESOLVED + document WS3→Phase 69 (SC-3/SC-5). All vite8_watch_items verified intact: roziePreviewRuntimes generateBundle emits 6 runtime .mjs, configureServer middleware serves /preview/runtimes/*.mjs 200 on dev, optimizeDeps.exclude/node-shim aliases/worker.format/define all functional. verify-coverage 25×6 exit 0, build exit 0 on Vite 8, all 6 harnesses serve valid-importmap on dev; packages/* untouched. Commits 4bef4317 (vite bump), b01bc546 (pin refresh) UNPUSHED (SC-3/SC-5)

WS3 residual (SPLIT → Phase 69, not dropped): (a) serve PortalHost for svelte/angular; (b) inject engine CSS side-effect imports (stubUnresolvableImports drops them today); (c) fix Solid `e.cleanups[t]` jsx-dom-expressions teardown; (d) Lit sibling hot-redefine. Portal/engine families blocked by these are visibly marked unsupported-with-reason via the 68-01 mechanism, so WS1/WS2 ship without WS3.

### Phase 69: Playground harness limits — portal/engine live-render (WS3 carve-out from Phase 68)

**Goal:** Make the portal-using and engine-CSS families actually live-render in the preview iframes, closing the WS3 residual that Phase 68 deliberately split out (Phase 68 shipped WS1 coverage + WS2 dep bump with these families visibly marked unsupported-with-reason via the 68-01 mechanism — nothing silently dropped). Playground-app-only (`examples/playground/**`); no `packages/*` changes expected.

**Residual carried from Phase 68 WS3:**

- (a) **Serve PortalHost for svelte/angular** — the `roziePreviewRuntimes` middleware (`vite.config.ts`) serves react/solid/vue/lit/engine-helpers + svelte-runtime only; portal-using families on svelte/angular have no served PortalHost URL. (Note: angular emits inline — no `@rozie/runtime-angular` — so its portal path differs from svelte's.)
- (b) **Inject engine CSS side-effect imports** — `stubUnresolvableImports` (`_shared.js`) DROPS CSS side-effect imports, so engine families render unstyled. Route the CSS import to a `<link>`/adopted-stylesheet instead of stubbing (react.html already hand-links cropper.css as an interim, 68-04).
- (c) **Fix Solid `e.cleanups[t]` jsx-dom-expressions teardown** — Solid harness throws `e.cleanups[t] is not a function` on re-render (jsx-dom-expressions runtime/harness limit).
- (d) **Lit sibling hot-redefine** — re-defining a custom element on hot-reload throws (`already been used with this registry`).
- Plus the pre-existing marked limits (pdf sandboxed-worker; captcha provider) evaluated against these fixes.

**Success criteria (draft — promote with `/gsd-discuss-phase 69`):** portal/engine families live-render ×6 (or stay marked with a narrower, documented reason); no regression to the 25 families wired in Phase 68; `verify-coverage` + `build` stay green.
**Depends on:** Phase 68 (the coverage + dep-bump baseline).

**Plans:** 6/6 plans complete

Plans:

- [x] 69-01-PLAN.md — Residual (b): generalized engine-CSS injection across all 6 harnesses; retire the interim cropper.css hand-links (D-02/D-02a). MapLibre importmap out of scope.
- [x] 69-02-PLAN.md — Residual (a) svelte half: compile + serve the two PortalHost.svelte subpaths, map them in svelte.html (D-03 svelte side).
- [x] 69-03-PLAN.md — Residual (a) angular half: verify-first empirical render check; fix only if genuinely broken, no invented PortalHost (D-03 angular side).
- [x] 69-04-PLAN.md — Residual (c): Solid `e.cleanups[t]` re-render spike-then-fix-or-mark (render-token gate; D-01/D-01a).
- [x] 69-05-PLAN.md — Residual (d): Lit hot-redefine spike — remove dead regexes, diagnose, fix-or-mark (D-01/D-01a).
- [x] 69-06-PLAN.md — D-04: minimal LOCAL-ONLY Playwright smoke (console-clean + non-blank per newly-live iframe; 127.0.0.1-pinned; no CI wiring).

### Phase 70: DatePicker navigation and ergonomics features

**Goal:** Extend the headless `@rozie-ui/date-picker` family (all six targets) with four additive, in-scope ergonomics features — without crossing the deliberate non-goals (time-of-day, arbitrary multi-date, popover/input combo, non-Gregorian calendars). Approved design spec: `SPEC.md` (source: `docs/superpowers/specs/2026-07-01-datepicker-navigation-features-design.md`).

**Requirements**:

- Month/year quick-jump via drill-in grids (day → month → year), `monthYearNav` prop **default-on** (heading becomes a `<button>`; escape hatch `:month-year-nav="false"`). This intentionally changes default output → VR baselines regenerate.
- Multiple months side-by-side via `numberOfMonths` (default `1`, byte-identical single-month output; window slides by 1 month).
- Today/Clear footer via `showFooter` (default off) + `#footer` slot receiving `{ today, clear, todayIso }`.
- Predicate/weekday disabling: `disabledDaysOfWeek: Number[]` (serializable) + `isDateDisabled: (iso)=>boolean` (Lit property-binding caveat), funneled through the single `isDayDisabled` gate.
- No new events; drilling + multi-month are view-only. New pure helpers (`buildMonthList`/`buildYearGrid`) unit-tested in isolation; 6-target snapshots + Linux VR baselines refreshed; playground family entries added.

**Depends on:** none (additive work on the already-shipped date-picker family)
**Plans:** 5/5 plans complete

Plans:

- [x] 70-01-PLAN.md — Pure helpers: extend isDayDisabled (weekday + predicate) + add buildMonthList / buildYearGrid, unit-tested in isolation
- [x] 70-02-PLAN.md — Author DatePicker.rozie: 5 props + viewMode, view-mode/drill/footer/multi-month script + template + style, surface gate
- [x] 70-03-PLAN.md — Regenerate the 6 target leaves via codegen + cross-target build/typecheck gates
- [x] 70-04-PLAN.md — VR demos (months/years/2-month/footer) + host registration + drill/footer behavior spec + playground entries
- [x] 70-05-PLAN.md — Regenerate Linux VR baselines (default heading change + 4 new cells); blocking human-verify

### Phase 71: r-keynav compiler-owned keyboard-navigation primitive

**Goal:** Ship `r-keynav` as a first-class author-side `.rozie` primitive that compiles to idiomatic native keyboard-list-navigation wiring across all six targets (React/Vue/Svelte/Angular/Solid/Lit) — a compiler-owned peer of Phase 33 (reactive portal slots) and Phase 36 (context primitive), NOT a component-family phase. Surface: `r-keynav:<focus-model>.<modifiers>` (`activedescendant` | `tabindex`; `.vertical`/`.horizontal`/`.both`/`.loop`/`.typeahead`/`.skipdisabled`) + `r-keynav-item="{ label, disabled }"` + optional `r-keynav-active-class` + `@keynav-commit`. Data-driven item model with DOM-driven sugar (`:source` synthesized from the co-located `r-for`); association by shared state (one group per component in v1); the primitive owns *active* (index/focus/aria), the author owns *selection*; hybrid emission (compiler wiring + per-target `@rozie/runtime-*` controllers, mirroring the `.outside` precedent); decoupled from virtualization via an optional `KeynavWindower` contract that today's `@rozie-ui/headless-core` windowing already satisfies.

**Design contract (consume, do not re-derive):** `docs/superpowers/specs/2026-07-02-keyboard-nav-primitive-design.md`

**Scope v1 = roving list-navigation only.** Deferred (out of scope): focus-trap/restore, standalone `$id` primitive, multiple nav groups per component, virtualization-as-a-compiler-primitive. Additive to the compiler (new directives no shipped `.rozie` uses → no corpus rebless expected). **DECIDED (Dan, 2026-07-02): the flagship listbox retrofit is a FAST-FOLLOW, NOT in this phase.** Phase 71 ships the primitive + six per-target runtime controllers + a fresh demo/example proving all six targets; NO existing family is touched, so existing emit stays byte-identical and there is NO corpus/dist-parity/target-snapshot rebless. Retrofitting listbox/combobox onto `r-keynav` is its own later phase (each carries a per-family rebless).

**Requirements**: TBD
**Depends on:** Phase 70
**Plans:** 11/11 plans complete

Plans:

- [x] 71-01-PLAN.md — (W1) Landmine-1 probe: prove parser/lowerer can accept r-keynav:<arg>.<modifiers>; lock bespoke-resolver + Angular-inline decisions
- [x] 71-02-PLAN.md — (W2) Parser + additive IR nodes + resolveKeynavGroups (:source synthesis, one-group association) + bespoke modifier resolver + ROZ982 diagnostics
- [x] 71-03-PLAN.md — (W2) Framework-neutral @rozie/runtime-keynav-core: keydown state machine + normalizeClassTokens + KeynavWindower contract (design-only)
- [x] 71-04-PLAN.md — (W3) React reference target-pair: useKeynav hook + emitter wiring + real-DOM behavior test
- [x] 71-05-PLAN.md — (W4) Vue target-pair: useKeynav composable + emitter wiring
- [x] 71-06-PLAN.md — (W4) Svelte target-pair: keynav action + emitter wiring
- [x] 71-07-PLAN.md — (W4) Solid target-pair: createKeynav primitive + emitter wiring (real-DOM behavior mandatory)
- [x] 71-08-PLAN.md — (W4) Lit target-pair: KeynavController (ReactiveController) + emitter wiring
- [x] 71-09-PLAN.md — (W4) Angular target-pair: inline controller importing keynav-core + emitTemplateAttribute/emitListeners wiring (Landmine 3)
- [x] 71-10-PLAN.md — (W5) Whole-repo build/typecheck/test + additive-no-rebless byte-identity gate
- [x] 71-11-PLAN.md — (W6) Fresh menu + combobox demos + six-target DOM behavior spec + VR cells (Linux baselines) + human-verify checkpoint

### Phase 72: DataTable per-column ⋯ menu (composed Popover) + dedicated filter row

**Goal:** Calm the noisy `@rozie-ui/data-table` column header — today every data column stacks label + sort + an inline filter + a three-button pin cluster (⇤ ⇔ ⇥) + a resize handle in ONE header row, so columns look different depending on their flags. Make every header uniform: `label + sort + one ⋯ menu`, move the pin actions (+ a new per-column Hide) into that menu, and drop per-column filters into a dedicated aligned filter row beneath the headers (floating-filter pattern). Build the menu by **composing `@rozie-ui/popover`** via Option-B authoring-time vendoring — the sanctioned SECOND cross-family composite after command-palette→combobox — rather than a bespoke primitive. Applies to BOTH the virtual and non-virtual header render branches.

**Design contract (consume, do not re-derive):** `docs/superpowers/specs/2026-07-04-datatable-header-popover-menu-design.md`

**LOCKED DECISIONS (Dan):**

- Menu mechanism = composed Popover (NOT `<details>`, NOT a data-table-local popover). Cross-family Option-B vendoring: Popover `exports` its `.rozie` source + internal/middleware; data-table devDepends; codegen vendors into `data-table/src/` with a `vendor-drift.test.ts` guard; local `<components>` composition. 3-layer specifier for raw-source consumers (VR vite alias + Angular tsconfig `paths` + ext-swap).
- Canonical Popover gains an ADDITIVE `strategy` prop (`'absolute'` default → byte-identical-off; `'fixed'` opt-in) so the header menu escapes the table's scroll/sticky overflow clipping. "Fix once → re-vendor."
- Menu contents = Pin left · Pin right · Unpin · Hide column. Sort stays inline on the label. No reorder/autosize/sort items (YAGNI).
- Filter row gated on `hasAnyFilterableColumn()` (byte-identical-off when nothing filterable); filter cells pin-offset aligned; both virtual + non-virtual branches.
- Known composition gaps N/A here: menu items are our own buttons in Popover's slot → no Lit shadow-pierce, no `$refs.popover.<verb>()` composed-ref-typing dependency.

**Requirements**: TBD
**Depends on:** Phase 999.4 (cross-family composition authoring-time vendoring — the machinery + drift-guard precedent), Phase 66 (composed-component ref→Handle typing — the composition backdrop), the shipped `@rozie-ui/popover` (@floating-ui/dom) and `@rozie-ui/data-table` families.
**Success criteria (draft — promote with `/gsd-discuss-phase 72`):** uniform `label+sort+⋯` headers ×6; pin+hide work from the menu; dedicated filter row filters + stays aligned under pinned columns; menu escapes scroll-overflow (virtual/sticky) via `strategy='fixed'`; `vendor-drift.test.ts` green; Popover `strategy` additive (existing consumers byte-identical); VR ×6 (Lit + Angular the risk cells) + batched rebless (dist-parity, target snapshots, Linux VR baselines).
**Plans:** 9/8 plans complete
Plans:

- [x] 72-01-PLAN.md — (W1) Canonical Popover: additive `strategy` prop ('absolute' default → byte-identical-off; 'fixed' opt-in) + exports map (vendorable prereq)
- [x] 72-02-PLAN.md — (W2) data-table codegen vendors Popover + internal/middleware, drift guard (RED-first), devDeps + per-leaf @floating-ui/dom peerDep
- [x] 72-03-PLAN.md — (W3) Header restructure BOTH branches: uniform label+sort+⋯ menu (composed Popover), remove pin cluster + inline filter; onHideColumn + hasAnyFilterableColumn helpers + <components> block
- [x] 72-04-PLAN.md — (W3) 3-layer specifier for raw-source consumers: VR vite resolve.alias + Angular tsconfig paths → vendored Popover
- [x] 72-05-PLAN.md — (W4) Dedicated filter row BOTH branches, pin-aligned, gated byte-identical-off
- [x] 72-06-PLAN.md — (W5) CSS (col-menu / trigger / filter-band, repurpose pin-controls) + a11y verify (Lit shadow-reach, focus-return)
- [x] 72-06b (contingency loop off 72-06) — canonical Popover Escape/dismiss focus-return fix (`deepActiveElement()` shadow-walk) + confirmed the Lit trigger-CSS-reach gap was already resolved as an unplanned side effect of 72-06's own double-toggle fix; re-vendored into data-table, `vendor-drift.test.ts` green. See `72-06b-SUMMARY.md`.
- [x] 72-07-PLAN.md — (W6) Six-target behavioural VR spec (menu/pin/hide/filter/overflow-escape), Lit + Angular risk cells + human-verify checkpoint
- [x] 72-08-PLAN.md — (W7) Batched rebless: dist-parity bootstrap + target snapshots (cold) + Linux VR baselines (data-table only; Popover untouched)

### Phase 73: Emitter hardening — batch-fix the 11 FIXABLE emitter-backlog gaps (Tier 1 + Tier 2)

**Goal:** Pay down the accumulated emitter-parity debt (`project_emitter_hardening_backlog`, seeded 2026-07-04 from the archived port logs) by fixing the 11 items with a clear, known mechanism — the Tier 1 recurring-across-ports gaps and the Tier 2 single-occurrence FIXABLEs — in ONE phase so their reblessings batch into a single consolidated pass rather than 11 piecemeal drifts. Each of these is a place where the emitter forces a per-target authoring workaround, violating the founding "emitter owns parity" principle (`feedback_emitter_owns_parity`); every fix relocates that burden off the author and back into the compiler. Tier 3 CANDIDATES are explicitly OUT of scope (they need red-fixture investigation first and several may falsify on contact, per Phase 56 experience).

**Source of truth (consume, do not re-derive):** `project_emitter_hardening_backlog` (memory) + the per-item port-log refs it cites.

**Scope — the 11 items:**

*Tier 1 (recurring + FIXABLE):*

1. Svelte lowered slot-const shadows a local binding (×4: slider/embla/rete/data-table) → uniquely-name the lowered slot const (`__slot_header`).
2. Solid `$onMount`-returned cleanup loses mount-locals / TS2304 (×3: pdfjs/chartjs/captcha) → close over mount-locals when relocating teardown to `onCleanup()`.
3. Bare boolean attr on a COMPONENT emits `=""` not `={true}` (×2, 4 targets: listbox/rete) → emit `={true}` for a bare bool attr on a component (distinct from a bare attr on a DOM element).
4. Ref tag→element-type map gaps (×2: cropper `img`, listbox `ul`/`li`) → extend the tag→element-type map (same class as the shipped `canvas` fix).
5. Trailing `$expose` verb params not lowered optional / TS2554 (×2: captcha/rete) → lower trailing expose-verb params optional in the per-target signature.
6. Lit consumer `@emit` delivers payload under `CustomEvent.detail` not arg0 (×2: vr-direct-model/pdfjs) → auto-unwrap `.detail` when wiring a Lit consumer `@emit` handler so payload arrives uniformly ×6.
7. Angular template can't hold non-pure exprs / global builtins (×3: valueTransform, inline `{{ }}` arrows, `String()`/`Number`/`JSON`) → hoist the fragment into a generated component method/pipe. **Isolated as its own run** — 3 sub-shapes, touches template-emit more invasively.

*Tier 2 (single-occurrence, FIXABLE):*

8. React duplicate `const {onX}=props` per emit-site / TS2451 (listbox) → hoist the prop-destructure once per component.
9. React capture-`let` name == template `ref="X"` double-declares (chartjs, rolldown parse error) → deconflict pre-pass (`scope.rename`, like the shipped Svelte `deconflictPropShadows`).
10. Lit `<script>` parser rejects `import type` / inline `type` (codemirror) → teach the `<script>` parser `import type` (or emit per-target type annotations).
11. Solid model-prop `typeof`/`in` guard doesn't narrow (`project_solid_polymorphic_model_typeof_narrow_gap`) → bind a local `const v = value()` before the guard for polymorphic/union model reads.
    - (also) React transitive-hoist `let` reachable only via a template helper isn't hoisted → extend transitive-hoist reachability to template-helper call paths (`project_react_transitive_hoist_modulelet`).

**LOCKED DECISIONS (Dan, 2026-07-05):**

- **Scope = Tier 1 + Tier 2 only** (11 items). Tier 3 CANDIDATES deferred — they stay in `project_emitter_hardening_backlog`.
- **Batching shares only the REBLESS, not the fixing.** Each item is fixed surgically, red-first, byte-identity per `feedback_emitter_seam_surgical_per_seam`: build the failing fixture FIRST, confirm it lands red on EXACTLY the expected targets, then fix; every fix must be ZERO-drift on all existing guard fixtures. Per-item guard fixtures are added during development; the corpus/dist-parity/target-snapshot/Linux-VR rebless is a SINGLE consolidated final wave after all 11 land.
- **Angular non-pure-expr hoist (#7) is its own run** — larger blast radius on template-emit than the rest.
- Premises are POINT-IN-TIME notes — verify each against the current emitter before fixing; a falsified premise ships as a green-×6 regression guard, not a fabricated fix.

**Requirements**: TBD
**Depends on:** the shipped emitter/inliner seam machinery; no cross-phase code dependency (pure emitter hardening).
**Success criteria (draft — promote with `/gsd-discuss-phase 73`):** all 11 items fixed OR explicitly reclassified (falsified→green guard); each carries a red-first guard fixture proving the fixed shape; zero drift on pre-existing guards + live component baselines; the per-target authoring workarounds removed from the affected `.rozie` sources / port notes; ONE consolidated rebless (dist-parity bootstrap + target snapshots cold + Linux VR baselines) covering the whole batch; `project_emitter_hardening_backlog` updated to reflect what shipped.
**Plans:** 9/9 plans complete

- [x] 73-01-PLAN.md — React cluster: #8 multi-emit-site prop-destructure dedupe, #9 capture-let vs ref-name deconflict, #11-b template-helper let transitive-hoist (wave 1)
- [x] 73-02-PLAN.md — Solid cluster: #2 $onMount cleanup closes over mount-locals, #11 model-prop typeof/in narrow via bound local (wave 1)
- [x] 73-03-PLAN.md — Svelte #1: lowered slot-const shadow — extend the X$$slot rename to script/param-scope collisions (wave 1)
- [x] 73-04-PLAN.md — Lit #6 (@emit .detail unwrap) + #10 (import type passthrough) — INVESTIGATE-FIRST, falsify→green-×6 guard (wave 1)
- [x] 73-05-PLAN.md — Angular #7 ISOLATED RUN: hoist non-pure template exprs / global builtins to generated methods, AOT-validated (wave 1)
- [x] 73-06-PLAN.md — #3: bare bool attr on a COMPONENT emits truthy on React/Solid/Svelte/Angular (DOM-element unchanged) (wave 1)
- [x] 73-07-PLAN.md — #4: ref tag→element-type map gains img/ul/li across all 7 sites (+ shared-helper decision to Dan) (wave 2)
- [x] 73-08-PLAN.md — #5: trailing $expose verb params lowered optional in the per-target signature ×6 (wave 3)
- [x] 73-09-PLAN.md — Consolidated REBLESS (dist-parity bootstrap + target snapshots cold + Linux VR) — depends on ALL fix plans (wave 4)

### Phase 74: FlowCanvas Background variant + NodeResizer — close the last 2 real React-Flow-parity gaps (background is a fixed dot-grid, not switchable to lines/cross/none via a prop; node resize handles do not exist at all today). Also retire the stale rete-comparison.md language claiming custom edge rendering is bezier-only and NodeToolbar is deferred — both already shipped in Phase 44 (44-02 edge types, 44-06 NodeToolbar) but the doc was never updated to reflect it.

**Goal:** FlowCanvas ships a `background` prop switching among dots/lines/cross/none (default byte-identical to today) and a `<NodeType resizable>` opt-in that shows corner drag handles on a selected node, persisting an explicit `node.width`/`node.height` (clamped to author min/max, one undo step, double-click-resettable) — closing the last 2 real React-Flow-parity chrome gaps. `docs/components/rete-comparison.md` is corrected: the 2 stale deferred claims (edge rendering, NodeToolbar) are retired and both new features are documented as shipped.
**Requirements**: D-01..D-17 (74-CONTEXT.md decisions), DOC-CORRECTION
**Depends on:** Phase 73
**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 74-01-PLAN.md — background prop + CSS variant switch (dots/lines/cross/none) + demo + VR wiring

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 74-02-PLAN.md — NodeType resizable/min/max declarations + renderNode fixed-box sizing

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 74-03-PLAN.md — resize handle overlay: pointer-drag gesture, rAF write-back, history, double-click reset

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 74-04-PLAN.md — resize demo + VR host wiring + rete-flow-resize behavioral spec

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 74-05-PLAN.md — rete-comparison.md correction + consolidated validation gate

### Phase 75: Cross-package published-leaf composition (Option A) — resolve <components> references to already-published @rozie-ui packages across all 6 targets, graduating past Phase 999.4's authoring-time source vendoring

**Goal:** Resolve a `<components>` reference to an already-published, per-target `@rozie-ui` leaf package via a compiler-level, schema-versioned manifest — graduating the shipped command-palette→combobox pair from Option B (authoring-time source vendoring) to Option A (published-package composition) with ZERO edits to the authored `CommandPalette.rozie`, across all 6 targets.
**Requirements**: D-01..D-13 (phase-local CONTEXT decisions); reconciles COMP-04 (bounded published-composition exception)
**Depends on:** Phase 74
**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 75-01-PLAN.md — Manifest contract + generator + reader/validator in @rozie/core (schema-versioned, D-01/D-03/D-04)
- [x] 75-05-PLAN.md — Wire @rozie-ui/combobox-<target> devDependencies into command-palette root so codegen resolves the published combobox at compile time (D-05/D-09/D-10/D-13)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 75-02-PLAN.md — Per-target published-package resolution wiring in @rozie/core; COMP-04 bounded exception (D-04/D-08/D-09/D-10/D-12)
- [x] 75-03-PLAN.md — Combobox emits rozie-manifest.json into each per-target leaf + round-trip fixture (D-01/D-02/D-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 75-04-PLAN.md — Command-palette B→A graduation: delete vendor/remap, add caret peerDeps, prove CommandPalette.rozie byte-identical (D-05/D-06/D-07/D-11/D-12/D-13)

### Phase 76: @rozie-ui/lexical — cross-framework Lexical rich-text editor family (killer-component-port lineage; staged 5+1)

**Goal:** A component-library author writes one `.rozie` source per piece (editor shell + plugin components + a @mention decorator node) and ships an idiomatic, compile-clean Lexical rich-text editor for five targets in v1.0 (React, Vue, Svelte, Angular, Solid), with Lit following in v1.1. Green-lit by spikes 013 (`$`-sigil gate) + 015 (Lit decorator/shadow), both VALIDATED 2026-07-18; the founding "one-source→6-idiomatic vanilla-engine wrapper" thesis is already proven for rich-text editors by spikes 001/010/002-009 (TipTap). Fills a real market gap — of six frameworks, Angular/Lit have NO maintained Lexical binding and Vue/Solid are stale (pinned 10-18 minors behind core). v1.0 ships the editor shell + core imperative plugins (RichText/History/List/Link) + a selection-reading toolbar + the neutral-descriptor decorator-bridge infrastructure + one reference `@mention` DecoratorNode + docs + Linux-baseline VR, distributed as per-framework pre-compiled `@rozie-ui/lexical-<target>` packages via the standard `codegen.mjs` model. v1.1 adds the Lit target (open shadow root, theme-CSS-per-root, reconnect lifecycle, browser floor Chrome 137+/FF 142+/Safari 17+), its decorator bridge, plus Markdown-shortcuts and Tables plugins.
**Requirements**: D-01..D-12 (phase-local CONTEXT decisions); honors spike constraints REQ-37 (namespace-import Lexical `$`-API — named `$`-imports break the Svelte compiler), REQ-39 (decorator bridge = per-target hand-written escape hatch, ~30 LOC each, NOT compiler-synthesized), REQ-40 (Lit open-shadow obligations + browser floor) from `.planning/spikes/MANIFEST.md`
**Depends on:** Spikes 013 + 015 (validated); Spike 001 (vanilla-engine wrapper), Spike 010 ($provide/$inject context), Spikes 002-004/007-009 (portal slots / node-view embedding); the shipped @rozie-ui distribution model + codegen.mjs
**Plans:** 8 plans (4 waves)

- [ ] 76-01-PLAN.md — Family scaffold + editor shell (.rozie) + $provide context + multi-component codegen engine + surface/Svelte gate (D-01, D-04, D-05)
- [ ] 76-02-PLAN.md — Core plugins ×4 (RichText/History/List/Link), inject-and-register (D-02, D-05)
- [ ] 76-03-PLAN.md — Selection-reading toolbar, bidirectional dispatch + active-state (D-03, D-05, D-12)
- [ ] 76-04-PLAN.md — @mention neutral DecoratorNode + 5 per-target decorator bridges + shell wiring + codegen vendoring (D-06, D-07, D-05)
- [ ] 76-05-PLAN.md — Distribution: react/solid/vue leaves + D-08 externals discipline (D-01, D-08)
- [ ] 76-06-PLAN.md — Distribution: svelte/angular leaves + D-08 externals (D-01, D-08)
- [ ] 76-07-PLAN.md — Linux-baseline VR cells (editor + toolbar + @mention showcase) ×5 (D-09)
- [ ] 76-08-PLAN.md — Docs section: usage, plugins, decorator recipe, namespace convention + v1.1 staging (D-09, D-05, D-07, D-10, D-11, D-12)

**Wave 5** *(scope addition 2026-07-19 — Lit pulled from v1.1 into the shipped family during UAT)*

- [ ] 76-09-PLAN.md — Lit target (6th): decorator bridge + codegen lit lane + emitted-host shadow-DOM probe + @rozie-ui/lexical-lit leaf + Lit VR runtime proof + docs "Lit shipped" (D-01, D-06, D-08, D-09, D-10). Markdown-shortcuts + Tables remain the only v1.1 items.

### Phase 77: r-keynav grid focus-model + multi-group — 2D calendar-grade keyboard navigation (2D stride, @keynav-page, inert-disabled, containment-scoped groups) + date-picker retrofit

**Goal:** Extend the Phase-71 `r-keynav` primitive so calendar-grade 2D grids can adopt it: a `.grid(columns)` parameterized modifier (row/column stride, PageUp/PageDown, boundary→paging via a new machine-never-lands `@keynav-page` event, row-wise Home/End + Ctrl+Home/End, focusable-but-inert disabled cells per the APG grid pattern) plus multiple nav groups per component scoped by template containment (lifts ROZ986; nested roots error). Prove it by retrofitting `@rozie-ui/date-picker` (day grid + month/year drills) onto the primitive — deleting the hand-rolled roving/focus-scheduling logic from quick 260802-hla with that task's 24 VR cells + unit tests as the unmodified regression net. Design contract: `SPEC.md` in the phase dir (source `docs/superpowers/specs/2026-08-04-r-keynav-grid-design.md`) — consume, do not re-derive; `--skip-research` candidate.
**Requirements**: Grid key map per SPEC §4 (continuous ±1 rows, ±columns vertical, boundary/page events, ragged-last-row rules), inert-by-default disabled in grids w/ `.skipdisabled` opt-out (SPEC §5), containment-scoped multi-group (SPEC §6), ROZ993–996 diagnostics + ROZ986 retirement (SPEC §8), keynav-core additive minor + six target pairs (SPEC §7), KeynavGridDemo + multi-group demo 6-target behavior/VR gates + date-picker retrofit w/ red-first focus-after-render seam (SPEC §9–10). Additive-invariant: existing emit byte-identical until the retrofit wave's single deliberate date-picker rebless.
**Depends on:** Phase 71 (r-keynav primitive, complete)
**Plans:** 11/11 plans complete

**Requirement ID map** (planner-minted from the prose Requirements line above, used in each plan's `requirements` frontmatter): KNG-01 grid key map (SPEC §4) · KNG-02 inert-by-default disabled + `.skipdisabled` opt-out (§5) · KNG-03 containment-scoped multi-group (§6) · KNG-04 ROZ993–996 + ROZ986 retirement + ROZ984 rewording (§8) · KNG-05 keynav-core additive minor (§7.1) · KNG-06 six target pairs (§7.3) · KNG-07 KeynavGridDemo + multi-group demo 6-target behavior/VR gates (§9.2–9.3) · KNG-08 date-picker retrofit + red-first focus-after-render seam (§9.4, §10) · KNG-09 additive invariant (§7.4).

Plans:
**Wave 1**

- [x] 77-01-PLAN.md — keynav-core grid branch: `KeynavPageDetail` / `KeynavConfig.grid` / `KeynavHost.page` types, red-first grid unit suite, 2D reducer branch (1D suite untouched)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 77-02-PLAN.md — compiler front-end: `.grid(<expr>)` + peggy path-expression arg, `r-keynav-item="{ index }"`, additive IR, per-root containment scoping, ROZ993–996 + ROZ986 retirement + ROZ984 rewording

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 77-03-PLAN.md — React reference pair: `resolveKeynavPlans` multi-root emit, grid config, `@keynav-page` routing, explicit item index, `useKeynav` page/columns options + additive-invariant proof

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 77-04-PLAN.md — Vue, Svelte and Solid pairs replicating the React reference (Solid real-DOM evidence stated honestly)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 77-05-PLAN.md — Lit and Angular pairs (first-update ordering / after-view-init focus timing) + six-target additive-invariant battery

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 77-06-PLAN.md — `KeynavGridDemo` + `KeynavMultiGroupDemo` + six-target real-DOM behavior spec (incl. the focus-after-render seam) + Linux Docker VR baselines

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 77-07-PLAN.md — date-picker retrofit 1/2: month + year drills onto `.grid(3)` (verified column count) as sibling roots; drill keydown switches deleted; regression net green unmodified

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 77-08-PLAN.md — date-picker retrofit 2/2: day grid onto `.grid(7)` with a flat source + explicit index; `scheduleFocus` and the day keydown switch deleted; single deliberate family rebless

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 77-09-PLAN.md — docs for the new surface + diagnostics, final whole-repo battery + batched Docker VR union, recorded keynav-core minor obligation, human verification checkpoint

Gap closure (from 77-VERIFICATION.md, 2026-08-05 — KNG-06 / KNG-08 failed, plus one user-reported UAT gap):

- [x] 77-10-PLAN.md — KNG-06 root cause: red-first Angular conditional-root emit fixtures, then a reactive identity-diffed `__rozieKeynavAttachRoot` re-attach (the idiom the other five targets got in 77-07), whole-repo battery + Angular leaf regen
- [x] 77-11-PLAN.md — KNG-08 + UAT-HOVER: six-target drill-keyboard regression test (the coverage hole that hid the gap), token-derived `--rozie-datepicker-selected-hover-bg` selected/range-endpoint hover state + contrast spec, family regen and the batched Linux Docker VR union run

### Phase 78: Per-family token theming pages — reconcile the 17 base.css token surfaces (123 undeclared tokens), add a docs/scripts/gen-theming-pages.mjs generator, and emit a dedicated <slug>-theming.md page per token-shipping family

**Goal:** Every `@rozie-ui` family that ships `src/themes/` gains a dedicated, generated `docs/components/<slug>-theming.md` page whose centrepiece is the complete `--rozie-*` customizable-token table — and `base.css` is made true again first, so that table has an honest source of truth. Probe finding: 123 tokens are read by components via `var(--token, fallback)` but never declared in `base.css` (`command-palette` 75, `date-picker` 25, `combobox` 14, `rete` 3, `slider` 2, `toast` 2, `resizable` 1, `data-table` 1), so all 17 families' "the full token vocabulary is in `themes/base.css`" claim is currently false for 8 of them.
**Design spec:** `docs/superpowers/specs/2026-08-15-component-token-theming-pages-design.md` (gitignored; local-only per `commit_docs: false`), mirrored into the phase dir as `SPEC.md`
**Requirements**: [REQ-78-1, REQ-78-2, REQ-78-3, REQ-78-4, REQ-78-5]
**Depends on:** Phase 77
**Status:** Complete (2026-08-15) — 13 commits, unpushed. All gates green: cold turbo build 242/242, typecheck 311/311, test 137/137 (0 cached), dist-parity 1049/1049 zero drift, docs test 29/29, and a full-matrix Linux Docker VR run at **2176 passed / 0 failed** against existing baselines with no `--update` (`git status --porcelain` on `__screenshots__/` empty — the render-neutrality claim is proven, not asserted). Human sign-off given on the rendered site, with a follow-up on heading quality delivered in-phase (see `78-06-SUMMARY.md`): an audit found 13 of 17 pages carried a paragraph-length heading, including `popover` heading its only table with the entire file-head doc block. Headings are now resolved from the preceding comment run by label shape, with non-label comments rendered as prose above the table.
**Plans:** 6/6 plans executed

Requirements (phase-scoped, minted at planning time — Phase 78 predates a registry entry):

- REQ-78-1 — every `src/themes/base.css` is again the complete public `--rozie-*` token surface: 123 undeclared tokens declared render-neutrally from their own inline fallbacks, and the base-only residue resolved (annotated where correct, deleted where dead)
- REQ-78-2 — `docs/scripts/gen-theming-pages.mjs` derives prefix, groups and token set from source with no per-family configuration
- REQ-78-3 — 17 generated `docs/components/<slug>-theming.md` pages with `Token | Default` tables grouped by base.css's own group comments
- REQ-78-4 — the 17 hand-authored `## Theming` sections trimmed to intro + example + link-out
- REQ-78-5 — sidebar and `relatedLinks()` registration, with the docs build, anchor check and one batched Linux Docker VR union run green

Plans:

- [x] 78-01-PLAN.md — reconcile 7 families' base.css (48 tokens: date-picker 25, combobox 14, rete 3, slider 2, toast 2, resizable 1, data-table 1), annotate the correct base-only residue, plus the fallback-extraction helper [wave 1]
- [x] 78-02-PLAN.md — reconcile command-palette (75 tokens, 11 nested delegation chains verified per token), delete its 6 dead `option-*` tokens from base.css and the 3 bridges, CHANGELOG entry [wave 1]
- [x] 78-03-PLAN.md — author `docs/scripts/gen-theming-pages.mjs` and the shared `display-name.mjs`, add the theming cross-link to `relatedLinks()`, wire `gen:theming` ahead of `gen:usage` in dev/build [wave 1]
- [x] 78-04-PLAN.md — regenerate all 17 pages against the reconciled sources, assert the generator runs silent, register 16 new sidebar Theming entries, retire the hand-authored data-table page [wave 2]
- [x] 78-05-PLAN.md — trim the 17 hand-authored theming sections (13 showcase pages + 3 api pages) to intro + example + link-out [wave 3]
- [ ] 78-06-PLAN.md — [BLOCKING] cold whole-repo turbo battery, ONE batched Linux Docker VR union run against unchanged baselines, human sign-off [wave 4]

### Phase 79: Producer-side dynamic slot names + Lit `rozieSlots` record intake — closing the last ❌ in the compatibility matrix

**Goal:** A component-library author can declare a dynamically-named slot on the producer — <code>&lt;slot :name="`cell-${col.key}`" :row="row" :value="v"&gt;fallback&lt;/slot&gt;</code> — and consumers fill it with ordinary static named fills (`<template #cell-status="{ row, value }">`) that carry real param types, across all six targets. Simultaneously closes the Lit **scoped + dynamic slot name** ❌ (`docs/compatibility.md:91`, `docs/parity.md:218`) by giving the Lit producer the record-property intake that React/Solid/Svelte/Angular already have. Proof: `examples/demos/TableDemo.rozie` reworked from the shared `#cell` + `r-match` ladder to true per-column named slots, green across the Docker VR matrix and dist-parity.

**Why now:** Producer-side dynamic slot names are unsupported on **all six** targets and undocumented — `lowerSlots.ts:172` reads only a *static* `name` attribute, so a bound `:name` falls through into the generic `:param` collector at line 106 and silently becomes a scope param. Per-column table/grid slots are the motivating use case; Phase 11's `r-match` ladder is the current workaround. Lit is simultaneously the sole target lacking the producer-side record intake, which makes it the one target that could not consume the new feature — hence the two land together.

**Design (settled in brainstorming 2026-08-16 — carry into `/gsd-spec-phase 79`):**

- **Authoring surface.** `:name` becomes **reserved** on `<slot>` and means the dynamic slot name — Vue's exact semantics (Vue reserves `name` on `<slot>` too). Consequence: `name` can no longer be a scope-param key on a `<slot>`. Fallback content inside the `<slot>` is the "consumer didn't fill this one" path.
- **IR (additive; `undefined` === today's behavior, so no existing IR snapshot gains a key).** `SlotDecl` gains `dynamicNameExpr?: Expression` (the parsed `:name` expression) and `namePrefix?: string` (the literal leading quasi when `dynamicNameExpr` is a `TemplateLiteral` with a non-empty first quasi — <code>`cell-${col.key}`</code> ⇒ `"cell-"`; absent for a bare identifier or call expression).
- **Matching — static-prefix family inference.** `threadParamTypes` gains a second pass: a consumer fill with no exact `SlotDecl` match is tested against every producer `SlotDecl.namePrefix`, longest prefix wins. On a family hit the fill inherits the family's `params` / `paramTypes` / `producerSlotParamCount`, plus a new `matchedFamily: true` flag.
- **`matchedFamily` is the dispatch switch — load-bearing, not cosmetic.** A family-matched fill MUST route through the per-target record path on all five non-Vue targets: the producer cannot name `cell-status` at compile time, so React's static `props['cell-status']`, Angular's `@ContentChild('cell-statusTpl')` and Lit's `.cell-status=` are all unavailable. It also sidesteps kebab-case names not being valid identifiers. On Lit specifically, `emitSlotFiller.ts:560` gates the *working* function-prop path on `producerSlotParamCount > 0`, so an unmatched fill silently degrades to the legacy `observeRozieSlotCtx` path.
- **Producer dispatch per target.** Every target already has the record lookup; the change is dropping the static half of the merge and keying on the rewritten expression:

  | Target | Static-name today | Dynamic-name emit |
  | --- | --- | --- |
  | Vue | `<slot name="header">` | `<slot :name="<expr>">` — native, already correct today |
  | React | `props.header ?? props.slots?.['header']` | `props.slots?.[<expr>]` |
  | Solid | same shape | `props.slots?.[<expr>]` |
  | Svelte | `snippets?.header` | `snippets?.[<expr>]` |
  | Angular | `(headerTpl ?? templates()?.['header'])` | `templates()?.[<expr>]` — substitute into the existing `mergedTplRef` at `emitSlotInvocation.ts:358` |
  | Lit | <code>this.header !== undefined ? this.header({…}) : html`&lt;slot name="header"&gt;`</code> | **NEW** — `this.rozieSlots?.[<expr>]`, falling back to <code>html`&lt;slot name="${&lt;expr&gt;}"&gt;`</code> |

  `<slot name="${expr}">` is a plain lit-html attribute binding, and `RozieSlotDistributor` buckets on `slotEl.name` read at distribute time, so `slotAssignment: 'manual'` mode and the `inLoop` gate need no changes.

- **Lit record property — this is the ❌ fix.** `emitSlotDecl` gains ONE field, emitted once per component when any slot is scoped, portal, or dynamically named: `@property({ attribute: false }) rozieSlots?: Record<string, (scope: any) => unknown>;`. Consumer side, the early bail at `emitSlotFiller.ts:520` is replaced — a dynamic OR family-matched fill contributes an entry to a single collected <code>.rozieSlots=${{ [&lt;expr&gt;]: (scope) =&gt; html`…` }}</code> binding on the producer's open tag. Dispatch order matches the other five targets and the order already documented in `parity.md`: `rozieSlots?.[name] ?? namedFn ?? <slot> fallback`. The existing Phase 07.5 function-prop machinery does the rest.
- **Legacy Lit path: keep as fallback, re-document.** `rozieSlots` wins; the `data-rozie-params` JSON attribute + `observeRozieSlotCtx` observer stay as the fallback for third-party light-DOM consumers, mirroring Angular's static-wins merge. No breaking change, no `@rozie/runtime-lit` major. Upgrade the `parity.md` third-party-consumer note — a plain-Lit consumer can now write <code>.rozieSlots=${{ 'cell-status': (s) =&gt; html`...` }}</code> instead of the JSON round-trip.
- **Consumer side for family-matched fills** reuses Phase 07.3.2's dynamic-name emit verbatim on React/Solid/Svelte/Angular (`slots={{…}}`, `snippets={{…}}`, `[templates]="getter"`). The only genuinely new consumer code is Lit's.
- **Diagnostics — three new ROZ codes.** (a) `:name` together with a static `name` on the same `<slot>`; (b) a `name` scope-param on a slot carrying `:name`; (c) **warning** (not error) when `dynamicNameExpr` yields no static prefix — legal, but consumer params degrade to `unknown` and no ROZ947 can fire.
- **Out of scope (deliberate):** `$slots[expr]` computed presence access for a dynamic family (currently ROZ106). The `<slot>`'s own fallback content covers the "consumer didn't fill this column" case natively and better.
- **No IntelliJ plugin or TextMate work** — `:name` already lexes as an ordinary bound attribute.

**Fixture churn — this is the red-first test.** Four regression fixtures author `<slot :name="x"/>` inside `r-for` and today emit **divergent semantics**: Vue emits a genuinely dynamic named slot (correct), while React/Solid/Svelte/Lit lower `name` as a scope param on the **default** slot (`this.__rozieDefaultSlot__({name: x})`, `props.slots?.['']({name: x})`). Re-blessing converges the five onto Vue's existing output:

- `tests/regressions/fixtures/loop-mustache-slot-rfor/`
- `tests/regressions/fixtures/loop-mustache-template-slot-rfor/`
- `tests/regressions/fixtures/loop-mustache-keyed-slot-rfor/`
- `tests/regressions/fixtures/loop-mustache-nested-conditional-slot-rfor/`

**Blast radius of the `:name` reservation (audited 2026-08-16):** exactly those 4 files. Repo-wide `grep -ran ':name=' --include='*.rozie'` returns 5 hits; the fifth is `packages/ui/flatpickr/src/Flatpickr.rozie:527`, which is `:name` on an `<input>` and unaffected. No shipped `@rozie-ui` component or `examples/` file declares a `name` scope param on a `<slot>`.

**Success looks like:**

1. The four regression fixtures re-blessed; five targets converge onto Vue's output.
2. New `examples/` fixtures: a producer family with static consumer fills; one dynamic **and** scoped fill (the ❌ case); one no-static-prefix case proving the degraded-typing warning.
3. dist-parity byte-identity, 6 targets × 4 entrypoints, re-bootstrapped after the emitter change.
4. Strict-TS consumer fixtures covering the changed `.d.ts` surface.
5. `examples/demos/TableDemo.rozie` reworked to per-column named slots; `docs/examples/table` live-compiles it on every build.
6. One Docker VR union run at the end, Linux-rendered baselines.
7. `docs/compatibility.md` — the Lit ❌ becomes ✅, and a NEW "producer-side dynamic slot names" row lands across all six. `docs/parity.md:218`'s "Lit — scoped + dynamic slot names (unsupported combination)" section is deleted and replaced.

**Proposed waves:**

- **Wave 1** — Core IR (`dynamicNameExpr` + `namePrefix`), `lowerSlots` reading `:name`, family matching in `threadParamTypes` (`matchedFamily`), three new ROZ codes, red-first fixtures.
- **Wave 2** — Lit `rozieSlots` producer intake + consumer emit (the ❌ fix; independently verifiable).
- **Wave 3** — Producer dynamic-name dispatch for the other five targets + consumer family-matched routing.
- **Wave 4** — TableDemo rework, four fixture re-blessings, dist-parity re-bootstrap, strict-TS consumer fixtures, `compatibility.md` / `parity.md` rewrite, one Docker VR union run.

**Risks for the spec to pin down:**

- The `:name` reservation is a **semantic breaking change** to `<slot>` authoring (a `name` scope param stops working). Audited blast radius is 4 regression fixtures, but the spec should state the migration note for external authors.
- Wave 3 touches five emitters at once — per `feedback_dist_parity_rebless_after_emitter_change`, requires a full cold `build --force` plus `pnpm --filter dist-parity bootstrap` before any gate result is trustworthy. Also `feedback_target_suite_snapshots_drift_on_emitter_change`: `turbo run test --force --continue` cold.
- `core` is inlined into the plugin packages (`project_core_inlined_into_plugin_pkgs`) — an IR change needs a whole-repo `build --force`, and new emitter shapes need the unplugin `resolveId` byte-equal-across-entrypoints check (`feedback_unplugin_resolveid_mediation`).

**Requirements**: TBD (assign in `/gsd-spec-phase 79`)
**Depends on:** Phase 07.5 (Lit function-prop scoped-slot path — the machinery `rozieSlots` plugs into), Phase 07.3.1 / 07.3.2 (the React/Solid/Svelte/Angular record intake this generalizes), Phase 11 (`r-match` — TableDemo's current per-column workaround, which this replaces)
**Plans:** 15/15 plans complete

**Planned wave structure (D-08's five waves, expanded to 14 sequential GSD waves — see `79-01-PLAN.md` § Wave-structure reconciliation).** Two corrections to the design above were made at plan time: the ROZ codes take **`ROZ090..ROZ095`**, not `ROZ948`+ (that block is fully consumed by Phases 07.2 / 07.3 / 11); and the `Table` VR cell **already exists and is green** with a Linux baseline committed in `bbd4e193`, so R9 is a re-run-and-verify, not a new registration. A third item — Lit's `.name`-keyed slot dedup collapsing two dynamic-name `SlotDecl`s — is a genuine gap in the settled design and is probed-then-fixed in 79-08.

Plans:

- [x] 79-01-PLAN.md — Allocate `ROZ090..ROZ095`, correct the two stale reservation comments, land R13's reserved slot-record-property validator
- [x] 79-02-PLAN.md — Author the `DynamicSlots` / `DynamicSlotsConsumer` fixture pair (unregistered until the compiler can build it)
- [x] 79-03-PLAN.md — R12 core: retire ROZ127's identifier check, add the shared identifier predicate, Vue's conditional `defineSlots` quoting
- [x] 79-04-PLAN.md — R12 routing: React and Solid record-only path for non-identifier slot names
- [x] 79-05-PLAN.md — R12 routing: Svelte and Angular record-only path for non-identifier slot names
- [x] 79-06-PLAN.md — R1 core IR: `:name` reservation, `dynamicNameExpr` / `namePrefix`, constant folding, ROZ090/091/092/094
- [x] 79-07-PLAN.md — R2 family matching: `matchedFamily`, exact-wins / longest-prefix, ROZ093, ROZ941 tried-prefixes
- [x] 79-08-PLAN.md — Lit A: probe-then-fix the `.name`-keyed slot identity collision, emit the `rozieSlots` property
- [x] 79-09-PLAN.md — Lit B: `.rozieSlots=` accumulator, three-step producer dispatch, R12's sixth target
- [x] 79-10-PLAN.md — Producer dynamic dispatch: Vue, React, Solid, Svelte (D-09 first half)
- [x] 79-11-PLAN.md — Producer dynamic dispatch: Angular alone (D-09 second half)
- [x] 79-12-PLAN.md — R6 template-literal family type surface on six targets, `paramTypes` flow (D-13), six strict-TS consumer fixtures
- [x] 79-13-PLAN.md — Register the dist-parity pair, build the AC-N2 assertion layer, then re-bless the four `loop-mustache-*-slot-rfor` fixtures
- [x] 79-14-PLAN.md — Rework `Table.rozie` / `TableDemo.rozie` to per-column named slots; delete both stale prose blocks
- [x] 79-15-PLAN.md — `compatibility.md` / `parity.md` rewrite, minor changeset with the migration note, full cold gate suite, one Docker VR union run

### Phase 80: Angular record-path slot fills — rozieSlot marker directive + @rozie/runtime-angular package

**Goal:** A Rozie-authored Angular consumer can fill a producer's dynamically-named, kebab-named, or `matchedFamily` slot from anywhere — including inside `r-if` / `r-for`, and with two sibling producers on the page — and the fill actually renders. A hand-written (non-Rozie) Angular consumer gets the same capability in one line of idiomatic markup — `<ng-template [rozieSlot]="'cell-' + col.key" let-row="row">` — with no `@ViewChild`, no record getter, and no class-body code.

**Why now:** The current consumer path is **silently wrong** in two shapes that no gate exercises. Both confirmed by an Angular 21 TestBed probe and by compiling variant `.rozie` consumers (exploration 2026-08-17):

1. **A record-path fill inside `r-if`/`r-for` is silently dropped.** `packages/targets/angular/src/emit/emitTemplateNode.ts:932` emits `@ViewChild('__dynSlot_N', { static: true })` unconditionally. A static query never resolves a ref inside an embedded view and never recovers (angular.dev/guide/components/queries — "Static query results do not update after initialization"). The getter yields `{key: undefined}`, the producer's `@if (templates()?.[k])` is falsy, and the producer's DEFAULT content renders instead of the consumer's fill. Flipping to `static:false` does not fix it; `@for` is unfixable this way at all — one `ViewChild` returns iteration 0, and `viewChildren` loses the name→template association.
2. **Two sibling producers collide.** `dynIdx` restarts per component tag (`emitTemplateNode.ts:871`) and the getter name is the constant `'templates'` (`:946`), so both siblings emit `<ng-template #__dynSlot_0>` and share one getter. The second producer renders the FIRST producer's fill body. Probe output: `A:L1A:L2` where correct is `A:L1 B:L2`. Predicted verbatim as "Pitfall 4" in `.planning/phases/07.3.2.1-*/07.3.2.1-RESEARCH.md:333-337` and never closed.

Blast radius is wider than `#[expr]`: non-identifier static names (`#cell-status`) and `matchedFamily` fills route through the SAME record path (79-05, 79-11) — that is the data-table family pattern. **LATENT, NOT LIVE** — `grep -al "__dynSlot_"` finds the path only in test fixtures; no shipped `@rozie-ui` leaf emits it, so nothing published breaks and there is no release scramble.

**Ruled out — do not chase.** The fresh-object-literal `templates` getter does NOT risk NG0100: Angular's `devModeEqual` (`core.mjs:20639-20655`) explicitly exempts object-vs-object comparison. Runtime key changes behave correctly (miss → producer default → back).

**Ecosystem check (verified against current source/docs).** This is not "Angular being Angular." Angular Material/CDK ships an official dynamic-column example using `@for (column of displayedColumns; track column) { <ng-container [matColumnDef]="column"> }`, collected via `@ContentChildren(CdkColumnDef, {descendants: true})` — runtime-bound name, zero consumer `ViewChild`/`TemplateRef`. PrimeNG v20 uses `<ng-template #body let-product>` with `@ContentChild`. ng-bootstrap uses marker directives. A GitHub-wide search found no mainstream library documenting a consumer-assembled `Record<string, TemplateRef>` bound to a `[templates]` input.

**Design (settled in brainstorming 2026-08-17 — carry into `/gsd-spec-phase 80`):**

- **Scope = record-path only.** Dynamic `#[expr]`, kebab `#cell-status`, and `matchedFamily` fills move to the directive. Identifier-named static fills KEEP `@ContentChild('headerCell', { read: TemplateRef })` — that path is idiomatic, already works for hand-authors, and is not implicated in either bug. Churn: ~11 files vs ~78 if unified.
- **New package** `packages/runtime/angular` = `@rozie/runtime-angular`, versioned in lockstep with the other five runtimes. Charter is the slot directive ONLY; the entry point and build are designed so future helpers can land without restructure. Do NOT migrate the inlined helpers (`__rozieApplyAttrs`, `__rozieDisplay`/`__rozieAttr`, keynav controller) in this wave. Angular was the only target without a runtime package — this is the first.
- **Build deviation (deliberate, must be documented).** The package builds with `ng-packagr` (`compilationMode: "partial"`), NOT tsdown: decorated Angular code must ship partial-Ivy to be AOT-consumable. Recipe already proven in-repo at `packages/ui/pagination/packages/angular` (`ng-package.json` + `tsconfig.lib.json`). Peer range `^19 || ^20 || ^21`.
- **The directive.** `@Directive({ selector: 'ng-template[rozieSlot]', standalone: true })` / `export class RozieSlot { readonly rozieSlot = input.required<string>(); readonly templateRef = inject(TemplateRef<unknown>); }`. Selector restricted to `ng-template` so misapplication is a compile error, not a silent no-op.
- **Producer emission** (only when the producer declares a key-fillable slot — the same condition that makes it accept `templates` today): `private __rozieFills = contentChildren(RozieSlot, { descendants: true });` plus a `__rozieFillMap` `computed()` folding each `f.rozieSlot()` → `f.templateRef`. Merged guard, most-specific first: `headerCellTpl ?? __rozieFillMap()['headerCell'] ?? templates()?.['headerCell']`. `descendants: true` is what makes `r-if`/`r-for` work; the per-instance content query is what makes siblings independent.
- **`templates` input SURVIVES** as a documented escape hatch for programmatic/TS-side assembly. Precedence: static `@ContentChild` → content-collected directive → `templates` input → default content.
- **Consumer emission is a NET DELETION.** Remove the `@ViewChild` injection, the `templates` getter, the `[templates]="templates"` binding, the `dynIdx` counter, and `classBodyKeyExpr` + its `prefixThis` special-casing for template literals (becomes dead). Emit instead `<ng-template [rozieSlot]="<keyExpr>" let-...>body</ng-template>` reusing the existing template-context `keyExpr`, plus `RozieSlot` in the component's `imports:` array and its import statement.

**Design is proven.** A TestBed probe of the content-query approach passes all five cases that fail today — top-level baseline, inside `@if`, inside `@for`, two sibling producers, and a late-arriving fill (`@if` false→true flips to the fill reactively). **Caveat for the spec:** proven with the decorator `@ContentChildren` form (the only form a hand-built JIT harness can express); the signal `contentChildren()` form must be verified as the FIRST red test, not assumed.

**Verification gap that MUST be closed in this phase — this is why both bugs survived.** There is NO Angular runtime test harness in this repo. `tests/dist-parity` is text-snapshot only, and `tests/visual-regression` builds Angular cells with `vite build` (production), which strips `ngDevMode` and never exercises embedded-view timing. Add a small TestBed harness (isolated Angular env, ~40 lines of setup) seeded with five RED tests matching the five cases above.

**Fixture churn.** Rebless the 11 record-path fixtures, `tests/slot-matrix/fixtures/consumer-dynamic-name/expected.angular.ts`, and the VR baselines via Docker (Linux-rendered).

**Wiring (breakage-prone — plan explicitly).** `@rozie/runtime-angular` becomes a real dependency of seven harnesses: `tests/dist-parity`, `tests/visual-regression`, `tests/angular-typecheck`, `tests/slot-matrix`, `tests/integration/angular-analogjs`, `examples/consumers/angular-ts`, `examples/consumers/angular-analogjs`. Dep edit + lockfile sync MUST land in the SAME commit each time (per-commit frozen-lockfile installability). Turbo must build the runtime before Angular leaves. `codegen.mjs` must add the dep to a `@rozie-ui` leaf when that leaf uses record-path slots. The new emitter shape must be byte-identical across all four entrypoints (compile/CLI/babel/unplugin), with the consumer-demo build as the gate.

**Fold in (one line).** A docs note that a hand-written `<ng-template let-label>` binds `$implicit` — which the producer sets to the whole context object — so hand-authors must write `let-label="label"`. Verified: the probe returned `IMPLICIT_KEYS=[label]`.

**Out of scope (deliberate):** typed `let-` context via `ngTemplateContextGuard` on `RozieSlot` (a real win, genuinely separate work); migrating the inlined Angular helpers into the new package.

**Success looks like:**

1. Five red Angular runtime tests go green: top-level, inside `@if`, inside `@for`, two sibling producers, late-arriving fill.
2. Emitted Angular consumers contain no `__dynSlot_`, no `@ViewChild(..., { static: true })` slot capture, and no `[templates]="templates"` binding.
3. `@rozie/runtime-angular` publishes partial-Ivy via ng-packagr and is consumable by an AOT build (the angular-analogjs integration proves it).
4. dist-parity byte-identity across 6 targets x 4 entrypoints after re-bootstrap.
5. One Docker VR union run at the end, Linux-rendered baselines.
6. Every commit in the phase is frozen-lockfile-installable.

**Risks for the spec to pin down:**

- First-ever `@rozie/runtime-angular` — new publish surface, changesets wiring, and a documented deviation from the tsdown default in CLAUDE.md.
- Emitter shape change requires a whole-repo cold `build --force` plus `pnpm --filter dist-parity bootstrap` before any gate result is trustworthy (`feedback_dist_parity_rebless_after_emitter_change`), plus `turbo run test --force --continue` cold (`feedback_target_suite_snapshots_drift_on_emitter_change`).
- `core` is inlined into the plugin packages (`project_core_inlined_into_plugin_pkgs`) — needs the unplugin `resolveId` byte-equal-across-entrypoints check (`feedback_unplugin_resolveid_mediation`).
- Angular AOT traps recorded in this repo: a stray `.d.rozie.ts` sidecar shadows the disk-cache `.rozie.ts` in ngtsc resolution and silently kills AOT (`project_angular_ngtsc_sidecar_shadowing`); AOT rejects `import.meta.url` (use a `?url` import).

**Requirements**: R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11 (defined in `80-SPEC.md`)
**Depends on:** Phase 07.2 / 07.3.2 / 07.3.2.1 (the Angular consumer-side slot-fill machinery this replaces), Phase 79 (dynamic slot names + `matchedFamily`, which widened the record path's blast radius)
**Plans:** 14/14 plans executed

Plans:
**Wave 1**

- [x] 80-01-PLAN.md — `@rozie/runtime-angular` package, the `RozieSlot` directive, changesets registration, docs notes (wave 1)
- [x] 80-02-PLAN.md — Emitter plumbing: ROZ724/ROZ750 allocations + the `runtimeSymbols` import bucket (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 80-03-PLAN.md — `tests/angular-runtime` harness, signal-`contentChildren()` design probe, six fixtures, the RED fail-first commit (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 80-04-PLAN.md — Producer emission: `__rozieFills` + pollution-safe `__rozieFillMap` fold + dev-only diagnostics + precedence tier (wave 3)
- [x] 80-05-PLAN.md — Consumer emission: net deletion of the ViewChild/getter/binding path, `[rozieSlot]` markup, ROZ724 (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 80-06-PLAN.md — Dependency wiring across seven harnesses + `@rozie-ui` leaves, cold rebuild, CI registration (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 80-07-PLAN.md — Cold gate sequence, evidence-cited rebless, precedence/key-domain/pollution tests, five prohibition checks (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 80-08-PLAN.md — Green proof, AOT consumability, entrypoint byte-identity, one Docker VR union, changeset (wave 6)

**Waves 7-11 — D-09 regression closure (added 2026-08-18).** Plan 08's Docker VR union found a regression the phase itself introduced: a consumer's dynamic `#[expr]` fill is silently dropped when the target producer's own slots are all static identifier names, because Plan 04 gated producer collection on the producer's slot NAMING while Plan 05 emits the consumer marker unconditionally. D-09 rules this is fixed inside Phase 80 — no deferral, no re-baselining the four red cells first. The chosen fix widens the producer's keyed-fill intake gate to every slot-declaring producer, making it exactly as wide as the `templates` input it has always sat above (which is what this section's own design brief specified). Two SPEC prohibitions are amended explicitly and encoded as standing tests: the runtime-dependency boundary moves from "uses a record-path slot" to "declares any slot", and the byte-freeze on identifier-named static slot output is replaced by a stronger additive-only inverse-transform guarantee.

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 80-09-PLAN.md — RED: reproduce the silent drop across all three demo shapes plus the embedded-view shape, committed failing (wave 7)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 80-10-PLAN.md — The emitter fix: one named keyed-fill intake predicate, widened intake, diagnostics deliberately left narrow (wave 8)

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 80-11-PLAN.md — Runtime dependency + packager allowance across the twenty-one slot-declaring `@rozie-ui` Angular leaves, lockfile in the same commit (wave 9)

**Wave 10** *(blocked on Wave 9 completion)*

- [x] 80-12-PLAN.md — Cold rebuild, leaf regeneration, evidence-cited rebless, and the two amended prohibitions as standing tests (wave 10)

**Wave 11** *(blocked on Wave 10 completion)*

- [x] 80-13-PLAN.md — Green proof, ONE Docker VR union run on untouched baselines, corrected release note and consumer guide (wave 11)

**Wave 12 — D-10 second-gap closure (added 2026-08-18).** Plan 13's VR run proved the D-09 fix real (`dynamic-slot-name [angular]` went green first-attempt on an untouched baseline) but left `ModalConsumer · angular` and `Table · angular` red for a distinct second reason: slot fills resolve through TWO chains, and Plan 10 widened only one. The outlet chain in `emitSlotInvocation.ts` supplies the `TemplateRef` once a wrapper decides to render; the structural slot-presence chain built in the rewrite layer decides whether the wrapper renders at all, and it was never widened — so the wrapper never renders and the fill has nowhere to land. D-10 rules this fixed inside Phase 80 with ONE additional authorized Docker VR union run, which Plan 14 spends on behalf of Plan 13 as well. Plan 14 extracts the three near-verbatim copies of the presence-chain builder (template, class-body script, listener contexts) into one shared builder and splices the fill-map tier onto the same named intake predicate. Baselines stay untouched.

- [x] 80-14-PLAN.md — RED both real gate shapes, one shared presence-chain builder on the intake gate, evidence-cited rebless, the one authorized Docker VR union run (wave 12)

**Cross-cutting constraints:**

- `pnpm install --frozen-lockfile` succeeds at every commit this plan creates

### Phase 81: Per-target @example JSDoc rewrite — render authoring-notation prop examples as target-correct consumer markup across all six targets

**Goal:** Every `@example` block in every emitted `.d.ts` / component doc comment shows markup a consumer of *that target* can paste and have work. Today `buildPropJsdoc` copies a prop's `docs.example` string verbatim into all six targets, so React consumers of `@rozie-ui/rete` read `<FlowCanvas r-model:graph="graph" :validate-types="true" />` — authoring notation no target but Vue accepts. Proof: the six generated surfaces for a representative multi-construct example each match a hand-written target-idiomatic snippet, and no emitted `@example` contains `r-model:`, a leading-colon attribute, or an `@event=` handler outside the Vue surface.

**Why now:** Surfaced 2026-07-19 during TipTap dogfooding, deferred, re-raised 2026-08-23 from downstream type-reading ([[project_docs_example_rmodel_jsdoc_leak]]). `r-model` appears in doc comments across **506 emitted leaf files spanning 26 families**. Consumers read types before READMEs; the READMEs and generated usage pages are already correct, so types are the only lying surface.

**Scope widened at intake (2026-08-23) — `r-model:` is not the only leak.** Across the 41 distinct `docs.example` strings in `packages/ui/*/src/*.rozie`: 25 carry `r-model:`, but **27 carry `:prop="expr"` dynamic bindings**, several carry kebab attribute names (`:search-debounce`), one carries `@change="onChange"`, and one carries `<template #body>` + `{{ }}`. Rewriting only `r-model:` yields `<FlowCanvas graph={graph} onGraphChange={setGraph} :validate-types="true" />` — mixed notation that is still not valid React and reads worse than the honestly-wrong original. Dan ruled **total per-target rewrite** over the r-model-only cut and over dropping `@example` entirely.

**Design (settled with Dan 2026-08-23 — carry into `/gsd-spec-phase 81`):**

- **Parse, do not regex.** `packages/core/src/parsers/parseTemplate.ts` already parses a template fragment. The example string goes through it to a real AST; a new renderer walks that AST to per-target consumer markup. No string substitution.
- **One builder, one table, six columns.** `buildPropJsdoc(prop, indent)` is deliberately target-agnostic — its own header calls the single-builder design "the load-bearing ANTI-DRIFT precedent set by `renderPropsInterface`". The target is *threaded through* to a parameterised rewrite table; it is NOT copy-pasted into six per-target rewrites. Expect to touch all 8 call sites (`renderPropsInterface.ts:87`; react `emitPropsInterface.ts:139`; solid `emitPropsInterface.ts:213`; svelte `emitScript.ts:641`; angular `emitScript.ts:1110`; lit `emitScript.ts:461,496`; vue `emitScript.ts` imports).
- **Total or diagnostic — never silently wrong.** Any construct the renderer does not cover is a **hard compile diagnostic**, not a passthrough. A construct that cannot be rendered correctly must fail the build rather than ship as authoring notation.
- **Per-target forms.**

  | construct | Vue | React / Solid | Svelte | Angular | Lit |
  | --- | --- | --- | --- | --- | --- |
  | `r-model:x="e"` | `v-model:x="e"` | `x={e}` + `onXChange={setE}` (Solid `x={e()}`) | `bind:x` | `[(x)]="e"` | `.x=${e}` + `@x-change=${…}` |
  | `:prop="e"` | unchanged | `prop={e}` | `prop={e}` | `[prop]="e"` | `.prop=${e}` |
  | kebab attr | unchanged | camelCase | camelCase | unchanged | camelCase property |
  | `@evt="h"` | unchanged | `onEvt={h}` | `onevt={h}` | `(evt)="h"` | `@evt=${h}` |

- **Lit uses the in-template form** (`.graph=${graph}` + `@graph-change=${…}`), consistent with the other five markup examples — deliberately diverging from the imperative `el.graph = …` shown on the generated usage page.
- **React/Solid two-part restructuring is authorized.** One `r-model:` attribute legitimately becomes two attributes; the rewrite may restructure the example rather than substitute in place.
- **Prose is a non-goal.** Free-text mentions like "two-way `r-model`" in `docs.description` stay as-is — no syntax to anchor a safe rewrite on, and the harm is aesthetic, not functional ([[project_docs_example_rmodel_jsdoc_leak]] shape 2).
- **Gating contract preserved.** `buildPropJsdoc` returns `''` for docless props so they stay byte-identical (SC-5), and `hasPropJsdoc` remains the separate single-source predicate every caller consults. Non-markup examples (e.g. `validate: (v) => …`) pass through untouched.
- **Emitter owns parity.** No per-family hand-editing of generated docs, no per-target workaround at the family level, no change to the `.rozie` authoring notation — `r-model:` stays correct in source ([[feedback_emitter_owns_parity]]).

**Correction to the older deferral note:** it claimed a per-target rewrite "already exists in the usage-page generator and just needs wiring in". **False, verified 2026-08-23.** `docs/scripts/gen-usage-pages.mjs` only *collects* snippets hand-authored per family per target inside each `packages/ui/*/scripts/readme.mjs` (rete's Vue snippet hard-codes `v-model:graph` at `readme.mjs:136`). No `r-model` → per-target transform exists anywhere in the repo. This phase writes it.

**Gates — a wide rebless, budget for it:**

- Red-first in `packages/core/src/__tests__/build-prop-jsdoc.test.ts` (existing) before touching the builder; `packages/core/tests/renderPropsInterface.test.ts` needs cases.
- Whole-repo `turbo run build --force` — core is inlined into the plugin packages ([[project_core_inlined_into_plugin_pkgs]]).
- Cold `turbo run test --force --continue`; target-suite snapshots WILL drift ([[feedback_target_suite_snapshots_drift_on_emitter_change]]).
- `pnpm --filter dist-parity bootstrap` after the forced build ([[feedback_dist_parity_rebless_after_emitter_change]]).
- `.d.ts` changes ⇒ strict-TS consumer fixtures apply; any "pre-existing failure" claim must cite the last GREEN commit ([[feedback_consumer_typed_slot_param_gate]]).
- All 26 affected families regenerate via `packages/ui/<fam>/scripts/codegen.mjs`.
- `bash scripts/ci-prepush.sh` before push ([[feedback_local_gate_mirrors_ci]]). Known pre-existing local rot: ~26 ORPHAN `.d.rozie.ts` files under `examples/consumers/*/fixtures/`, gitignored and untracked, dated 2026-08-19, unrelated ([[project_unmanaged_consumer_fixtures_drift]]).
- Comments-only change — no VR run expected; one batched union run only if anything visual moves.

**Requirements**: R1, R2, R3, R4, R5, R6, P1 (SPEC-internal IDs — see `81-SPEC.md`; this phase mints no REQUIREMENTS.md registry IDs)
**Depends on:** Phase 80
**Plans:** 6/6 plans complete

Plans:

**Wave 1**

- [x] 81-01-PLAN.md — `renderExampleMarkup.ts`: the six-column mapping table plus the shared supported/non-markup/unsupported classifier, red-first (R2)

**Wave 2** *(parallel — no file overlap; 02 owns the codegen + target emitters, 03 owns diagnostics + IR + unplugin)*

- [x] 81-02-PLAN.md — required target parameter on `buildPropJsdoc`, comment-terminator escape moved after the render, `RenderPropsInterfaceOptions.target`, and all twenty-seven call sites (R1, R4, P1)
- [x] 81-03-PLAN.md — ROZ097 plus the `validatePropExampleMarkup` pre-emit validator, wired into both `compile()` and the `.d.rozie.ts` sidecar path (R3)

**Wave 3**

- [x] 81-04-PLAN.md — rewrite the one rete source example the diagnostic rejects, and land the standing authoring-notation guard RED (R5, R6)

**Wave 4 — EMITTER FREEZE POINT**

- [x] 81-05-PLAN.md — one cold whole-repo `turbo run build --force`: toolchain rebuild plus 24-family leaf regeneration, diff-reviewed and committed (R5, R6)

**Wave 5**

- [x] 81-06-PLAN.md — dist-parity rebless, cold `turbo run test --force --continue`, `ci-prepush`, and two changesets (all requirements)

**Sequencing note:** the rebless in Wave 4 must happen exactly once, after the emitter is final. R5's source
rewrite lands in Wave 3 specifically so the Wave-4 forced build is not legitimately red on the new diagnostic.

### Phase 82: Multi-root consumer attribute fallthrough — let a "one element + N slots" template auto-inherit, and close the r-if silent-drop

> **SCOPE CORRECTED 2026-08-24 after research.** The original entry claimed an "unfinished emitter path" dropping attrs on 4 of 6 targets across 3 families including data-table. **That framing was wrong on three counts** and is retained below only as a correction record.

**What is actually true (verified by direct source reading + compilation):**

1. **`@rozie/core` already has a complete, tested attrs/listeners fallthrough system.** `synthesizeAttrsFallthrough` / `synthesizeListenersFallthrough` (`packages/core/src/ir/lowerers/lowerTemplate.ts`, wired at `packages/core/src/ir/lower.ts:456-457`) auto-spread `$attrs` onto the single root and work correctly today on every single-root component, all six targets. This is NOT a missing feature.
2. **`rete` and `maplibre` explicitly OPTED OUT and never finished the opt-out.** `FlowCanvas.rozie:90`, `NodeType.rozie`, `Port.rozie`, `MapLibre.rozie` all carry `inherit-attrs="false" inherit-listeners="false"` — the documented escape hatch — without the second half the ROZ970 hint mandates (`r-bind="$attrs"` on the intended element). An **incomplete opt-out in the leaf source**, not an emitter bug.
3. **data-table is NOT affected.** All 12 `packages/ui/data-table/src/*.rozie` leaves are single-root; `DataTable.vue` emits exactly ONE root (`<div class="rozie-data-table-wrap" ref="__rozieRootRef">` wrapping everything, verified by tag-depth analysis). The earlier "5 root nodes" figure came from a bad line-indentation heuristic. They carry the same opt-out flags for no reason discoverable so far — see Open Question 1.

**Corrected blast radius:** `rete` (FlowCanvas + NodeType; Port is renderless) and `maplibre`. Two families, not three. The flagship is untouched.

**Corrected shape of the real gap:** `countRootElements` (duplicated in `packages/core/src/ir/validateAttrFallthrough.ts:67` AND a listeners-side twin — they do NOT share code) counts **any** non-text sibling, including a `<slot>` invocation, as a root. So the "1 HTML element + N `<slot>`s" shape — exactly what rete and maplibre are — is classified multi-root and cannot auto-inherit, even though there is precisely one element that could receive the attrs. That classification is what pushed these leaves onto the opt-out in the first place.

**Second, independent bug found during research (currently undiagnosed, silent):** a **single-root** template whose root is gated by `r-if` silently drops attrs — `countRootElements` returns 1 for a `TemplateConditional` so ROZ970 never fires, and `synthesizeAttrsFallthrough` no-ops on that shape, so there is neither synthesis nor diagnostic. Confirmed by the code's own comment at `validateAttrFallthrough.ts:60-64`. This is the concrete answer to the original entry's open question 3(a).

**Note on the retracted "smoking gun":** Solid's `splitProps(_merged, [...])` binding `attrs` and never referencing it (`solid/src/FlowCanvas.tsx:464`) was read as evidence of an unfinished emitter path. It is not — it is the expected consequence of `inherit-attrs="false"`: the rest is still split out, nothing spreads it because fallthrough is off. Angular and Lit remain correct by construction (real host element).

**Strategy — LOCKED (Dan, 2026-08-24): (B) core generalization.** Teach BOTH `countRootElements` twins (`ir/validateAttrFallthrough.ts:67` and the listeners-side copy — they do NOT share code, both must change) to ignore `<slot>` invocations when exactly one real element root exists, so the "1 element + N slots" shape auto-inherits; then drop the now-unnecessary `inherit-attrs`/`inherit-listeners` opt-outs from the rete + maplibre leaves. Rationale: "one element plus portal slots" is the natural shape for any slot-rich family, so this fixes the CLASS rather than two instances, and hand-writing `r-bind="$attrs"` per leaf is exactly the per-target workaround [[feedback_emitter_owns_parity]] forbids. Strategy (A) — leaf-only `r-bind="$attrs"`, zero core change — was compile-verified working on Vue/React/Svelte/Solid during research and is the documented fallback if (B) proves intractable, but is NOT the plan of record.

**r-if silent drop — LOCKED: diagnose now, fix later.** Convert the silent attr-drop on an `r-if`-gated single root into a compile-time diagnostic THIS phase so the failure can never occur unnoticed; scope the actual branch-descent synthesis separately. Rationale: silent-wrong-render is the failure mode worth eliminating first, and research flagged branch-descent as `[ASSUMED]` rather than verified, so shipping it here would carry unvalidated design risk. **The `ROZ9xx` band is exhausted** — the new diagnostics take **`ROZ098` (attrs) + `ROZ099` (listeners)** — two codes per the D-17 parallel-validator convention. `ROZ097` was already claimed by Phase 81 (`PROP_DOCS_EXAMPLE_UNSUPPORTED_CONSTRUCT`); this allocation **exhausts `ROZ090..ROZ099`**, and two stale band notes in `codes.ts` (`:134`, `:1031-1034`) must be corrected alongside.

**Phase split — LOCKED: 82 stays its own phase.** Under (B) this remains a `@rozie/core` change carrying repo-wide gates (forced build, snapshot drift, dist-parity rebless), which was the original reason to isolate it from Phase 83's leaf CSS work. That reason holds even though data-table turned out to be unaffected.

**Open questions:**

1. Why do the 12 data-table leaves carry an opt-out they do not need — safe to remove, or is something masked (e.g. `DataTable.rozie`'s dynamic `:class` bindings)? Verify before removing.
2. Is the `r-if` silent-drop in scope for this phase?
3. `ROZ9xx` band is exhausted — a new diagnostic needs the reserved `ROZ097..ROZ099` / `ROZ929..ROZ939` fallback.

**Gates:** scale to the chosen strategy. Strategy A is leaf-only (per-family codegen + targeted tests). Strategy B is an emitter change and carries the full repo-wide set: whole-repo `turbo run build --force` ([[project_core_inlined_into_plugin_pkgs]]), cold `turbo run test --force --continue` with target-suite snapshot drift ([[feedback_target_suite_snapshots_drift_on_emitter_change]]), `pnpm --filter dist-parity bootstrap` ([[feedback_dist_parity_rebless_after_emitter_change]]), entrypoint byte-equality ([[feedback_unplugin_resolveid_mediation]]), strict-TS consumer fixtures if `.d.ts` shifts ([[feedback_consumer_typed_slot_param_gate]]), `bash scripts/ci-prepush.sh` ([[feedback_local_gate_mirrors_ci]]). Red-first either way.

**Goal:** A `.rozie` component whose template is one real HTML element plus N `<slot>` invocations auto-inherits consumer attributes and listeners onto that element on all six targets — and every remaining shape that cannot receive them fails loudly instead of silently. Proof: `FlowCanvas`, `NodeType` and `MapLibre` run on default inherit flags with no hand-written per-leaf spread and forward consumer `class`/`style` to their root in a real render; two real element roots still hard-error ROZ970/ROZ973; and an `r-if`-gated single root emits a diagnostic instead of dropping attrs in silence.

**Planning corrections (2026-08-24, verified against the filesystem — these override 82-RESEARCH.md / 82-VALIDATION.md):**

1. **`ROZ097` is NOT free.** Phase 81 Plan 03 allocated it (`PROP_DOCS_EXAMPLE_UNSUPPORTED_CONSTRUCT`). Phase 82 takes **`ROZ098` (attrs) + `ROZ099` (listeners)** — two codes, per the D-17 independence precedent that gives ROZ970/ROZ973 and ROZ971/ROZ974 separate codes. This **exhausts the reserved `ROZ090..ROZ099` block**; both stale band notes in `codes.ts` are corrected in Plan 01.
2. **dist-parity fixtures are NOT auto-discovered.** `tests/dist-parity/scripts/bootstrap-fixtures.mjs` uses a hand-maintained `const EXAMPLES` array (73 entries); its only `readdirSync` clears the output directory. The new fixture must be registered explicitly.
3. **The `r-if` silent drop is LIVE in `examples/`, which research did not scan.** `examples/Modal.rozie:74` and `examples/PortalOverlay.rozie:40` are both conditional-gated single roots on default inherit flags. `Modal` is a registered dist-parity example. This forces the new diagnostic to **`warning`, not `error`** — an error would make the dist-parity bootstrap throw and red the whole repo with no shippable remedy, because the repair is DEFERRED by the LOCKED "diagnose now, fix later" decision.

**Requirements**: none (project uses a domain scheme — `PARSE-01`/`SEM-01`/`ANGULAR-01`; phases 76–81 minted none, and this phase mints none. Traceability runs through the D-01..D-07 register in `82-01-PLAN.md`.)
**Depends on:** Phase 81
**Plans:** 6/6 plans complete

Plans:

**Wave 1**

- [x] 82-01-PLAN.md — allocate ROZ098/ROZ099, correct both stale band notes, and land red-first fixtures in both fallthrough validator suites (D-04, D-05, D-06)

**Wave 2**

- [x] 82-02-PLAN.md — generalize all FOUR root-resolution call sites (both `countRootElements` twins, both synthesizer root loops) and add the gated-root diagnostic at both validators (D-01, D-02)

**Wave 3**

- [x] 82-03-PLAN.md — drop the dead opt-outs from FlowCanvas/NodeType/MapLibre (Port keeps its own), add `examples/ElementPlusSlotFallthrough.rozie`, register it in the hand-maintained fixture array (D-01, D-07)

**Wave 4 — EMITTER FREEZE POINT**

- [x] 82-04-PLAN.md — one cold whole-repo `turbo run build --force` plus leaf regeneration, with a four-bucket drift-containment ledger

**Wave 5**

- [x] 82-05-PLAN.md — dist-parity rebless with a reviewed (not rubber-stamped) diff, cold `turbo run test --force --continue`, cross-entrypoint byte-equality

**Wave 6**

- [x] 82-06-PLAN.md — batched Linux-rendered VR union run, blocking human-verify on real-consumer forwarding + the NodeType hidden-container consequence, changeset, `ci-prepush`

**Sequencing note:** the forced rebuild in Wave 4 and the rebless in Wave 5 each run exactly once,
after the emitter and the leaf sources are final. Plan 03 deliberately registers the new fixture
without blessing it, leaving dist-parity red for one commit window that Plan 05 closes — the same
deliberate intermediate-red pattern the `PartialInlineHost` entry already records in that file.

### Phase 83: FlowCanvas theming contract, visual-defect cleanup, and connection-drag affordance — guard the zero-import OS-dark default, close seven audit findings, and signal incompatible ports during a connection drag

**Goal:** Make `@rozie-ui/rete`'s documented theming contract true on the zero-import path, close the visual and a11y defects found in the 2026-08-24 source audit, and give a rejected connection visible feedback at the target port while dragging.

**Origin:** external audit of the shipped component (ISSUE-3/4/5/6) plus a follow-on rete visual pass. ISSUE-4 is NOT here — it is toolchain-wide and owned by Phase 82.

**Scope — reported issues:**

- **ISSUE-3 (theming contract, medium-high).** The SFC `<style>` OS-dark block at `FlowCanvas.rozie:3939` emits `@media (prefers-color-scheme: dark){ .rozie-flow-canvas{…} }` with NO light-opt-out guard, while `src/themes/base.css:161` guards the same palette with `:root:not(.light):not([data-theme="light"])`. This makes base.css's own documented promise — "dark mode works with NO import at all", light opt-out honored — FALSE for the zero-import consumer, with no CSS-only workaround (a wrapper descendant rule merely ties `(0,2,0)` and resolves on injection order). **DECIDED:** add the guard to the five light-DOM targets only. Lit's copy lives in a shadow root (`static styles`, `FlowCanvas.ts:46`) where `:root` matches nothing; Lit stays unguarded and the gap is DOCUMENTED rather than papered over with `:host-context()`, which is Chromium-only and a silent no-op in Firefox/Safari.
- **ISSUE-5 (visual, low).** `.rozie-flow-node__body` is `min-width:0` and nothing else, so `#body` slot content butts against the port columns while the built-in `.rozie-flow-node__title` has `padding: .5rem .75rem` — custom body content reads as broken. Give the body matching horizontal padding or a `--rozie-flow-node-body-padding` token.
- **ISSUE-6 (usability, medium).** A rejected connection gives no feedback at the target port: the user drags, releases, and the edge simply does not appear. Existing hooks make this cheap — `portTypeOf(nodeId, side, key)` at `:2062` already drives `validateTypes`; `connectionpick`/`connectiondrop` handlers already exist at `:1349`/`:1368`; and the socket render emit at `:1759` already carries `{side, key, nodeId, element}`, so a `nodeId::side::key → element` registry populates there for free. Toggle a `rozie-flow-socket--incompatible` class over the registry on pick, clear on drop, ship a default treatment plus a consumer-stylable hook. Type-only for the visual hint: do NOT invoke the consumer's `canConnect` predicate per-socket per-pick (side effects, cost) — document that boundary.

**Scope — visual audit findings:**

- **A1 (a11y, highest-severity of the audit).** ZERO `:focus` / `:focus-visible` rules exist anywhere in the style block, yet the canvas div carries `tabindex="0"` and the controls buttons, toolbar buttons and resize handles are all interactive. Keyboard users get the UA default only, and `overflow:hidden` on the canvas can clip it. Cross-check the state-driven-ring precedent in [[project_grid_active_cell_ring_state_driven]].
- **A2.** The socket edge-nudge is a hardcoded `-6px` (`margin-left`/`right`/`top`/`bottom`) while socket size comes from `var(--rozie-flow-socket-size, 12px)` — customizing that token breaks edge-straddling. No `box-sizing` is set, so the 2px border is uncounted and the nudge is already ~2px off true centre. Wants `calc(var(--rozie-flow-socket-size, 12px) / -2)` plus an explicit box-sizing decision.
- **A3.** 54 colour/size tokens but ZERO typography tokens; four hardcoded `system-ui` font shorthands (node 13px, control btn 16px, toolbar btn 12px, connection label 11px) cannot be rebranded without overriding four rules.
- **A4 (already user-visible).** Dark-palette DRIFT: `--rozie-flow-resize-handle-bg: #1e293b` exists in the SFC OS-dark block but is missing from BOTH base.css dark blocks, so a consumer on a LIGHT OS using the `.dark` class strategy gets white NodeResizer handles on a dark node. **DECIDED:** patch the missing token AND add a drift test that diffs the SFC dark block against both base.css blocks and fails on divergence — the palette is currently hand-maintained in three places and this is the second drift symptom after ISSUE-3.
- **A5.** Dark mode never remaps `--rozie-flow-socket-ring` or the three `*-shadow` tokens (black-on-dark); `.rozie-flow-node.is-selected` carries an untokenised `0 2px 8px rgba(0,0,0,.15)` layer; `--rozie-flow-marquee-bg` is a light-blue literal that ignores the dark accent.
- **A6.** Scattered hardcoded chrome: controls `left`/`bottom: 10px`, `gap: 2px`, btn `28px`; toolbar `gap: 4px` / `padding: 3px`; marquee and resize-handle `border-radius: 2px`. LEAVE the minimap `200×150` — it is deliberately coupled to the `MINIMAP_W`/`MINIMAP_H` script constants.
- **A7.** `cursor: grab` never becomes `grabbing` during a node drag.

**Verified and explicitly NOT a finding:** there are no `transition` or `animation` declarations anywhere in the style block, so `prefers-reduced-motion` has nothing to respect at the CSS layer.

**Open question for planning:** VR-ing a TRANSIENT mid-drag state (ISSUE-6). Existing baselines are static screenshots; this likely needs a Playwright interaction test that pauses mid-gesture. Scope this before committing to the ISSUE-6 test strategy.

**Gates:**

- Red-first per seam, surgical ([[feedback_emitter_seam_surgical_per_seam]]); this is leaf CSS + script, not emitter work.
- Regenerate via `packages/ui/rete/scripts/codegen.mjs`; all six targets rebuilt.
- Beware [[feedback_snapshot_tests_cement_bugs]] — the existing FlowCanvasScreenshot baseline encodes today's unpadded body and unguarded dark rule; several of these fixes legitimately require a rebless, which must be diff-reviewed, not blind-accepted.
- ONE batched `vr.sh` union run at the END of the phase, not per-fix ([[feedback_batch_vr_across_quick_series]]); Linux-rendered baselines only ([[feedback_vr_linux_baselines]]).
- Docs: token surface changes flow into the generated theming page ([[project_theming_pages_generated]]).
- Changeset for `@rozie-ui/rete` across all six published leaves.

**Requirements**: RETE-01, RETE-02, RETE-03, RETE-04, RETE-05, RETE-06, RETE-07, RETE-08, RETE-09, RETE-10, RETE-11, RETE-12, RETE-13 (phase-local IDs, minted 2026-08-24 during /gsd-plan-phase 83 — deliberately NOT added to `.planning/REQUIREMENTS.md`, which is v1-milestone-scoped and unchanged since Phase 07.3; phases 76+ use phase-local IDs. Traceability for this phase runs through the D-01..D-27 decision register in `83-CONTEXT.md`.)

- **RETE-01** — Zero-import OS-dark theming contract: the light opt-out is honored on the five light-DOM targets and Lit's OS-dark default keeps working (D-01, D-22 guard half).
- **RETE-02** — Dark-palette key/value parity across the three hand-maintained dark blocks, guarded by a permanent drift test (D-19, D-20, D-21, D-22 palette half).
- **RETE-03** — Dark remaps for the three shadows, the socket ring, the selected-node shadow, and an accent-derived marquee (D-23, D-24, D-25).
- **RETE-04** — Keyboard focus affordance on canvas, control buttons, toolbar buttons and resize handles (D-02, D-03, D-04).
- **RETE-05** — Typography token surface: one-override font-family rebrand plus four per-role sizes (D-05, D-06).
- **RETE-06** — Overridable chrome tokenisation, with the deliberate exclusions recorded (D-07, D-08).
- **RETE-07** — Node `#body` slot padding as an overridable token (D-09).
- **RETE-08** — Socket geometry correctness: `--rozie-flow-socket-size` means rendered diameter and the edge nudge is derived (D-15, D-16, D-17, D-18).
- **RETE-09** — Incompatible-port feedback during a connection drag, with defensive teardown on every abort path (D-10, D-11, D-12, D-13, D-14).
- **RETE-10** — Node-drag cursor affordance (A7, Claude's discretion).
- **RETE-11** — Behavioral (non-pixel) cross-target coverage for the drag affordance (D-26).
- **RETE-12** — Generated theming and usage docs reflecting the 69-token surface, the corrected zero-import dark contract, the documented Lit gap, and a changeset across all six published leaves (D-13's documented boundary + the carried docs/changeset gates).
- **RETE-13** — One batched Linux-rendered VR run with a diff-reviewed, never blind-accepted rebless of both affected baselines (D-27 + the carried VR gates).

**Depends on:** Phase 82
**Plans:** 9/8 plans complete

Plans:
**Wave 1**

- [x] 83-01-PLAN.md — RED behavioral OS-dark-guard cell, the corrected `:root{@media{…}}` guard shape, and the emitted-leaf guard assertions (RETE-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 83-02-PLAN.md — RED dark-palette drift predicate, then the D-19/D-23/D-24/D-25 dark-side patch across all three blocks (RETE-02, RETE-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 83-03-PLAN.md — focus-ring + typography token mint and the `:focus-visible` / `font:` shorthand edits (RETE-04, RETE-05)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 83-04-PLAN.md — chrome/body/socket token mint plus socket geometry correction and the grab→grabbing cursor (RETE-06, RETE-07, RETE-08, RETE-10)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 83-05-PLAN.md — socket registry, incompatible-port marking, and defensive teardown (RETE-09)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 83-06-PLAN.md — mid-drag behavioral VR block in `rete-flow.spec.ts` (RETE-11)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 83-07-PLAN.md — regenerated theming + usage docs, the documented Lit dark gap, and the six-leaf changeset (RETE-12)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 83-08-PLAN.md — the single batched Linux VR union run and the blocking, diff-reviewed rebless (RETE-13)

### Phase 84: FlowCanvas edge routing via ELK bendpoints

**Goal:** Stop discarding ELK's computed edge routes. Quick 260826-h7k fixed the `autoArrange()` staircase (the port-geometry lie) but deliberately left the second half untouched: **ELK already routes skip/long edges correctly — its own routes were verified clean in every shape probed (chain+branch, diamond, wide fan-out → `hits: NONE`) — and we throw the answer away**, drawing a socket-to-socket bezier that cuts diagonally through whatever sits between. Tuned placement options only rescue the simplest chain case; on a diamond or a fan-out no straight chord can clear the intermediate nodes, so this needs real routing, not better placement.

Add an additive, optional `connection.waypoints?: {x,y}[]` to the public graph model, written by `autoArrange()` from `edge.sections[].bendPoints` (the plugin's `layout()` already returns the full `ElkNode`, edges included — the data is sitting there unused). Render through the EXISTING pure path dispatch at `FlowCanvas.rozie:2180-2184`, which is already a `(start, end) → d-string` seam alongside `bezier`/`step`/`smoothstep`/`straight`. Persisting in the model (rather than an internal Map) is a deliberate call: routes must survive reload, or the graph reloads to straight chords and the overlap returns.

Known hard part — **staleness**: a stored route is wrong the moment a node moves. Required rule: on drag commit, drop `waypoints` for every connection touching a moved node so it falls back to the plain chord. Design that invalidation carefully; it is the part most likely to ship subtly broken.

Scope reality check: this is a **public graph-model change across all six targets** — prop doc contract, the connection normalize path (`FlowCanvas.rozie:996`, `:1235`), 6 leaves, docs props table (codegen-enforced), and VR. Not a quick task; that is why it was split out rather than bolted onto 260826-h7k.

**Planning correction (2026-08-26):** the `FlowCanvas.rozie:996` / `:1235` citations above are STALE — the 260826-h7k commits shifted the file. The verified connection normalize path is `norm()` at `:2757-2764` and `edgeStyleSig()` at `:2766`. Planning also MEASURED that under the routing mode in effect today (`elk.edgeRouting: 'POLYLINE'`) ELK returns **zero bendpoints on every probed shape** — chain, diamond, fan-out — because it bends the placement rather than the edge. Consuming the route therefore requires switching to `ORTHOGONAL`; see `84-01-PLAN.md`'s `<planner_measurements>`.

**Requirements**: FR-01 (waypoints on the public graph model), FR-02 (autoArrange writes them from ELK edge sections), FR-03 (render through the existing seam, byte-identical fallthrough), FR-04 (edgeStyleSig redraw gate), FR-05 (staleness invalidation at drag AND resize), FR-06 (true path midpoint for a waypointed edge's label), FR-07 (prop-doc contract + 6 leaves + docs), FR-08 (undo/redo composition, executed not assumed)
**Depends on:** Phase 83
**Plans:** 2/2 plans complete

Plans:

- [x] 84-01-PLAN.md — measure ELK's edge output, then compute, persist and render the route end-to-end (wave 1)
- [x] 84-02-PLAN.md — scoped invalidation at both write-backs, undo/redo proof, union VR gate, changeset (wave 2)

### Phase 85: Volar-based .rozie language service across VS Code and IntelliJ

**Goal:** Give `.rozie` genuine TypeScript intelligence in BOTH editors from ONE implementation — a
thin vertical slice, not the full retirement. Rebuild `packages/language-server` **in place** on
Volar — hosting `volar-service-typescript` alongside a new `volar-service-rozie` that carries the
existing ROZ diagnostics and Rozie-semantic nav — promoting the proven Spike-018 virtual-TypeScript
generator into it (Volar `createVirtualCode` mapping
`<props>`/`<data>`/`<script>`/`<template>` into virtual TS with `CodeMapping`s back to exact `.rozie`
offsets), then wire BOTH clients: the VS Code extension, and the IntelliJ plugin migrated from
LSP4IJ to the **native platform LSP API** (floor 2026.1+, Community Edition dropped per REQ-V4).
Ship exactly the feature set already proven live in Spikes 018/019 — hover, go-to-definition,
completion, diagnostics, and type-checking **inside `{{ }}`**, all at carets sitting in injected
fragments. Rozie has no type intelligence today in any editor; this is a new capability class, not a
speed-up.

Includes three compiler prerequisites, each independently valuable: **REQ-V8** export
`RESERVED_SIGILS` from the `@rozie/core` barrel; **REQ-V9** unify core's two sigil lists (`$snapshot`
and `$classSelector` are shipped and in-use but missing from the "closed allow-list"); **REQ-V13**
`parseTemplate` error recovery for an unterminated `{{`, which today yields no interpolation node at
all — this blocks mid-typing completion and degrades half-typed-template diagnostics for every
consumer. Also closes **REQ-V11** by implementing slot-scope params (`#default="{ node }"`), the
largest residual class at ~250 of 699 corpus diagnostics.

Correctness instrument: twoslash-style `^?` expected-answer markers on the existing 80
`examples/*.rozie` probes — the corpus survey catches false errors but cannot catch a confidently
WRONG hover type — plus one deliberately-nested composition fixture (`r-for` inside a slot inside
`r-if`, with a component ref and scoped params), because every probe tests constructs in isolation
and the known failures are all nesting failures.

**Explicitly OUT of scope:** deleting the ~4,821 lines of semantic Kotlin (`completion/`,
`references/`, `xml/`, `inspection/`, `highlighting/`, `documentation/`, `refactoring/`, `structure/`,
`navigation/`). That deletion is irreversible and waits for a later phase, once the server has been
trusted in daily use. The 993-LOC `injection/` layer is KEPT permanently (REQ-V3) — Spike 017 proved
injection was never the obstacle; the LSP client was.

**Blueprint:** `.claude/skills/spike-findings-rozie/references/ide-language-tooling.md` (REQ-V1..V17),
with working sources in that skill's `sources/017-*`, `sources/018-*`, `sources/019-*`.
**Requirements**: REQ-V1..V17 (see `.planning/spikes/MANIFEST.md` → `### volar-language-tooling`)
**Depends on:** Phase 84
**Plans:** 6/7 plans executed

Plans:

- [x] 85-01-PLAN.md — TRACER: one `.rozie` file answers a real type question over the wire, and still reports ROZ (wave 1)
- [x] 85-02-PLAN.md — Port all seven ROZ analyzers onto the Volar server behind the identity-mapped source code (wave 2)
- [x] 85-03-PLAN.md — Compiler prerequisites: REQ-V9 sigil-list unification, REQ-V13 mustache recovery (wave 2)
- [x] 85-04-PLAN.md — IntelliJ native LSP reconciliation, 2026.1 floor, and TypeScript staged into both distributions (wave 2)
- [x] 85-05-PLAN.md — REQ-V11 slot-scope params, plus the nested-composition scope proof (wave 3)
- [x] 85-06-PLAN.md — Twoslash correctness instrument and the composition fixture (D5) (wave 4)
- [ ] 85-07-PLAN.md — Two-editor human acceptance, final corpus numbers, documentation, changeset (wave 5)

### Phase 86: Combobox v1 gap cluster — multi-select, floating popup via popover composition, and creatable mode

**Goal:** Close the three remaining ❌ cells in `docs/components/combobox-comparison.md`'s feature matrix, promoting ROADMAP 999.5 audit item 4 (which named combobox "the least-complete leaf in the whole audit"). Each lands ×6 targets via the dist+source standard with VR + docs, per `packages/ui/ADDING-A-FAMILY.md`:

1. **Multi-select / tags mode.** `@rozie-ui/combobox` is single-select today (one `model: true` `value` prop). Every incumbent models multiple (`downshift`'s `useMultipleSelection`, `react-select` `isMulti`, `vue-select` `multiple`, Headless UI / Kobalte / Bits / Ark `multiple`, `@angular/aria/multiselect`). `@rozie-ui/tags` already ships the `string[]` model and the caret-between-chips / paste-split / dedup interaction (Phase 60) — the open design question is whether combobox composes tags, absorbs its chip behavior, or grows a parallel `string[]` model. **Constraint:** the single-`value`-model stance is load-bearing — the comparison doc records that a second model would forfeit the clean Angular `ControlValueAccessor`, since a combobox is itself a form control. A `multiple` mode must not break CVA.
2. **Floating-positioned popup (auto-flip/shift).** The popup is `position: absolute` directly below the input, with no collision handling at a viewport edge. **This is composition, not construction:** `@rozie-ui/popover` already wraps `@floating-ui/dom` and exposes `placement` / `offset` / `disableFlip` / `disableShift` / `arrow` / `strategy`, and Phase 75 proved published-leaf composition (Option A) twice — data-table→popover and command-palette→combobox.
3. **Free-text / creatable.** The value is always one of the supplied `options`; there is no "allow arbitrary text as the value" mode (`react-select` creatable, `vue-select` `taggable`, React Aria `allowsCustomValue`, Ark `allowCustomValue`). Interacts with (1): creatable + multiple is how tag-entry UIs are actually used.

**Primary technical risk — the two-level composition chain.** `@rozie-ui/command-palette` already composes `@rozie-ui/combobox` as a published leaf. Adding popover under combobox makes it `command-palette → combobox → popover`, a **2-level** published-leaf chain; Phase 75 only proved one level. De-risk this first (a tracer that resolves and compiles the nested chain ×6) before any feature work — if the chain doesn't hold, item 2's shape changes entirely. Watch `resolveManifestProducer`'s upward `node_modules` walk and the peer-dependency cost each level pushes onto consumers.

**Explicitly OUT of scope** — the two virtualization *combination* gaps, which belong with the 999.5 item-3 virtualization round-out, not here:

- Sticky group headers across the windowed `:virtual` path (grouped virtualization).
- Variable-height / auto-measure windowing.

**Correction to ROADMAP 999.5 item 4 (stale as written):** it lists "no option groups" as a fourth gap. **Option groups shipped** — `groups` prop + `role="group"` headings + `groupHeading` slot + per-group `groupCap` with an expand-in-place "+N more" row. Opt-in vertical windowing (`:virtual`, `@tanstack/virtual-core`, ×6) also shipped. Only the three items above remain open.

**Requirements**: R1, R2, R3, R4, R5, R6 (locked in `86-SPEC.md`)
**Depends on:** Phase 85
**Plans:** 7/7 plans complete

Plans:

- [x] 86-01-PLAN.md — BLOCKING tracer: prove the `command-palette → combobox → popover` two-level chain end to end on the plain popup path (R4, R2)
- [x] 86-02-PLAN.md — Popover `keepMounted` + anchor-width matching via the `size` middleware, and the D-08 byte-identity proof (R2)
- [x] 86-03-PLAN.md — Move the grouped, capped, and windowed branches onto the composed popover path; behavioral + VR proof (R2)
- [x] 86-04-PLAN.md — Multi-select through the widened sole `value` model: `multiple` prop, toggle algorithm, selection ARIA (R1)
- [x] 86-05-PLAN.md — Chip rail inside the control, `#chip` slot, Backspace-removes-last, chip theming tokens (R1)
- [x] 86-06-PLAN.md — Creatable mode: `creatable` prop, `create` event, `#create` slot, navigable create row (R3)
- [x] 86-07-PLAN.md — Prohibition gate, comparison-matrix flip + surface hash, peer bump ×6, and the 18-leaf changeset (R1, R3, R5, R6)

### Phase 87: @rozie-ui/data-table horizontal (column) virtualization + content-driven auto-measure

**Goal:** Close the last two "what Rozie defers" bullets in `data-table-comparison.md` by extending the shared `@rozie-ui/headless-core` `windowing.rzts` engine — which windowed the row axis only — along two orthogonal dimensions: **(A) horizontal/column virtualization** (`virtual` widens to `false | true | 'rows' | 'columns' | 'both'`, with `true` unchanged from today) and **(B) content-driven auto-measure** (`autoMeasure`, a new independent Boolean that feeds `estimateSize()` a running mean of measured row heights so `getTotalSize()` converges on the true content total instead of staying pinned at `rowCount x estimateRowHeight`). Opt-in, byte-identical when off, red-first behavioral specs ×6. Because `windowing.rzts` is `private: true` and dissolves into consumers at compile time, touching it changes the emitted output of all four consumers that use it — data-table, listbox, combobox, and command-palette — making the release wave 18 leaves (listbox excluded — see below) rather than 6. Data-table gets both features in full; listbox/combobox/command-palette get only the mechanical host-contract one-liners (`rowsWindowed()`, `autoMeasureOn()`) preserving today's exact semantics, no behavior change (their own "deep virtualization" gap is explicitly deferred to a future phase per ROADMAP 999.5 item 3). A blocking first plan (D-22) extracts `DataTable.rozie`'s framework-agnostic pure helpers into colocated `.ts` modules before any feature work lands, so the ~3,200-line script the phase edits is smaller going in.

**Decisions:** D-01 through D-22, locked in `87-CONTEXT.md` (value-grammar shape, `rdt-scroll` wrapper ownership, `table-layout: fixed` on the windowed-columns path, absolute column indexing, header/filter-row windowing with clamped colspan, the scroll-then-focus seam extended to both axes, per-axis fill-drag edge auto-scroll, the running-mean auto-measure accumulator with anchor-preserving scroll correction, and the 18-leaf release wave).

**Depends on:** Phase 64 (`@rozie-ui/headless-core`, the shared `windowing.rzts`/`listCore.rzts` engine this phase extends); Phase 53 (the original row-axis virtualization `windowing.rzts` was lifted from); Phase 86 (immediately prior — source of the additive-patch / prove-byte-identity discipline this phase's `true`-path-unchanged guarantee follows).

**Plans:** 8/8 plans complete, plus 3 gap-closure sessions (87-09/87-10/87-11) closing findings surfaced by the phase's own final gate.

Plans:

- [x] 87-01-PLAN.md — BLOCKING prerequisite (D-22): extract `DataTable.rozie`'s framework-agnostic pure helpers into colocated `.ts` modules; found and fixed a real `inlineScriptPartials()` tree-shaking gap along the way; dist-parity zero drift + data-table VR green
- [x] 87-02-PLAN.md — `rowsWindowed()`/`colsWindowed()`/`isWindowed()` host-contract predicates replace all 14 bare `$props.virtual` truthiness sites (D-05), plus a machine-enforced prohibition gate against regression
- [x] 87-03-PLAN.md — `virtual` widens to the `false|true|'rows'|'columns'|'both'` grammar (D-01) with `true`/`false` byte-identical; `autoMeasure` lands as an inert opt-in Boolean (D-02); 60-column demo + RED-first column-virtual/auto-measure spec batteries (18 genuinely red)
- [x] 87-04-PLAN.md — The column-windowing tracer: a second horizontal `Virtualizer` instance genuinely windows the leaf-column axis on all six targets, plus a discovered-and-fixed cross-cutting Lit emitter bug (a `[Boolean,String]` union prop's converter silently discarded string values)
- [x] 87-05-PLAN.md — `forcedColumns()` unions pinned + active-cell + editing columns into the window (D-10); every header level (incl. grouped) and the Phase 72 filter row window on the body's exact slice with clamped colspan (D-11); D-14's deliberate no-op recorded and proven by absence
- [x] 87-06-PLAN.md — D-08 absolute-column-index proof; D-12's scroll-then-focus seam extended to either/both axes; D-13's per-axis fill-drag edge auto-scroll, closing a pre-existing vertical-axis gap for free; a genuine pre-existing `focusCell` emit-guard bug fixed en route
- [x] 87-07-PLAN.md — `estimateSize()` returns a genuine running mean of measured row heights when `autoMeasure` is on (D-15), anchor-preserving scroll correction (D-16); D-19's "it fails today" premise re-confirmed false for a third time on this plan's own dataset
- [x] 87-08-PLAN.md — Close the phase: flip the comparison matrix + regenerate `surface_hash`, document both features (D-17, D-19, D-20 corrected status), compose the release changeset against the actual `pnpm release:ready` gate (18 `@rozie-ui/*` leaves + `@rozie/core`, not the literal 24 — listbox is never-published/ignore-listed, `@rozie/core` had an independently-caught release drift), one batched Linux-Docker VR union run green, stopped at commit
- [x] 87-09 (gap closure) — `dir="rtl"` column windowing: live `isColRtl()` + `MutationObserver` re-feed; green on 5/6 targets (Svelte blocked on a pre-existing, unrelated rendering gap)
- [x] 87-10 (gap closure) — Solid auto-measure rendering gap: `bumpWindowVer()` microtask-coalescing in the shared engine closes a framework-agnostic virtual-core `onChange` burst that only Solid's non-batched reactivity exposed; `data-table-auto-measure.spec.ts` 50/4-skip → 54/54
- [x] 87-11 (gap closure) — TS7053 strict-typecheck baseline drift: corrected misattribution (actual origin was 87-05 Task 1's `windowedHeadersFor()`, not 87-09) via full commit-range bisection; both typecheck gates green
