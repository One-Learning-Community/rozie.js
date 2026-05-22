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
import js.rozie.intellij.xml.RozieModifiers

/**
 * SC-6 — prefix-aware attribute-name autocomplete for the four Rozie sigils
 * (`r-`, `@`, `:`, `#`) inside HTML attribute position of a `.rozie`
 * `<template>` block.
 *
 * Additionally surfaces the `.modifier` chain: typing a `.` inside an
 * `@event` / `r-on:event` / `r-model` attribute name offers the canonical
 * modifier set from [RozieModifiers] — event composition modifiers always,
 * key/button filters on keyboard events, the three `r-model` modifiers on
 * `r-model`. See [modifierCandidates].
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

                    // A `.` inside an @event / r-on:event / r-model attribute
                    // name is a modifier-chain position — surface modifiers
                    // instead of the directive/sigil lists.
                    val modifiers = modifierCandidates(prefix)
                    if (modifiers != null) {
                        modifiers.forEach { (name, typeText) ->
                            result.addElement(
                                LookupElementBuilder.create(name).bold()
                                    .withTypeText(typeText),
                            )
                        }
                        return
                    }

                    val candidates: List<String> = when {
                        // `r-on:` longhand event binding — surface the same
                        // DOM events the `@` shorthand offers, re-prefixed.
                        // Checked before the generic `r-` arm below since
                        // `r-on:click` also starts with `r-`.
                        prefix.startsWith("r-on:") ->
                            RozieKnownAttributes.EVENT_SIGILS.map { "r-on:" + it.drop(1) }
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

/**
 * If [prefix] is a modifier-chain position — a `.` inside an `@event`,
 * `r-on:event`, or `r-model` attribute name — return the full attribute-name
 * lookup strings paired with a type-text label; otherwise `null` (so the
 * caller falls back to the directive/sigil lists).
 *
 * Lookup strings are the COMPLETE attribute name (`@click.stop`, not bare
 * `stop`) so the platform's prefix matcher — which sees the whole XML
 * attribute name as a single identifier — keeps matching and the accepted
 * item replaces the entire name. This mirrors how the four sigil lists
 * already use full names (`@click`, `r-if`).
 *
 * Modifiers already typed earlier in the chain are filtered out so a partial
 * `@click.stop.` does not re-offer `stop`.
 */
private fun modifierCandidates(prefix: String): List<Pair<String, String>>? {
    if ('.' !in prefix) return null

    // Everything up to and including the last `.` — reused verbatim as the
    // lookup-string head. The segment after it is the partial being typed.
    val base = prefix.substringBeforeLast('.') + "."
    val alreadyTyped = prefix.split('.').drop(1).dropLast(1).toSet()

    val pool: List<String> = when {
        prefix.startsWith("@") ->
            RozieModifiers.forEvent(prefix.drop(1).substringBefore('.'))
        prefix.startsWith("r-on:") ->
            RozieModifiers.forEvent(prefix.removePrefix("r-on:").substringBefore('.'))
        prefix.startsWith("r-model") -> RozieModifiers.MODEL_MODIFIERS
        else -> return null
    }
    return pool
        .filter { it !in alreadyTyped }
        .map { (base + it) to RozieModifiers.typeTextFor(it) }
}
