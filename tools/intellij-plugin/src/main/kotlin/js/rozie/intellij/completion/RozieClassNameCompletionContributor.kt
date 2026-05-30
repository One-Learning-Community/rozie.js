package js.rozie.intellij.completion

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionProvider
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.CompletionType
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.PsiElement
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.psi.xml.XmlAttribute
import com.intellij.psi.xml.XmlAttributeValue
import com.intellij.util.ProcessingContext
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.xml.RozieComponentRegistry
import js.rozie.intellij.xml.RozieContextCheck

/**
 * Class-name autocomplete inside a `.rozie` `<template>` — typing in a static
 * `class="…"` attribute value offers the class names declared in the same file's
 * `<style>` block. Mirrors the Vue plugin's class completion.
 *
 * Scope note: the bound forms `:class="…"` / `r-bind:class="…"` are deliberately
 * NOT handled here — their value is injected as a JavaScript *expression*, so a
 * bare class identifier would read as an undefined variable. Completing class
 * names inside string literals within a bound expression is a separate, JS-side
 * feature left for later.
 *
 * Extraction is a lightweight text scan of the `<style>` body (works for plain
 * CSS, SCSS, and LESS alike — see [classSelectors]) rather than a full CSS PSI
 * walk, so it does not depend on which `lang=` the style block uses or on the
 * injected CSS fragment being resolved at completion time.
 *
 * Multi-class values (`class="card card--active …"`) are handled by narrowing
 * the prefix matcher to the whitespace-delimited word under the caret, so an
 * earlier class on the same attribute doesn't suppress later suggestions.
 *
 * Registered for `language="HTML"` (the attribute PSI lives in the injected
 * template fragment, not the host Rozie tree) with the standard
 * [RozieContextCheck] short-circuit so non-Rozie `.html` files stay unaffected.
 */
class RozieClassNameCompletionContributor : CompletionContributor() {

    init {
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement().inside(XmlAttributeValue::class.java),
            object : CompletionProvider<CompletionParameters>() {
                override fun addCompletions(
                    parameters: CompletionParameters,
                    context: ProcessingContext,
                    result: CompletionResultSet,
                ) {
                    val pos = parameters.position
                    if (!RozieContextCheck.isRozieContext(pos)) return

                    val attr = PsiTreeUtil.getParentOfType(pos, XmlAttribute::class.java) ?: return
                    if (attr.name !in CLASS_ATTRS) return

                    val classes = classSelectors(pos)
                    if (classes.isEmpty()) return

                    // Narrow the prefix to the word under the caret so a populated
                    // `class="a b |"` still completes the trailing word. The
                    // platform-computed prefix may be the whole value-so-far; the
                    // substringAfterLast collapses to the last token either way and
                    // is a no-op when the prefix is already a single word.
                    val word = result.prefixMatcher.prefix
                        .substringAfterLast(' ')
                        .trim('"', '\'')
                    val rs = result.withPrefixMatcher(word)
                    for (name in classes) {
                        rs.addElement(LookupElementBuilder.create(name).withTypeText("css class"))
                    }
                }
            },
        )
    }

    private companion object {
        val CLASS_ATTRS = setOf("class")

        /** Class-selector token: a `.` followed by a CSS identifier. */
        private val CLASS_REGEX = Regex("""\.(-?[_a-zA-Z][-_a-zA-Z0-9]*)""")

        /**
         * Distinct class names declared in the first `<style>` block of [element]'s
         * host `.rozie` file. Returns empty for non-Rozie files or files without a
         * `<style>` block.
         */
        fun classSelectors(element: PsiElement): List<String> {
            val containing = element.containingFile ?: return emptyList()
            val ilm = InjectedLanguageManager.getInstance(containing.project)
            val host = ilm.getTopLevelFile(containing) ?: containing
            if (host.fileType.name != "Rozie") return emptyList()
            val body = RozieComponentRegistry.blockBodyText(host.text, RozieTokenTypes.STYLE_BODY)
                ?: return emptyList()
            return CLASS_REGEX.findAll(body).map { it.groupValues[1] }.distinct().toList()
        }
    }
}
