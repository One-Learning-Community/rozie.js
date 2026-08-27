# IDE Language Tooling — Volar virtual TypeScript for `.rozie`

Serve BOTH VS Code and JetBrains from one Volar-based language server that maps `.rozie` into
virtual TypeScript, retiring ~4,821 lines of bespoke semantic Kotlin.

**Status: feasibility fully proven.** 017 (gate), 018 (virtual TS, 11/11), 019 (in-IDE, 7/8).

## Requirements

From the `volar-language-tooling` idea. Non-negotiable.

- **REQ-V1 — platform floor 2026.1+.** Bumping `pluginSinceBuild` off 2024.2.5 is authorized. Most
  of the retirable Kotlin surface maps to LSP features that postdate the old floor.
- **REQ-V2 — migrate LSP4IJ → native platform LSP API.** LSP4IJ has **zero** references to
  `InjectedLanguageManager` / `VirtualFileWindow` / `DocumentWindow` anywhere in its repository. It
  cannot serve a caret inside an injected fragment, ever. Architectural, not a version gap.
- **REQ-V3 — KEEP the injection layer.** `RozieMultiHostInjector` and `injection/` (993 LOC) stay.
  Injection was never the obstacle; the LSP client was. Injection provides in-block HTML/CSS/JS PSI,
  Emmet, folding, and coloring for free, and the native LSP API is designed to coexist with it.
- **REQ-V4 — drop IntelliJ IDEA Community Edition / Android Studio.** Decided by Dan 2026-08-26.
  Single native-LSP path, no dual-client. CE users are served by the VS Code extension consuming the
  same server. `plugin.xml` drops `<depends>com.redhat.devtools.lsp4ij</depends>`; the marketplace
  listing must state Ultimate/WebStorm/PhpStorm-family only.
- **REQ-V5 — static source verdict before GUI probe** when the question is structural.
- **REQ-V6 — virtual code MUST end with `export {};`.**
- **REQ-V7 — use `createLanguageServiceHost`, not the tsserver-plugin path.**
- **REQ-V8 — export `RESERVED_SIGILS` from the `@rozie/core` barrel.**
- **REQ-V9 — unify core's two sigil lists** (`RESERVED_SIGILS` is incomplete).
- **REQ-V10 — read the consumer project's own `tsconfig`; never impose `strict`.**
- **REQ-V11 — slot-scope params still unimplemented** (`r-for` is done).
- **REQ-V12 — report failure CLASSES, never totals.**
- **REQ-V13 — `parseTemplate` needs error recovery for unterminated `{{`.**
- **REQ-V14 — IntelliJ live-template entries merge into the LSP completion popup** (polish).
- **REQ-V15 — do NOT declare the LSP module in Gradle.**
- **REQ-V16 — two VS-Code-shaped assumptions break under IntelliJ, both silently.**
- **REQ-V17 — 2026.x platform archaeology gotchas.**

## How to Build It

### 1. The virtual-TypeScript generator

`@rozie/core`'s `parse()` already supplies everything Volar needs — **no compiler change required**
for the mapping data:

| Need | Source |
|---|---|
| block offsets | `ast.{props,data,script,template}.loc` → `{start,end}` |
| per-prop key positions | `ast.props.expression` is a Babel `ObjectExpression` with absolute `start`/`end` on every node |
| interpolations | `TemplateInterpolation.loc` + `rawExpr` (expression begins at `loc.start + 2`) |
| attribute expressions | `attributes[].valueLoc`; `kind` ∈ `event` \| `binding` \| `directive` |

Emit shape (working generator: `sources/018-volar-virtual-ts-rozie/rozie-virtual-code.mjs`):

```
interface __RozieProps { label: string; count: number; }   // each key MAPPED to its <props> key
const __rozieDataInit = { clicks: 0 };                      // <data> verbatim, MAPPED
type __RozieData = typeof __rozieDataInit;
<ambient sigil declarations>                                // generated-only, unmapped
<script body verbatim, MAPPED>
void ($props.label);  (($event: any) => { bump() });        // template exprs, each MAPPED
export {};                                                  // REQ-V6 — REQUIRED
```

`gen()` appends generated-only text; `mapped(text, srcStart)` appends source text and records a
`CodeMapping` chunk. Attribute kind is **`'binding'`**, not `'bind'`.

`r-for` introduces real scope — emit a real loop so aliases get their true element type:

