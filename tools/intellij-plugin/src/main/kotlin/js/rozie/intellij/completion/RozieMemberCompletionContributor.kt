package js.rozie.intellij.completion

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionProvider
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.CompletionType
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.lang.javascript.psi.JSLabeledStatement
import com.intellij.lang.javascript.psi.JSProperty
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.PsiFile
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.psi.xml.XmlAttribute
import com.intellij.util.ProcessingContext
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.references.RoziePropsReference
import js.rozie.intellij.xml.RozieContextCheck

/**
 * Member-access autocomplete for `$props.<member>` / `$data.<member>` /
 * `$refs.<member>` inside `.rozie` injected JS fragments — the companion to the
 * cross-block [RoziePropsReference] navigation. Where the reference resolves ONE
 * member to its declaration, this contributor enumerates ALL of a sigil's
 * declared members from the sibling block and offers them at the caret.
 *
 * Why native (not LSP): LSP4IJ completion does not reach carets inside injected
 * language fragments, so `$props.` member completion can only be served from the
 * IntelliJ side (see RozieLanguageServerFactory's diagnostics-only scoping). The
 * member set is derived live from the sibling `<props>` / `<data>` JS keys and
 * the `<template>` `ref="…"` attributes, reusing [RoziePropsReference]'s host /
 * block-range / injected-file helpers, so it can never drift from what resolves.
 *
 * Registered for `language="JavaScript"` because the [JSReferenceExpression]
 * PSI lives in injected JS, not host Rozie PSI (same reasoning the cross-block
 * [RoziePropsReference] documents). Pitfall-2 guarded via
 * [RozieContextCheck.isRozieContext] so it stays inert in non-Rozie JS files.
 */
class RozieMemberCompletionContributor : CompletionContributor() {

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
                    if (!RozieContextCheck.isRozieContext(pos)) return

                    // The caret sits on the member leaf of `$sigil.<member>`
                    // (IntelliJ inserts a dummy identifier there during
                    // completion). Walk up to that member expression and read
                    // its qualifier — the sigil.
                    val memberExpr = PsiTreeUtil.getParentOfType(pos, JSReferenceExpression::class.java)
                        ?: return
                    val qualifier = memberExpr.qualifier as? JSReferenceExpression ?: return
                    val sigil = qualifier.referenceName ?: return

                    val (token, typeText, lang) = when (sigil) {
                        "\$props" -> Triple(RozieTokenTypes.PROPS_BODY, "prop", "JavaScript")
                        "\$data" -> Triple(RozieTokenTypes.DATA_BODY, "data", "JavaScript")
                        "\$refs" -> Triple(RozieTokenTypes.TEMPLATE_BODY, "ref", "HTML")
                        else -> return
                    }

                    val host = RoziePropsReference.resolveHost(memberExpr) ?: return
                    val range = RoziePropsReference.findBlockBodyRange(host, token) ?: return
                    val injected = RoziePropsReference.findInjectedFile(host, range, lang) ?: return

                    val names = if (sigil == "\$refs") refNames(injected) else jsKeyNames(injected)
                    names.forEach { name ->
                        result.addElement(LookupElementBuilder.create(name).withTypeText(typeText))
                    }
                }
            },
        )
    }

    private companion object {
        /** Declared `<props>` / `<data>` key names (both PSI shapes the body parses into). */
        fun jsKeyNames(jsFile: PsiFile): List<String> {
            val properties = PsiTreeUtil.findChildrenOfType(jsFile, JSProperty::class.java)
                .mapNotNull { it.name }
            val labels = PsiTreeUtil.findChildrenOfType(jsFile, JSLabeledStatement::class.java)
                .mapNotNull { it.label }
            return (properties + labels).distinct()
        }

        /** Template `ref="…"` attribute values. */
        fun refNames(htmlFile: PsiFile): List<String> =
            PsiTreeUtil.findChildrenOfType(htmlFile, XmlAttribute::class.java)
                .filter { it.name == "ref" }
                .mapNotNull { it.value }
                .distinct()
    }
}
