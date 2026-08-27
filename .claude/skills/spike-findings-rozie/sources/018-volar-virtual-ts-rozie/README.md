---
spike: 018
idea: volar-language-tooling
name: volar-virtual-ts-rozie
type: standard
validates: "Given a .rozie file, when a Volar createVirtualCode maps <props>/<data>/<script>/<template> into a virtual TS module, then $props.foo hovers with its declared type, an unknown prop errors, and a type error inside {{ }} maps back to the right .rozie range"
verdict: VALIDATED
related: [017, 019]
tags: [volar, typescript, virtual-code, source-mapping, ide-tooling, type-intelligence, rozie-core, survey]
---

# Spike 018: volar-virtual-ts-rozie

## What This Validates

**Given** a `.rozie` file, **when** a Volar `createVirtualCode` maps `<props>` / `<data>` / `<script>` /
`<template>` into a virtual TypeScript module, **then** `$props.foo` hovers with its *declared* type,
an unknown `$props.bar` errors, and a type error inside `{{ }}` maps back to the correct `.rozie` range.

This is the **value half** of the idea. Spike 017 established that JetBrains *can* serve LSP caret
features; 018 asks whether there is anything worth serving. It is independently valuable: it lands VS
Code type intelligence regardless of how the IntelliJ side resolves.

The prize is not speed. **Rozie has no type intelligence today, in any editor.** `$props.foo`
navigates but is not typed; `{{ }}` expressions are unchecked; slot-scope params are inferred as
nothing. This is a capability class the project has never had.

## Research

### Does `@rozie/core` already expose what Volar needs?

Yes — and this was the single biggest de-risking finding. `parse()` returns:

| What Volar needs | What core already gives |
|---|---|
| Absolute block offsets | `ast.props.loc / .data.loc / .script.loc / .template.loc` → `{start, end}` |
| Per-prop key positions | `ast.props.expression` is a **Babel `ObjectExpression` with absolute `start`/`end` on every node**, including each key |
| Template expression positions | `TemplateInterpolation.loc` + `rawExpr`; attributes carry `valueLoc` |
| `r-for` / directive values | `attributes[].kind` ∈ `event` \| `binding` \| `directive`, each with `value` + `valueLoc` |

No new parser work, no offset bookkeeping. The compiler is already the source of truth for exactly
the data the language service needs — which is the whole argument for the Volar approach over
re-deriving it in Kotlin.

### Approach comparison

| Approach | Verdict |
|---|---|
| Hand-rolled LSP with our own type inference | **Rejected.** Re-implements TypeScript. This is what `packages/language-server` does today (symbols + nav, no types) and precisely why it has no type intelligence. |
| TS language-service plugin only (`tsconfig` `plugins`) | **Partial.** Gives `.rozie` types to *importing* `.ts` files, but nothing inside the `.rozie` file itself. Also the path most exposed to the TS 7 risk below. |
| **Volar `createVirtualCode` + virtual TS** | **Chosen.** The mechanism Vue / Svelte / Astro all use; JetBrains bundles all three. TypeScript does the type work; we only map offsets. |

**Chosen: Volar.** Versions: `@volar/language-core` + `@volar/typescript` 2.4.28, TypeScript 5.6.3
(matching the repo).

### Documented timing risk — TypeScript 7 / `tsgo` (researched, not spiked)

TypeScript 7's native port dropped the language-service-plugin model, and does not yet expose a
stable programmatic API. Vue, Svelte, and Astro template type-checking **cannot run on TS 7.0**;
Microsoft targets ~7.1 (≈ Oct 2026) for the API Volar needs. There is nothing to build against, so
this is recorded rather than spiked. It is a *timing* risk, not a feasibility one — and we would be
in exactly the same boat as Vue, Svelte, and Astro, which is the right company.

## How to Run

```bash
cd .planning/spikes/018-volar-virtual-ts-rozie
npm install          # standalone; NOT a pnpm workspace member

node prove.mjs       # 11 assertions against a real TypeScript LanguageService
node survey.mjs      # the depth pass: every real .rozie in the repo
LOOSE=1 node survey.mjs   # same, with noImplicitAny off (realistic consumer config)
node report.mjs      # writes report.html — side-by-side source <-> virtual TS
```

## What to Expect

- `prove.mjs` → `11 passed, 0 failed`
- `survey.mjs` → 387 files, ~33% clean strict / ~51% clean loose, 0 generator failures, ~5ms/file
- `report.html` → highlighted mapping chunks; hover one to light its partner

## Observability

