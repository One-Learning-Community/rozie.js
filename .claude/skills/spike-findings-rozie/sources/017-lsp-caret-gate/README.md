---
spike: 017
idea: volar-language-tooling
name: lsp-caret-gate
type: comparison
validates: "Given a `.rozie` file with MultiHostInjector active, when the caret sits inside an injected HTML/JS fragment, then an LSP client serves caret features (completion / hover / go-to-definition) from the Rozie language server"
verdict: "017-a ✗ INVALIDATED · 017-b ✅ VALIDATED (static; runtime-confirmed in Spike 019) · 017-c ⊘ NOT BUILT"
related: [018, 019]
tags: [intellij, lsp, lsp4ij, platform-lsp, language-injection, ide-tooling, volar, gate, kotlin-retirement]
---

# Spike 017: lsp-caret-gate

## What This Validates

**Given** a `.rozie` file with `RozieMultiHostInjector` active (HTML into `<template>`, JS into
`<script>`/`<props>`/`<data>`/`<listeners>`/`<components>`, CSS into `<style>`),
**when** the caret sits *inside an injected fragment*,
**then** an LSP client serves completion / hover / go-to-definition from the Rozie language server.

This is the **kill-question** for the `volar-language-tooling` idea. Every semantic feature we want
to retire — completion (1216 LOC), references (1163), xml (840), inspection (556), highlighting
(421), documentation (258), refactoring (167), structure+navigation (200) — fires at a caret that is
almost always inside an injected fragment. If no LSP client can serve a caret there, ~4,821 lines of
Kotlin stay, and the Volar plan collapses to "VS Code only."

**Variants:**

| Variant | Client | Status |
|---|---|---|
| 017-a | LSP4IJ (Red Hat), current + latest 0.20.1 | built (static) |
| 017-b | Native IntelliJ platform LSP API (`com.intellij.platform.lsp`) | built (static) |
| 017-c | Injection removed — pure-LSP file type | ⊘ not built — short-circuited, see below |

## Research

### Prior state of the evidence

The plugin consumes **LSP4IJ 0.19.4** (`<depends>com.redhat.devtools.lsp4ij`), pinned to platform
floor **2024.2.5** (`gradle.properties`). `RozieLanguageServerFactory.kt` disables six client
features outright (`override fun isEnabled(file: PsiFile): Boolean = false` ×6), and `plugin.xml`
records the reason at lines 372-373:

> *"LSP4IJ completion does not reach carets inside injected fragments, so the IntelliJ LSP is scoped
> to diagnostics-only."*

That conclusion was reached in 2025 against **one client on a two-year-old platform floor**. The
native platform LSP API had never been put in front of a `.rozie` file.

### What changed upstream

