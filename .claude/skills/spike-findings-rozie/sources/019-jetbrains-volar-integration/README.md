---
spike: 019
idea: volar-language-tooling
name: jetbrains-volar-integration
type: standard
validates: "Given the Volar .rozie language server consumed via the IntelliJ NATIVE platform LSP API, when a caret sits inside an injected HTML/JS fragment in a real 2026.1 IDE, then hover / go-to-definition / diagnostics resolve — including type errors inside {{ }}"
verdict: VALIDATED (7/8 in-IDE; 1 gap root-caused to a compiler parser limitation)
related: [017, 018]
tags: [intellij, lsp, platform-lsp, volar, language-injection, ide-tooling, runtime-verified, kotlin-retirement]
---

# Spike 019: jetbrains-volar-integration

## What This Validates

**Given** the Volar `.rozie` language server (018) consumed through the IntelliJ **native platform
LSP API** (017's winner), **when** a caret sits inside an injected HTML/JS fragment in a real
IntelliJ IDEA Ultimate 2026.1, **then** hover, go-to-definition, completion, and diagnostics resolve —
including type errors inside `{{ }}`.

This is the composition of 017 and 018 and the runtime proof 017-b deferred. It is the claim that
justifies retiring ~4,821 lines of Kotlin.

## Research

### Precedent: JetBrains does exactly this for Vue

Extracting `plugins/vuejs-plugin/lib/vuejs-plugin.jar` from the 2026.1 distribution:

```xml
<platform.lsp.serverSupportProvider
    implementation="org.jetbrains.vuejs.lang.typescript.service.lsp.VueLspServerSupportProvider" />
```

JetBrains' own Vue plugin registers on the **same extension point** we register `.rozie` on, pointed
at the Vue language server. This is not an improvisation; it is the shipped pattern.

### Where the API actually lives (2026.x layout)

| Question | Answer |
|---|---|
| Distribution | `idea:idea:2026.1`, `productCode: IU`, build `261.22158.277` — since 2025.3 IDEA ships as ONE unified distribution (Ultimate features license-gated), so the `ideaIU` coordinate is no longer what resolves |
| API classes | `lib/product-backend.jar`, modules `intellij.platform.lsp` / `intellij.platform.lsp.impl` |
| EP declaration | `intellij.platform.lsp.impl.xml` → `com.intellij.platform.lsp.serverSupportProvider` |
| Gradle dependency | **None needed.** `bundledModule("intellij.platform.lsp")` is *rejected* ("doesn't exist"), but the API is already on the platform compile classpath. |

### API surface (read via `javap`, not guessed)

```
interface LspServerSupportProvider {
  void fileOpened(Project, VirtualFile, LspServerSupportProvider$LspServerStarter);
}
abstract class ProjectWideLspServerDescriptor extends LspServerDescriptor {
  ProjectWideLspServerDescriptor(Project, String);
}
abstract class LspServerDescriptor {
  abstract boolean isSupportedFile(VirtualFile);
  GeneralCommandLine createCommandLine();
}
```

## How to Run

```bash
cd .planning/spikes/019-jetbrains-volar-integration
npm install
node client-probe.mjs        # 8 assertions over raw LSP stdio — no IDE needed

# in-IDE
cd ../../../tools/intellij-plugin
git apply ../../.planning/spikes/019-jetbrains-volar-integration/plugin-native-lsp.patch   # if reverted
./gradlew runIde -PplatformVersion=2026.1
# then open .planning/spikes/019-jetbrains-volar-integration/testbed as the project
# and follow testbed/WHAT-TO-TRY.md
```

## Observability

`client-probe.mjs` writes `lsp-trace.jsonl` — every JSON-RPC message in both directions with
timestamps. The load-bearing distinction when a caret feature does not fire is **never-sent** vs
**sent-and-returned-empty**, and only the wire trace separates them. In-IDE, the equivalent is
Help > Diagnostic Tools > Debug Log Settings… → `#com.intellij.platform.lsp`.

## Investigation Trail

**1. Wire-probe before IDE.** Same cheap-first discipline as 017. A raw stdio LSP client drove the
server exactly as an editor would: `initialize` → `didOpen` → hover / completion / definition, plus
`publishDiagnostics` collection. **8/8 green** before any IDE was involved. Had the server been
broken, this would have cost seconds instead of an IDE session.

**2. The server self-resolves its TypeScript.** VS Code's Volar clients pass
`initializationOptions.typescript.tsdk`; IntelliJ sends nothing of the kind. `server.mjs` falls back
to `require.resolve('typescript/lib/tsserverlibrary.js')`. Without this the server dies on
`initialize` in IntelliJ specifically — a VS-Code-only assumption that would have looked like "the
IntelliJ integration doesn't work."

**3. The plugin's `LanguagePlugin` receives a `URI`, not a string.** In the language-server context
`scriptId` is a `URI` object, so `scriptId.endsWith('.rozie')` silently never matches and every file
gets no virtual code. Normalised via `idToPath()`.

**4. Finding the API in the 2026.x layout took real digging.** A scan of all 1,473 jars for
`com/intellij/platform/lsp/api/LspServerSupportProvider.class` returned **nothing** — the class-file
path does not exist as such. Only a byte-level scan (`unzip -p | strings`) found it, in
`lib/product-backend.jar`. Along the way: the transform cache showed `idea/idea/2026.1`, which looked
like Community Edition and briefly suggested the API would be absent — `product-info.json` showed
`productCode: IU`, i.e. the unified 2025.3+ distribution.

**5. LSP4IJ removed outright, not just unregistered.** Per REQ-V4 (Dan, drop CE), the
`<depends>com.redhat.devtools.lsp4ij</depends>` was deleted and both LSP4IJ Kotlin files retired
(parked in `lsp4ij-retired/`). Leaving the dependency would have risked the whole plugin failing to
load if LSP4IJ 0.19.4 did not resolve on 2026.1, and would have started a second, competing server.
`buildPlugin verifyPluginStructure` green afterwards.

**6. In-IDE verification (Dan, live).** 7 of 8 checks passed on first run.

## Results

### Verdict: ✅ VALIDATED

| # | Check (caret inside an injected fragment) | Result |
|---|---|---|
| 1 | hover `label` in `{{ $props.label }}` → `string` | ✅ |
| 2 | hover `disabled` in `:disabled="$props.disabled"` → `boolean` | ✅ |
| 3 | completion after typing `{{ $props.` | ⚠ **gap — root-caused, see below** |
| 4 | Cmd+B on `label` jumps to the `<props>` key | ✅ |
| 5 | hover `clicks` in `<script>` `$data.clicks` → `number` | ✅ |
| 6 | clean file, no false errors | ✅ |
| 7 | `$props.bogus` in `<script>` → real error | ✅ *"very impressive"* |
| 8 | `$props.label.toFixed(2)` inside `{{ }}` → real error | ✅ *"very impressive"* |

**Checks 7 and 8 are the whole thesis.** Both are type errors reported at carets inside injected
fragments — the exact position class LSP4IJ structurally cannot serve (Spike 017). Check 8 is
template type-checking, which Rozie has never had in any editor at all.

**This promotes Spike 017-b from PARTIAL to VALIDATED.** The static source verdict predicted the
platform would serve injected carets; it does, in a real IDE, against our file type and our injector.

### Gap 1 — completion needs a CLOSED `{{ }}` (a compiler limitation, not an LSP one)

Dan's correction: typing `{{ $props.` with the interpolation **unclosed** produces no completion;
completing the braces first (`{{  }}`) and *then* typing `$props.` works.

Root-caused directly against the parser:

```
CLOSED  {{ $props. }}    -> interpolations: " $props. " | diags: 0
OPEN    {{ $props.       -> interpolations: NONE        | diags: 1
```

An unterminated `{{` yields **no `TemplateInterpolation` node at all**. The generator therefore emits
nothing for that region, there is no `CodeMapping`, and the LSP has no position to answer at. This is
not an LSP-integration defect — it is missing **error recovery in `parseTemplate`**, and it degrades
diagnostics for half-typed templates just as much as completion. Filed as REQ-V13.

Mitigating in practice: editors that auto-close `{{` → `{{  }}` land in the working case for free.
But typing `{{` manually then continuing is a common flow, and Vue's tooling handles it via parser
recovery. Fixing it in `@rozie/core` benefits every consumer, not just the IDE.

### Gap 2 — IntelliJ's own completion contributors add noise

In the working (closed-braces) case the popup contains `count`, `label`, `disabled` **plus** IntelliJ
live-template entries (`log`, `let`, `arg`, `if`, …).

This is platform-by-design — the LSP docs state the LSP approach "shouldn't be considered as a
replacement for the existing language API, but rather as an added value," so native contributors
merge with LSP items rather than yielding to them. It is a *polish* problem, not a correctness one,
and it is tunable (context-narrow or suppress live templates inside interpolation regions). Filed as
REQ-V14. Notably this is the mirror image of the old problem: previously the native layer was the
only thing that worked; now it is the thing adding noise.

### Surprises

- **No Gradle dependency needed for the LSP API.** `bundledModule("intellij.platform.lsp")` is
  explicitly rejected, yet the API compiles fine — it is already on the platform classpath. An hour
  could easily be lost trying to declare a dependency that must not be declared.
- **The API is invisible to a class-path scan.** 1,473 jars searched for the `.class` entry: zero
  hits. Only a byte-level `strings` scan located it. Worth knowing for any future platform-API
  archaeology.
- **The unified 2025.3+ distribution is a trap for edition reasoning.** `idea:idea:2026.1` resolving
  instead of `ideaIU` looks exactly like an accidental downgrade to Community — and would have
  predicted the LSP API's absence. `productCode: IU` in `product-info.json` is the check that
  settles it.
- **Two VS-Code-shaped assumptions in the server would each have read as "IntelliJ is broken":** the
  `tsdk` initialization option, and `scriptId` being a string. Both are silent failures.

### Spike-only shortcuts (NOT the shipping shape)

- Server path hardcoded to the spike directory (`ROZIE_LSP_SERVER` overrides); production bundles the
  server inside the plugin distribution.
- `node` resolved from a hardcoded nvm path with fallbacks (`ROZIE_LSP_NODE` overrides); production
  needs proper Node detection (the repo already has `bundleLanguageServer` machinery to build on).
- `rozie-virtual-code.mjs` imports `@rozie/core` by absolute path; production imports the package.
- Slot-scope params still unimplemented (REQ-V11), so components using `#default="{ node }"` will show
  false errors until that lands.