`report.html` is the forensic layer. Every `CodeMapping` chunk is painted on **both** sides and
cross-linked on hover, so a bad mapping is visible rather than inferred. `survey.mjs` groups
diagnostics by TS code so failure *classes* surface instead of individual noise.

## Investigation Trail

**1. Generator, first cut.** Emit an `interface __RozieProps` from the `<props>` Babel AST (mapping
each generated key back to its source key so go-to-definition works), infer `$data` via
`typeof __rozieDataInit`, declare the ambient sigils, then append the `<script>` body verbatim and
every template expression wrapped so TS checks it in scope.

**2. Two bugs, caught by reading the output rather than trusting it.** Interpolations were emitted
*twice* (the walker recursed into `children` in both the `TemplateElement` branch and the trailing
generic branch), and `:disabled` was emitted *not at all* — I had guessed `kind === 'bind'`; the
parser actually emits `kind === 'binding'`. Both only visible because the generated TS was printed
and inspected. 10 chunks → 9 correct ones.

**3. The TS-plugin wiring is the wrong entry point for a standalone host.** First attempt used
`decorateLanguageServiceHost` + `createProxyLanguageService` — the *tsserver plugin* path. The
`.rozie` file never entered the Program. Two distinct causes, in order:

- `decorateLanguageServiceHost` only **overrides** `getScriptKind` when the host already defines
  one. Mine didn't, so TS inferred ScriptKind from the `.rozie` extension, failed, and silently
  dropped the file. *Silently* — no diagnostic, just an absent source file.
- Even fixed, that path expects tsserver to have registered `extraFileExtensions` at project level.

Switching to `createLanguageServiceHost` (Volar's *language-server* entry point, which owns the
`.rozie` → virtual `.ts` handling itself) put the file in the Program immediately.

**4. Isolating the Volar layer from the TS layer paid off.** Rather than guessing which half was
broken, a six-line probe asserted the Volar side alone: `sourceScript` present, `languageId: 'rozie'`,
`generated: true`, service script `.ts` / ScriptKind 3, virtual length 613. Volar was perfect
throughout; every failure was in my TS host wiring.

**5. Virtual code MUST be a module.** With the first green run, the *clean* fixture reported
`Cannot redeclare block-scoped variable '$props'`. Each virtual file was a **global script**, so
every `.rozie` file's `$props` / `$data` / `__RozieProps` landed in the shared global scope and the
second file collided with the first. Appending `export {};` gives each file its own module scope.
This is a real design requirement, not a fixture artifact — it only appears with ≥2 files, which is
every real project.

**6. A harness bug that masqueraded as a Volar bug.** `Cannot find name 'Record'` / `'HTMLElement'`
persisted, and `toFixed` erroring on `string` was the tell — that is what "no lib loaded at all"
looks like. The Program contained only the two `.rozie` files. Cause: when rewriting the harness I
dropped the filesystem fallback from the `sync` callback, and TypeScript reads `lib.*.d.ts` through
that same path. Restoring it: **11/11**.

**7. Depth pass — one fixture is not a verdict.** `survey.mjs` ran the pipeline over **387 real
`.rozie` files** (`examples/` + `packages/ui/`). First result: **22.2% clean, 5,134 diagnostics**.
Taken at face value that reads like failure. Grouping by TS code showed otherwise — every large class
was mine:

| Class | Count | Cause |
|---|---|---|
| `$watch` / `$onMount` / `$model` / `$computed` / `$event` not found | 725 | preamble declared 4 of ~23 magic identifiers |
| `item` / `cell` / `row` / `header` / `node` / `opt` not found | 591 | `r-for` aliases + slot-scope params had no scope |
| implicit `any` (`instance`, `e`, `v`) | ~600 | forced `strict: true` with no project tsconfig |

**8. Fixing the two clearly-incidental classes.** Full ambient preamble (mirroring core's
`RESERVED_SIGILS` + lifecycle call-forms), and real `r-for` scoping — `r-for="(item, i) in coll"`
emits `for (const item of (coll) as any[]) { … }` so aliases get their true element type instead of
"Cannot find name". Result: **33.3% clean, 3,245 diagnostics**. Every sigil error gone; `item`
100 → 24 (the remainder are slot-scope params, a different mechanism).

**9. Separating my strictness from real gaps.** The survey forced `strict: true` on files whose own
projects are not strict — unrealistic, since the real server reads the user's `tsconfig`. With
`noImplicitAny` off: **51.2% clean, 699 diagnostics** — down from 5,134, a 7.3× reduction.

