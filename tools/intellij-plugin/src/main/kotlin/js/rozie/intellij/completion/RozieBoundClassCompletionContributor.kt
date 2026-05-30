package js.rozie.intellij.completion

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionProvider
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.CompletionType
import com.intellij.codeInsight.completion.CompletionUtilCore
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.JSTokenTypes
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.PsiElement
import com.intellij.util.ProcessingContext
import js.rozie.intellij.parser.RozieRootBlock
import js.rozie.intellij.xml.RozieContextCheck
import js.rozie.intellij.xml.RozieStyleClasses

/**
 * Class-name autocomplete inside a STRING LITERAL of a bound class attribute —
 * `:class="{ 'is-o<caret>': open }"`, `:class="'card ' + extra"`,
 * `r-bind:class="['is-active']"`. Offers the class names declared in the same
 * file's `<style>` block, exactly like the static-`class=` completion
 * ([RozieClassNameCompletionContributor]) but for the JS-injected bound form.
 *
 * The bound attribute value is injected as a JS *expression* (the popup is JS
 * completion), so only string-literal positions inside it carry class names —
 * gated on the caret token being a [JSTokenTypes.STRING_LITERAL] (true whether
 * the string is an object key, an array element, or a value, which have
 * different parent PSI shapes).
 *
 * Knowing the JS fragment belongs to a CLASS binding is the tricky part: the
 * per-expression injector uses the whole [RozieRootBlock] as host (not the
 * attribute), so [enclosingAttr] maps the caret back to the template text and
 * reads the attribute name preceding the value's opening quote.
 */
class RozieBoundClassCompletionContributor : CompletionContributor() {

    init {
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement(),
            object : CompletionProvider<CompletionParameters>() {
                override fun addCompletions(
                    parameters: CompletionParameters,
                    context: ProcessingContext,
                    result: CompletionResultSet,
                ) {
                    val pos = parameters.position
                    if (pos.node?.elementType != JSTokenTypes.STRING_LITERAL) return
                    if (!RozieContextCheck.isRozieContext(pos)) return
                    if (enclosingAttr(pos, parameters.offset) !in CLASS_ATTRS) return

                    val classes = RozieStyleClasses.forElement(pos)
                    if (classes.isEmpty()) return

                    val rs = result.withPrefixMatcher(partialClassBeforeCaret(pos, parameters.offset))
                    for (name in classes) {
                        rs.addElement(LookupElementBuilder.create(name).withTypeText("css class"))
                    }
                    // Own the position: inside a class binding the only meaningful
                    // string completions are the declared classes. Suppressing stock
                    // JS completion here also avoids the platform building a
                    // SmartPsiElementPointer over the injected object-key JSProperty
                    // (which cannot round-trip the injection boundary).
                    result.stopHere()
                }
            },
        )
    }

    private companion object {
        val CLASS_ATTRS = setOf(":class", "r-bind:class")

        /**
         * The template attribute name owning [element]'s injected JS fragment, or
         * null. Maps the caret (injected-doc offset [caretInInjected]) back to the
         * host template text, then scans backward for the attribute value's opening
         * quote — the first quote char preceded (ignoring whitespace) by `=`. Inner
         * string quotes (`'is-open'` inside `:class="{ … }"`) are NOT preceded by
         * `=`, so they're skipped; and because the boundary `=` is always followed
         * by a quote, an `=` inside the expression (`a === b`) is never mistaken for
         * it. The attribute name is read backward from that `=`.
         *
         * Done by text scan rather than `getInjectedPsiFiles` host-range lookup
         * because at completion time the injected file is a COPY whose identity
         * won't match the platform's cached fragment list.
         */
        fun enclosingAttr(element: PsiElement, caretInInjected: Int): String? {
            val ilm = InjectedLanguageManager.getInstance(element.project)
            val rootBlock = (ilm.getInjectionHost(element) as? RozieRootBlock)
                ?: (element.containingFile?.context as? RozieRootBlock)
                ?: return null
            val text = rootBlock.text
            var i = ilm.injectedToHost(element, caretInInjected).coerceIn(0, text.length)
            while (i > 0) {
                val c = text[i - 1]
                if (c == '<' || c == '>') return null // left the tag without finding it
                if (c == '"' || c == '\'') {
                    var p = i - 2 // char before the quote
                    while (p >= 0 && text[p].isWhitespace()) p--
                    if (p >= 0 && text[p] == '=') {
                        var j = p
                        while (j > 0 && text[j - 1].let { it.isLetterOrDigit() || it in "-:@._" }) j--
                        return text.substring(j, p).trim().ifEmpty { null }
                    }
                }
                i--
            }
            return null
        }

        /**
         * The partial class word under the caret inside the string token [tok] —
         * the dummy stripped, narrowed to the whitespace-delimited word so a
         * space-separated `'card ca<caret>'` still completes the trailing class.
         */
        fun partialClassBeforeCaret(tok: PsiElement, caret: Int): String {
            val start = tok.textRange.startOffset
            val raw = tok.text
            val end = (caret - start).coerceIn(1, raw.length)
            return raw.substring(1, end)
                .substringBefore(CompletionUtilCore.DUMMY_IDENTIFIER_TRIMMED)
                .substringAfterLast(' ')
        }
    }
}
