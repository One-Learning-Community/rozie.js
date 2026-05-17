package js.rozie.intellij.completion

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionProvider
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.CompletionType
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.xml.XmlAttribute
import com.intellij.util.ProcessingContext
import js.rozie.intellij.xml.RozieContextCheck
import js.rozie.intellij.xml.RozieKnownAttributes

/**
 * SC-6 — prefix-aware attribute-name autocomplete for the four Rozie sigils
 * (`r-`, `@`, `:`, `#`) inside HTML attribute position of a `.rozie`
 * `<template>` block.
 *
 * Registered for `language="HTML"` (NOT `"Rozie"`) per 08.2-RESEARCH Pitfall 3:
 * the `XmlAttribute` PSI we match lives inside the HTMLLanguage fragment that
 * `RozieMultiHostInjector` injects into `TEMPLATE_BODY` host tokens — it does
 * not exist in the host Rozie PSI tree. The `RozieContextCheck.isRozieContext`
 * guard (Pitfall 2 mitigation) keeps the contributor inert in every non-Rozie
 * `.html` file in the user's project — without it, every `.html` file would
 * suggest `r-if` / `@click` / `:disabled` / `#header` on every attribute-name
 * position.
 *
 * The candidate lists are sourced verbatim from
 * [js.rozie.intellij.xml.RozieKnownAttributes] — the DRY contract documented
 * on SC-6: the same `object` is consumed by both
 * [js.rozie.intellij.xml.RozieAttributeDescriptorsProvider] (Plan 02) and this
 * contributor (Plan 06). Adding a new directive in v0.3.0 = 1-line append to
 * `RozieKnownAttributes`; both call-sites pick it up with zero further edits.
 *
 * Approach: lift the Kotlin skeleton from 08.2-RESEARCH Pattern 6 verbatim
 * (lines 678–723), but swap the inline `InjectedLanguageManager.getTopLevelFile`
 * check for `RozieContextCheck.isRozieContext` — DRY against Plan 02's shared
 * helper.
 */
class RozieAttributeNameCompletionContributor : CompletionContributor() {

    init {
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement().inside(XmlAttribute::class.java),
            object : CompletionProvider<CompletionParameters>() {
                override fun addCompletions(
                    parameters: CompletionParameters,
                    context: ProcessingContext,
                    result: CompletionResultSet,
                ) {
                    val pos = parameters.position
                    // Pitfall 2 mitigation — short-circuit on non-Rozie host
                    // file so we don't pollute completion in arbitrary .html
                    // files anywhere in the user's project.
                    if (!RozieContextCheck.isRozieContext(pos)) return

                    val prefix = result.prefixMatcher.prefix
                    val candidates: List<String> = when {
                        // RESEARCH line 709: empty prefix (caret immediately
                        // after `<div ` with nothing typed yet) defaults to
                        // suggesting the r-directives. The other sigils only
                        // surface once the user has typed their sigil
                        // character so the lookup popup stays focused.
                        prefix.startsWith("r-") || prefix.isEmpty() ->
                            RozieKnownAttributes.R_DIRECTIVES
                        prefix.startsWith("@") -> RozieKnownAttributes.EVENT_SIGILS
                        prefix.startsWith(":") -> RozieKnownAttributes.PROP_SIGIL_HINTS
                        prefix.startsWith("#") -> RozieKnownAttributes.SLOT_FILL_HINTS
                        else -> emptyList()
                    }
                    candidates.forEach { name ->
                        result.addElement(LookupElementBuilder.create(name).bold())
                    }
                }
            },
        )
    }
}