**10. Two adjacent findings worth filing** (see Results).

## Results

### Verdict: ✅ VALIDATED

`prove.mjs` — **11 assertions, 0 failures**, against a real `ts.LanguageService`:

| # | Assertion | Evidence |
|---|---|---|
| 1 | `{{ $props.label }}` hovers as string | `(property) __RozieProps.label: string` |
| 2 | `:disabled="$props.disabled"` hovers as boolean | `(property) __RozieProps.disabled: boolean` |
| 3 | `<script>` `$data.clicks` inferred from `<data>` | `(property) clicks: number` |
| 4 | clean file reports **no** false errors | 0 diagnostics |
| 5–6 | unknown `$props.bogus` errors, mapped onto `bogus` | L15 @198, exact token |
| 7–8 | type error **inside `{{ }}`** caught + mapped | `toFixed` L21 @276, exact token |
| 9 | go-to-definition crosses blocks | `$props.label` → `label` key at L4 in `<props>` |
| 10–11 | completion after `$props.` = exactly `count, disabled, label` | nothing leaked |

Assertions 7–9 are the ones that matter most. **7–8** is template type-checking — TypeScript reaching
inside `{{ }}` and reporting against the right `.rozie` bytes. **9** is cross-block navigation
falling out of the type system for free, rather than from the 1,163 LOC of hand-written Kotlin in
`references/`.

### Performance is a non-issue

**5.1 ms/file cold across 387 files, including TS program construction.** Whatever the argument for
this architecture is, "our current thing is slow" does not need to carry it — and nothing here will
be the bottleneck.

### Real-world readiness

| Config | Clean | Diagnostics | Generator failures |
|---|---|---|---|
| Initial, `strict` | 22.2% | 5,134 | 0 |
| + full sigils + `r-for` scope, `strict` | 33.3% | 3,245 | 0 |
| + realistic (`noImplicitAny` off) | **51.2%** | **699** | **0** |

**Zero generator failures on 387 real files** — the generator never threw, including on
`FlowCanvas.rozie` and `DataTable.rozie`, the two largest components in the repo. Robustness is not
the problem.

The remaining 699 fall into three named, bounded classes:

1. **Slot-scope params** (~250) — `#default="{ node }"` binds names the generator does not yet
   introduce. Structurally identical to the `r-for` fix already proven in step 8; not a new problem,
   just unimplemented.
2. **Missing sigils** (~66) — `$snapshot`, `$classSelector`. See finding below.
3. **Apparently-genuine type errors** — e.g. `Property 'rootEl' does not exist on type
   'MiniListEngine'` (15), `disposers` (12). These may be real defects in shipped `.rozie` sources.
   **Not investigated here** — flagged for 019/implementation. If they are real, this spike found
   live bugs as a side effect of building a type checker, which is itself an argument for the feature.

### Adjacent finding: core's "authoritative" sigil list is incomplete

`RESERVED_SIGILS` in `packages/core/src/semantic/validators/reservedIdentifierValidator.ts` is
documented as the closed allow-list (16 entries). But `$snapshot` and `$classSelector` are **real,
shipped, in-use sigils** — present in `packages/ui/sortable-list`, `packages/ui/chartjs`, and others —
and absent from it. They live in a **second, separate partial list** in
`packages/core/src/reactivity/computeDeps.ts`.

This matters directly for the "mirror, don't fork" principle: a language server that imports
`RESERVED_SIGILS` as the single source of truth will be missing sigils the language actually
supports. The lists should be unified before the server consumes them. Filed as REQ-V9.

### Adjacent finding: `RESERVED_SIGILS` is not on the `@rozie/core` barrel

It is exported from its module but not re-exported from `packages/core/src/index.ts`. Per the
established convention that core's public symbols are consumed via the bare `@rozie/core` barrel, the
server cannot import it today without a deep path. One-line compiler task. Filed as REQ-V8.

### Surprises

- **`@rozie/core` needed no changes to supply the mapping data.** The Babel `ObjectExpression` with
  absolute offsets on every `<props>` key was already exactly right for go-to-definition. This was
  the largest unknown going in and it evaporated in the first probe.
- **A silent failure mode in Volar's TS-plugin path.** `getScriptKind` being *conditionally* wrapped
  means an incomplete host loses files from the Program with no error at all. Worth knowing before
  019.
- **The headline survey number was almost the wrong conclusion.** 22.2% clean looks like "this
  doesn't work." Grouping by failure class turned it into a to-do list of my own omissions, and the
  same corpus reached 51.2% within an hour. Report classes, never totals.
