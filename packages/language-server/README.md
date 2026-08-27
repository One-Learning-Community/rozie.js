# `@rozie/language-server`

The `.rozie` language service. One process, hosting real TypeScript type intelligence and
`@rozie/core`'s own ROZ diagnostics together, consumed by two editors — the VS Code extension
(`tools/textmate`) over `vscode-languageclient`, and the JetBrains plugin (`tools/intellij-plugin`)
over the native platform LSP API (`com.intellij.platform.lsp.*`, IDEA Ultimate / WebStorm / PhpStorm
family, 2026.1+). Neither editor implements Rozie-specific logic of its own — both are thin LSP
transport clients pointed at the identical `dist-standalone/server-standalone.cjs` bundle.

This package is private (`"private": true`) — it is not published, and versions only as a side effect
of whichever editor distribution stages it.

## Why this exists

Before Phase 85, `.rozie` had no type intelligence anywhere: `$props.foo` navigated to its
declaration but was not typed, `{{ }}` expressions were unchecked, and slot-scope parameters inferred
nothing. The server built on [Volar](https://volarjs.dev)'s `createServer` closes that gap once, for
both editors, by generating a virtual TypeScript document from every `.rozie` file and running a real
`ts.LanguageService` over it — the same architecture Vue, Svelte, and Astro use for their own SFC
formats.

## The two-code virtual-document shape

`volar/languagePlugin.ts`'s `rozieLanguagePlugin.createVirtualCode()` emits **two** embedded codes for
every `.rozie` file, not one:

1. **`root`** (`languageId: 'typescript'`) — the generated virtual TypeScript source from
   `generateVirtualTs` (`volar/virtualCode.ts`). This is the ONLY code that ever enters the TS
   `Program`; it is what `volar-service-typescript` sees, and it is where hover, completion, and
   semantic diagnostics for `$props`/`$data`/`$refs`/template expressions come from.
2. **`rozie-source`** (`languageId: 'rozie'`) — an **identity-mapped** copy of the raw, unmodified
   `.rozie` text: one `CodeMapping` covering the whole file with `sourceOffsets: [0]` and
   `generatedOffsets: [0]`.

The second code exists because of a property of Volar's own dispatch, not a Rozie-specific quirk.
Every Volar service plugin is always handed one of a file's *embedded/generated* documents — never
the raw source document directly — and whatever range that plugin returns is assumed to be expressed
in that embedded document's own coordinate space, then auto-reverse-mapped back to the host file
through its `CodeMapping`. `@rozie/core`'s existing analyzers (`diagnostics.ts`, `features.ts`,
`outline.ts`, `componentNav.ts`, `symbols.ts`, `sigil.ts`, `producers.ts`) already compute positions
in **host `.rozie` coordinates** — they call `compile()` and `doc.positionAt(...)` on the raw text
directly, the same way they did before this server existed. Handing them the generated-TypeScript
document would parse the wrong text entirely; handing them the raw text but letting Volar reverse-map
through the *TypeScript* document's mapping would silently misplace every range, because those offsets
were never expressed in that coordinate space to begin with.

The `rozie-source` embedded code is the fix, ported from the identical pattern Vue's own
`vue-compiler-dom-errors.ts` service plugin uses: every Rozie-specific provider
(`plugins/rozieDiagnostics.ts`, `rozieHover.ts`, `rozieSymbols.ts`, `rozieNavigation.ts`,
`rozieCompletion.ts`, `rozieRename.ts`) decodes the embedded-document URI it was called with and
**declines** (returns `undefined`) unless it decodes to `rozie-source`. Inside that guard, the
`document` handed to the provider is byte-identical to the `.rozie` file, so every existing analyzer
function runs completely unmodified — no fork, no rewrite, just a coordinate-space guard around the
call site.

One further wrinkle this shape creates: the `document.uri` Volar hands a provider is the embedded
document's own `volar-embedded-content://...` URI, not the plain `.rozie` `file://` URI. Any code that
resolves a path relative to that URI (`resolveComponentUri`, `compile()`'s own `<components>` import
resolution) needs the real source URI first, or relative-path resolution silently targets a nonsense
location. `featureContext.ts`'s `toSourceDocument(context, document)` reconstructs a `TextDocument`
with the corrected URI before any cross-file-resolving provider runs; every provider that touches
`<components>` composition applies it.

## How TypeScript is resolved

VS Code's LSP client sends `initializationOptions.typescript.tsdk` on `initialize`. IntelliJ's native
platform LSP client sends **none** — if the server assumed a client-supplied tsdk the way most Volar
consumers do, IntelliJ would silently get no type intelligence at all, with no error surfaced anywhere.
`volar/tsdk.ts`'s `resolveTsdkPath` instead runs a five-layer resolution chain, first hit wins:

1. the client-supplied `initializationOptions.typescript.tsdk` (VS Code)
2. the `ROZIE_TSDK` environment variable (explicit escape hatch for monorepo dev/CI)
3. a `typescript/lib` directory staged beside the running server module (what both editor packagers
   stage — see "Distribution" below)
4. `typescript/lib/typescript.js` resolved from the first workspace folder's own `node_modules`
5. a resolution from the server module itself — what makes plain monorepo development work, via the
   hoisted `typescript` dependency at the repo root

A total miss is **not** an error: the server logs and degrades to `createSimpleProject` plus
ROZ-diagnostics-only. A server that answers nothing but ROZ diagnostics is strictly better than one
that throws or refuses to start.

**Why TypeScript cannot be inlined into the standalone bundle.** Both tsdown configs
(`tsdown.config.ts`, `tsdown.standalone.config.ts`) keep `typescript` as an explicit `external`
dependency — everything else (`@rozie/core`, the `@volar/*` packages, `@babel/*`, `postcss`,
`htmlparser2`, the `vscode-languageserver` libs) is inlined into one self-contained CJS file, but
`typescript` is not. `loadTsdkByPath` needs a real directory on disk: TypeScript reads its own
`lib.*.d.ts` declaration files from that directory at runtime, not from an inlined bundle. This is
also why both editor distributions stage an actual `typescript/lib` directory alongside the server
binary rather than trying to bundle TypeScript away (see "Distribution").

## Distribution

Both editors ship the identical `dist-standalone/server-standalone.cjs`, staged alongside a filtered
TypeScript runtime subset — the library entry point (`typescript.js`) plus `lib.*.d.ts` declaration
files only, not `tsc.js`/`tsserver.js`/locale directories (~11 MB vs. the full ~22 MB `typescript/lib`)
— everything the tsdk resolution chain above actually loads, nothing it doesn't.

- **IntelliJ plugin** (`tools/intellij-plugin`): the Gradle `bundleLanguageServer` task copies the
  standalone bundle plus the filtered TypeScript subset into the plugin's own resources directory,
  gated `onlyIf { serverBundleFile.asFile.exists() }` so a Node-free CI build still succeeds. Node
  itself is resolved at runtime through the platform's own `NodeJsInterpreterManager` — the same
  service every JS/TS feature in the IDE uses — not a hardcoded path list.
- **VS Code extension** (`tools/textmate`): `pnpm bundle:server` mirrors the identical staging filter
  into `server/`, packaged into the `.vsix` via `vsce`.

Both distributions layer the same override convention for monorepo development: an environment
variable (`ROZIE_LSP_SERVER` / `ROZIE_LANGUAGE_SERVER`) or an editor setting can point at the live
`packages/language-server/dist-standalone/server-standalone.cjs` build instead of the staged copy.

## Verification instruments

Four instruments exist, in increasing cost order — each one exercises the production code path (the
built `dist/index.mjs`, or the shipped `dist-standalone/server-standalone.cjs`), never a forked or
reimplemented copy.

1. **Wire probes** (`src/__tests__/volar/wire.probe.test.ts`, `providers.wire.test.ts`) — spawn the
   exact shipped `dist-standalone/server-standalone.cjs` bundle over real Content-Length-framed stdio
   and drive it with real LSP requests (`initialize`, `hover`, `textDocument/definition`, etc.). The
   cheapest instrument that exercises the real wire protocol, seconds per run.
   ```
   pnpm --filter @rozie/language-server test -- wire.probe providers.wire
   ```
2. **Pinned assertions** (`src/__tests__/volar/virtualCode.prove.test.ts`, `slotScope.test.ts`,
   `recovery.test.ts`) — load the production `generateVirtualTs` + `rozieLanguagePlugin` directly into
   a real `ts.LanguageService` (no LSP transport) and assert specific hover/definition/diagnostic
   results at named offsets, including the standing REQ-V6 (module-scope collision) and REQ-V7
   (host-construction) regression guards.
   ```
   pnpm --filter @rozie/language-server test -- volar/virtualCode.prove volar/slotScope volar/recovery
   ```
3. **Twoslash correctness markers** (`src/__tests__/twoslash/`) — `^?`-style expected-answer markers
   (a native `// ^?` spelling inside `<script>`, and an empirically-verified-inert trailing
   `<!-- ^? -->` spelling inside `<template>`) placed in 72 of the 80+ shipped `examples/*.rozie`
   probes. Each marker's recorded quick-info answer is snapshotted
   (`src/__tests__/twoslash/__snapshots__/*.snap`) and re-asserted on every run — the one instrument
   that can catch a *confidently wrong* answer, not just a false error, because the corpus survey
   below only counts diagnostic presence. `inertness.test.ts` is a standing guard proving the markers
   themselves change zero bytes of compiled output across all six targets.
   ```
   pnpm --filter @rozie/language-server test -- twoslash
   ```