```js
gen(`for (const ${alias} of (`); mapped(coll, collStart); gen(') as any[]) {\n');
```

Slot-scope params (`#default="{ node }"`) are the identical shape and are **the remaining work**.

### 2. The server

`sources/019-jetbrains-volar-integration/server.mjs` — `createConnection` + `createServer` +
`createTypeScriptProject` + `volar-service-typescript`. Two portability rules (REQ-V16):

```js
// (a) IntelliJ sends NO initializationOptions.typescript.tsdk — self-resolve
const tsdkPath = params.initializationOptions?.typescript?.tsdk
  || path.dirname(require.resolve('typescript/lib/tsserverlibrary.js'));

// (b) scriptId is a URI here, NOT a string
const idToPath = (id) => typeof id === 'string' ? id : (id.fsPath ?? id.path ?? String(id));
```

Both fail **silently** — no error, just no intelligence.

### 3. The IntelliJ client

Mirror JetBrains' own Vue plugin, which registers on the same extension point:

```xml
<extensions defaultExtensionNs="com.intellij">
    <platform.lsp.serverSupportProvider
        implementation="js.rozie.intellij.lsp.RozieLspServerSupportProvider"/>
</extensions>
```

Kotlin: `LspServerSupportProvider.fileOpened` → `serverStarter.ensureServerStarted(descriptor)`;
descriptor extends `ProjectWideLspServerDescriptor(project, "Rozie")` overriding `isSupportedFile`
and `createCommandLine`. Working file: `sources/019-.../RozieLspServerSupportProvider.kt`.

**Declare no Gradle dependency** (REQ-V15) — the API is already on the platform compile classpath.

### 4. Verification instruments, in cost order

1. `client-probe.mjs` — raw stdio LSP client. Seconds, no IDE, writes `lsp-trace.jsonl`.
2. `prove.mjs` — pinned assertions against a real `ts.LanguageService`.
3. `survey.mjs` — the whole `.rozie` corpus, grouped by TS code.
4. `./gradlew runIde` — human, last.

**Planned for the build phase:** twoslash-style `^?` markers on the 80 `examples/*.rozie` probes
(catches confidently-WRONG answers, which the corpus survey cannot), plus one deliberately-nested
composition fixture — `r-for` inside a slot inside `r-if` with a component ref and scoped params.
Composition is where scope-awareness breaks; the 80 probes only test constructs in isolation.

## What to Avoid

- **Do not use LSP4IJ.** Structurally incapable at injected carets.
- **Do not rip out the injection layer.** It was exonerated.
- **Do not use `decorateLanguageServiceHost` + `createProxyLanguageService`** (tsserver-plugin path)
  for a standalone host. It only *overrides* `getScriptKind` when the host already defines one, so an
  incomplete host drops `.rozie` from the Program **silently**. Use `createLanguageServiceHost`.
- **Do not forget `export {};`.** Reproduces only with ≥2 files — i.e. never in a single-file test.
- **Do not let the `sync` callback skip the real filesystem.** TypeScript loads `lib.*.d.ts` through
  it; omitting the fallback yields a Program with no lib (`Cannot find name 'Record'`).
- **Do not impose `strict`.** 3,245 diagnostics vs 699 on the same corpus — a 7.3× artifact.
- **Do not trust `RESERVED_SIGILS` as complete.** `$snapshot` and `$classSelector` are real, shipped,
  in-use sigils absent from it; they live in a second list in `reactivity/computeDeps.ts`.
- **Do not declare `bundledModule("intellij.platform.lsp")`.** Rejected; not needed.
- **Do not conclude an API is missing from a class-entry scan.** `com.intellij.platform.lsp.*`
  returned zero hits across all 1,473 jars by class path; only `unzip -p | strings` found it in
  `lib/product-backend.jar`.
- **Do not read `idea:idea:<ver>` as Community.** IDEA is one unified distribution since 2025.3.
  Check `productCode` in `product-info.json` (`IU` = Ultimate).
- **Do not report a headline clean-rate.** 22.2% looked like failure; grouped by class it was a
  to-do list, and the same corpus hit 51.2% within the hour.

## Constraints

- **TypeScript 7 / `tsgo` dropped the language-service-plugin model.** Volar-based template checking
  waits on the ~7.1 programmatic API (≈ Oct 2026). Timing risk only — Vue, Svelte, and Astro are
  equally blocked.
- Native platform LSP is **absent from IntelliJ IDEA Community and Android Studio**. Accepted (REQ-V4).
- Versions proven: `@volar/language-core` / `@volar/typescript` / `@volar/language-server` 2.4.28,
  `volar-service-typescript` 0.0.71, TypeScript 5.6.3, IDEA Ultimate 2026.1 (`261.22158.277`).
- Performance is a non-issue: **5.1 ms/file cold** across 387 files including TS program build.
- Baseline corpus health: **51.2% clean / 699 diagnostics / 0 generator failures** on 387 real files.
  Residual = slot-scope params (~250), 2 missing sigils (~66), and some apparently-genuine source
  bugs (`MiniListEngine.rootEl` ×15, `disposers` ×12) — **uninvestigated, worth chasing**.

## Origin

Synthesized from spikes: 017, 018, 019
Source files: `sources/017-lsp-caret-gate/`, `sources/018-volar-virtual-ts-rozie/`,
`sources/019-jetbrains-volar-integration/` (working generator, server, probes, plugin patch)