| Fact | Source |
|---|---|
| JetBrains 2026.1 ships a service-powered (tsserver-backed) type engine by default | [WebStorm 2026.1](https://blog.jetbrains.com/webstorm/2026/03/webstorm-2026-1/) |
| JetBrains bundles `@vue/typescript-plugin` 3.2.4, `svelte-language-server` + `typescript-svelte-plugin`, Astro LS | ibid. |
| `JavaScript.servicePoweredTypeEngineEvaluator` is `@ApiStatus.Internal` — not a public plugin API | [WebStorm EP list](https://plugins.jetbrains.com/docs/intellij/webstorm-extension-point-list.html) |
| Platform LSP API grew: find-usages + semantic highlighting (2024.2), param info / breadcrumbs / file structure / call+type hierarchy (2025.3), rename + code lens (2026.1) | [LSP docs](https://plugins.jetbrains.com/docs/intellij/language-server-protocol.html) |
| Platform LSP is unavailable in **IntelliJ IDEA Community Edition and Android Studio** | ibid. |
| LSP4IJ current release is **0.20.1** (2026-06-15); we pin 0.19.4 | GH releases |
| LSP4IJ #853 (shipped 2025-03-11) added a semantic-token-driven PSI view provider for TextMate files | GH |

Both sets of docs are **silent on injected-fragment interaction**. The platform docs only offer a
mild negative framing — *"the LSP approach shouldn't be considered as a replacement for the existing
language API, but rather as an added value."* That silence is why this had to be answered from
source rather than from documentation.

### Approach comparison

| Approach | Cost | Confidence it answers the gate |
|---|---|---|
| GUI: patch plugin → `runIde` on 2026.1 → human caret testing | ~1.5 GB IDE download + Dan's hands, per variant | High, but slow and expensive to iterate |
| Headless `CodeInsightTestFixture` probe | Medium; LSP in test fixtures is async/awkward | Medium |
| **Static read of both clients' source** | Minutes, zero downloads | **High — the question is structural, not behavioral** |

**Chosen approach: static source analysis first.** The gate question reduces to a structural
property — *does the client translate injected coordinates to host coordinates?* — which is
answerable by reading the code. Both clients are open source (LSP4IJ entirely; and, decisively,
`platform/lsp` **and** `platform/lsp-impl` are present in `JetBrains/intellij-community`, so the
native implementation is inspectable too). GUI confirmation is retained as a *later* obligation,
not a prerequisite.

## How to Run

```bash
.planning/spikes/017-lsp-caret-gate/verify.sh
```

Re-derives the verdict from upstream source. No IDE, no Gradle, no plugin build. Requires `gh`,
`git`, `curl`.

Frozen copies of the decisive files are in `evidence/`.

## What to Expect

- LSP4IJ: **0** files with injected-language awareness
- Native platform LSP: **~20** files with injected-language awareness
- A printed `unwrapInjection()` — the primitive LSP4IJ lacks

## Investigation Trail

**1. Registration was not the blocker.** First hypothesis was that LSP4IJ's completion contributor
simply isn't registered for injected languages. Wrong — `plugin.xml:500-502` registers it as
`language="any"`, so it *is* invoked at an injected caret:

```xml
<completion.contributor id="LSPCompletionContributor" language="any"
    implementationClass="com.redhat.devtools.lsp4ij.features.completion.LSPCompletionContributor"
    order="first, before wordCompletion"/>
```

The contributor runs. It just cannot do anything useful.

**2. The failure is inside the contributor, and it is doubled.**
`LSPCompletionContributor.fillCompletionVariants` operates entirely in whatever coordinates it is
handed:

```java
PsiFile psiFile = parameters.getOriginalFile();   // at an injected caret: the INJECTED file
VirtualFile file = psiFile.getVirtualFile();      // → a VirtualFileWindow, not Foo.rozie
...
LSPIJUtils.toPosition(offset, document)           // offset within the INJECTED document
LSPFileSupport.getSupport(psiFile).getCompletionSupport();
```

Two independent breakages: (a) server lookup keyed off the injected `PsiFile` / `VirtualFileWindow`
finds no server, since servers are mapped by the host file's type; (b) even if (a) were fixed, the
position sent would be **fragment-relative, not file-relative** — the server would be asked about the
wrong location.

**3. The absence is total, not an oversight in one feature.** Grepping the whole LSP4IJ repository
(main, post-0.20.1) for *any* injection concept:

```
grep -rn "InjectedLanguageManager|VirtualFileWindow|getInjectionHost|InjectedLanguageUtil" src/main
  → 0 hits
grep -rn "InjectedLanguage" .   (source, xml, and docs)
  → 0 hits
```

Zero. Not in source, not in `plugin.xml`, not in documentation. LSP4IJ has **no concept of language
injection at all**. This is architectural, not a bug to file — and it means the 2025 conclusion was
correct then and is still correct at 0.20.1. Bumping the dependency would have changed nothing.

**4. The native API is the opposite — injection support is documented and first-class.** JetBrains'
own KDoc, `platform/lsp/src/api/customization/LspCompletionCustomizer.kt:104-107`:

> *"Note that `parameters.originalFile` might be an **injected** file, while all `lsp4j` entities
> (including `item`) always deal with the **host file** (also known as a top-level file).
> `InjectedLanguageManager` helps to map offsets between an injected and a host file."*

That single comment asserts both halves of what we need: the pipeline *is* invoked at injected
carets, and the platform *normalizes to the host file* before talking LSP.

**5. It is systematic, not one feature.** The host-normalization idiom appears in **20 files** across
`platform/lsp-impl`, covering essentially the entire surface we want to retire:

```
completion/LspCompletionContributor.kt        documentation/HoverResultCache.kt
documentation/LspDocumentationTargetProvider  navigation/LspImplicitReferenceProvider.kt
navigation/LspDocumentLinkReferenceProvider   highlighting/LspHighlightingPass.kt
highlighting/LspHighlightUsagesHandlerFactory parameterInfo/LspParameterInfoHandler.kt
folding/LspFoldingBuilder.kt                  codeLens/LspCodeVisionProvider.kt
inlayCommon/LspInlayHintsProvider.kt          structureView/LspStructureViewFactory.kt
formatter/LspFormattingService.kt             formatter/LspImportOptimizer.kt
selectWord/LspWordSelectionHandler.kt         … and 5 more
```

**6. The keystone.** `platform/lsp-impl/src/impl/LspDocumentMapping.kt` centralizes it, with a
method whose documented purpose is exactly our gate:

```kotlin
/**
 * Like [withDocumentAtOffset], but also unwraps language injections.
 * If [file] is a [VirtualFileWindow] (injected fragment),
 * the offset is translated to the host file before adapter resolution.
 */
fun <T> withDocumentAtFileOffset(file: VirtualFile, offset: Int, block: (LspDocument, Position) -> T): T? {
  val host = unwrapInjection(file, offset) ?: return null
  return withDocumentAtOffset(host.hostFile, host.hostDocument, host.hostOffset, block)
}

fun unwrapInjection(file: VirtualFile, offset: Int): HostCoordinates? {
  val document     = FileDocumentManager.getInstance().getDocument(file) ?: return null
  val hostFile     = (file as? VirtualFileWindow)?.delegate ?: file
  val hostDocument = PsiDocumentManagerBase.getTopLevelDocument(document)
  val hostOffset   = (document as? DocumentWindow)?.injectedToHost(offset) ?: offset
  return HostCoordinates(hostFile, hostDocument, hostOffset)
}
```

`LspDocumentMapping` is `@ApiStatus.Internal`, but that is the *implementation* — a plugin registers
via the public `LspServerSupportProvider` / `LspServerDescriptor` and inherits this unwrapping for
free. We do not call it; we benefit from it.

**7. 017-c was short-circuited.** The plan built 017-c (remove injection, pure-LSP file type) only if
both a and b failed. b succeeds, so the premise of c — *injection is the obstacle* — is false.
Injection is not the obstacle; **the client was**. Not built. Recorded rather than silently dropped.

## Results

### Verdicts

| Variant | Verdict | Basis |
|---|---|---|
| **017-a** LSP4IJ | ✗ **INVALIDATED** | Zero injection awareness anywhere in the repository. Structural, not a version gap — 0.20.1 changes nothing. |
| **017-b** Native platform LSP | ✅ **VALIDATED** — static verdict, runtime-confirmed in Spike 019 | Injected-caret support is documented in KDoc, centralized in `LspDocumentMapping.unwrapInjection`, and spans 20 feature files. |
| **017-c** No injection | ⊘ **NOT BUILT** | Short-circuited per plan — b succeeded, so injection can stay. |

### The gate is open — but we were standing on the wrong client

The idea does **not** die. It dies *on LSP4IJ*, which is exactly what the plugin is built on today.
The migration path is therefore not "retire Kotlin" in the abstract; it is a specific, concrete
swap: **LSP4IJ → native IntelliJ platform LSP API**, after which the injected-caret features that
were disabled in 2025 become available.

The 993-LOC `injection/` layer is **vindicated and retained**. The pre-spike framing assumed
injection might have to go; it does not. Injection was never the problem.

### Why 017-b is PARTIAL and not VALIDATED

This is a source-level verdict, not a runtime one. It establishes with high confidence that the
platform *is designed to* serve injected carets over LSP; it does not prove that **our** server, on
**our** file type, with **our** injector, actually returns useful completions in a running IDE. That
is a different claim and it needs a real IDE. Calling this VALIDATED would be exactly the
"VALIDATED — it works" shallowness the spike process warns against.

The runtime proof is folded into **019**, which requires a live 2026.1 IDE regardless — so the proof
costs nothing extra there, and 018 does not depend on it.

### Surprises

- **The blocker was never registration.** `language="any"` means LSP4IJ's contributor has been
  running at every injected caret all along, silently returning nothing. The disabled-features
  workaround in `RozieLanguageServerFactory` was treating a symptom whose cause was two layers down.
- **`platform/lsp-impl` is open source.** The native LSP *implementation* is in
  `JetBrains/intellij-community`, not closed behind Ultimate. That is what made a static verdict
  possible at all, and it is reusable for 019.
- **A Community Edition trade-off appeared that was not in the spike's scope.** The native LSP API
  does not exist in IntelliJ IDEA Community or Android Studio; LSP4IJ does. See REQ-V4.

### Cost

Minutes, and zero IDE downloads — against a budgeted ~1.5 GB download plus a human IDE session per
variant. The static-first ordering is the reusable lesson, not just the answer.
