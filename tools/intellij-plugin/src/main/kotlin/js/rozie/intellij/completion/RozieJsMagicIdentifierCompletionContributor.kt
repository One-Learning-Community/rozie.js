package js.rozie.intellij.completion

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionProvider
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.CompletionType
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.patterns.PlatformPatterns
import com.intellij.util.ProcessingContext
import js.rozie.intellij.xml.RozieContextCheck

/**
 * SC-6 — prefix-aware autocomplete for the 11 canonical Rozie `$`-prefixed
 * magic identifiers inside JS identifier positions of `.rozie` injected JS
 * fragments. Fires across all 5 JS-injected block types — `<script>`,
 * `<listeners>`, `<props>`, `<data>`, `<components>` — because
 * `RozieMultiHostInjector` (Plan 02, extended Plan 11) injects JavaScript
 * uniformly into all five.
 *
 * Structural mirror of [RozieAttributeNameCompletionContributor] (Plan 06):
 * same `CompletionContributor` + `init { extend(...) }` + `CompletionProvider`
 * shape; differs only in
 *   (a) `language="JavaScript"` (NOT `"HTML"`) registration in plugin.xml
 *       per 08.2-RESEARCH Pitfall 3 — the [JSReferenceExpression] PSI we match
 *       lives in the INJECTED JS PSI, not in host Rozie PSI; same reasoning
 *       Plan 05's `RozieJSReferenceContributor` documents,
 *   (b) pattern target `inside(JSReferenceExpression::class.java)` (NOT
 *       `inside(XmlAttribute::class.java)`),
 *   (c) candidate-list source [RozieMagicIdentifiers] (NOT
 *       [js.rozie.intellij.xml.RozieKnownAttributes]).
 *
 * Pitfall 2 mitigation: `addCompletions` short-circuits on
 * `!RozieContextCheck.isRozieContext(pos)` so the contributor stays inert in
 * every non-Rozie `.js` / `.ts` / `.tsx` file in the user's project. Without
 * this guard the blast radius is broader than Plan 06's HTML case — most
 * projects contain far more JS than HTML — see T-08.2-26.
 *
 * Prefix filter: contribute only when the prefix is empty OR starts with `$`.
 * This keeps the lookup popup focused on the canonical Rozie surface; plain
 * identifier-position completion (`const value = co|`) is unaffected.
 *
 * The candidate list is sourced verbatim from
 * [RozieMagicIdentifiers.MAGIC_IDENTIFIERS] — the DRY contract documented on
 * SC-6: the same `object` is consumed by this contributor AND pinned by
 * `RozieJsMagicCompletionTest.testBareDollarSurfacesAllMagicIdentifiers`.
 * Adding a new magic identifier in v0.3.0 = 1-line append to the registry;
 * both the contributor and the test pick it up with zero further edits.
 *
 * Each lookup carries a one-line type-text doc hint via
 * `LookupElementBuilder.withTypeText(...)` so the popup is self-documenting
 * — directly fulfils the P1-UAT-09 acceptance prose ("one-line doc strings
 * hinting purpose").
 *
 * Compositional benefit: once Plan 14 lands JS injection on directive attribute
 * values (`:foo="$pr|"`) + `{{ }}` interpolations, this contributor
 * automatically fires inside those new injected ranges — same pattern
 * matches; zero additional code required here.
 */
class RozieJsMagicIdentifierCompletionContributor : CompletionContributor() {

    init {
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement().inside(JSReferenceExpression::class.java),
            object : CompletionProvider<CompletionParameters>() {
                override fun addCompletions(
                    parameters: CompletionParameters,
                    context: ProcessingContext,
                    result: CompletionResultSet,
                ) {
                    val pos = parameters.position
                    // Pitfall 2 mitigation — short-circuit on non-Rozie host
                    // file so the contributor doesn't pollute completion in
                    // arbitrary .js / .ts / .tsx files anywhere in the user's
                    // project. T-08.2-26.
                    if (!RozieContextCheck.isRozieContext(pos)) return

                    // The JavaScript completion-plugin's PrefixMatcher already
                    // includes the leading `$` sigil in `prefix` (verified
                    // empirically — `result.prefixMatcher.prefix` returns
                    // `$pr` when the user typed `$pr`). Only contribute when
                    // the prefix is empty (caret just after `const x = ` with
                    // nothing typed yet — surface the full canonical list) OR
                    // begins with `$` (the sigil that identifies Rozie's
                    // magic-ident surface). Plain identifier completion
                    // contexts (`const value = co|`) stay untouched.
                    val prefix = result.prefixMatcher.prefix
                    if (prefix.isNotEmpty() && !prefix.startsWith("\$")) return

                    RozieMagicIdentifiers.MAGIC_IDENTIFIERS.forEach { (name, typeText) ->
                        result.addElement(
                            LookupElementBuilder.create(name)
                                .bold()
                                .withTypeText(typeText),
                        )
                    }
                }
            },
        )
    }
}