4. **Corpus survey** (`scripts/survey.mjs`) — runs the production `generateVirtualTs` over every real
   `.rozie` file under `examples/` and `packages/ui/` and reports how many produce diagnostics, grouped
   by TypeScript diagnostic code (REQ-V12 — report failure *classes*, never a headline percentage; the
   class table is the primary output, the clean-rate one line beneath it).
   ```
   pnpm --filter @rozie/language-server survey
   ```
   `ROZIE_SURVEY_STRICT=1` reruns the same corpus with `compilerOptions.strict` imposed — the deliberate
   escape hatch for the on-demand stricter comparison (measured a 7.3× diagnostic inflation on the same
   corpus in Phase 85's research; `createTypeScriptProject` itself never imposes `strict` on a
   consumer's own `tsconfig`, so the survey's default run does not either — REQ-V10).

A fifth instrument — a human, in a running IDE, on real files — is the most expensive and the last
resort. It is what Plan 85-07's checkpoint task exercises directly; it is not automatable and is not
part of this package's own `test`/`survey` scripts.

## Recorded corpus baseline

The survey corpus is `examples/` + `packages/ui/` — real shipped `.rozie` sources, not test fixtures.
Movement across the phase, by class, not headline percentage alone:

| Checkpoint | Files | Clean | Diagnostics | Generator failures |
|---|---|---|---|---|
| Phase opening baseline (Plan 85-01) | 387 | 51.2% (198) | 699 | 0 |
| Plan 85-03 — sigil unification + `{{` recovery (REQ-V9, REQ-V13) | 387 | 51.9% (201) | 660 | 0 |
| Plan 85-05 — scoped-slot-fill parameters (REQ-V11) | 387 | 70.3% (272) | 330 | 0 |
| Plan 85-07 — final (corpus gained 1 file: `SlotCompositionProbe.rozie`, Plan 85-06) | 388 | 70.1% (272) | 333 | 0 |

The final +1 file / +3 diagnostics movement from the 85-05 number is **not** a regression — it is
`examples/SlotCompositionProbe.rozie`, the deliberately-nested composition fixture Plan 85-06 added to
the survey corpus, whose own design includes intentional "does this name leak out of its scope"
negative probes (unresolved-identifier diagnostics proving a slot parameter or loop alias does *not*
leak past its own scope) — a passing test, not a false error, counted the same as everything else this
survey measures.

Retired classes across the phase: the missing-sigil class (`$snapshot`/`$classSelector` — 66
diagnostics, Plan 85-03) and the scoped-slot-parameter "Cannot find name" family (330 diagnostics, the
single largest class in the opening baseline, Plan 85-05) are both gone outright.

**Two classes the phase deliberately did not chase**, named as open findings rather than netted away —
apparently-genuine source bugs the survey surfaced, not Rozie language-service gaps:

- `TS2339 Property 'rootEl' does not exist on type 'MiniListEngine'` — **15** occurrences
- `TS2339 Property 'disposers' does not exist on type 'MiniListEngine'` — **12** occurrences

Both point at a real typing gap in `MiniListEngine`'s own source, not at anything this phase's
compiler or Volar work could fix — flagged in CONTEXT.md from the start as "a separate concern."

The remaining residual diagnostics (`TS2349` void-not-callable, `TS2339` on `unknown`/`MiniEngine`,
`TS2698` spread-on-unknown, `TS2307` module-not-found, `TS2554` argument-count, and a handful of
single-digit classes) are pre-existing source-shape issues in the specific example/component files
that trigger them — none of them are Volar wiring bugs, and none of them grew during this phase.

## Package layout

```
src/
  server.ts                    entry point — Volar createServer/createConnection, composes
                                volar-service-typescript + createRozieServicePlugins()
  volar/
    languagePlugin.ts           the LanguagePlugin: two embedded codes per .rozie file
    virtualCode.ts               generateVirtualTs — the .rozie -> virtual TS generator
    tsdk.ts                      the 5-layer TypeScript self-resolution chain
    featureContext.ts            readDoc + toSourceDocument (the cross-file URI fix)
    sigils.ts                    ambient TS declarations, derived from @rozie/core's RESERVED_SIGILS
    plugins/                     the 7 Rozie service plugins (diagnostics, hover, symbols,
                                  navigation, completion, rename) + createRozieServicePlugins()
  diagnostics.ts, features.ts,   the ORIGINAL ROZ analyzer modules (pre-Volar), consumed
  outline.ts, componentNav.ts,   unmodified by the volar/plugins/ wrappers above — host-coordinate
  symbols.ts, sigil.ts,          logic, never touched by Volar's generated-document dispatch
  producers.ts
scripts/survey.mjs               the corpus survey instrument (verification instrument 4 above)
```
