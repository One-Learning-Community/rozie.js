package js.rozie.intellij.completion

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionProvider
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.CompletionType
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.lang.javascript.psi.JSObjectLiteralExpression
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
 * cross-block [RoziePropsReference] navigation.
 *
 * Why native (not LSP): LSP4IJ completion does not reach carets inside injected
 * language fragments, so this can only be served from the IntelliJ side (the
 * LSP is scoped to diagnostics-only — see RozieLanguageServerFactory).
 *
 * Two correctness rules this enforces (both surfaced in GUI testing):
 *   1. **Top-level only.** The member set is the *direct* properties of the
 *      `<props>`/`<data>` object — NOT a recursive walk, which would also list
 *      each prop descriptor's inner `type`/`default` keys.
 *   2. **Own the position.** Because the sigils are typed `any` (ambient decl),
 *      stock JS completion floods a `$props.` caret with `any`-member guesses
 *      and postfix templates (`if`, `dforof`, …). At a magic-member position the
 *      ONLY valid completions are the declared members, so we register
 *      `order="first"`, add them, and `stopHere()` to suppress the noise.
 *
 * The declared type (`{ type: String }` → `String`) rides along as the lookup's
 * type-text hint, so the popup is self-documenting.
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

                    val memberExpr = PsiTreeUtil.getParentOfType(pos, JSReferenceExpression::class.java)
                        ?: return
                    val qualifier = memberExpr.qualifier as? JSReferenceExpression ?: return
                    val sigil = qualifier.referenceName ?: return

                    val (token, lang) = when (sigil) {
                        "\$props" -> RozieTokenTypes.PROPS_BODY to "JavaScript"
                        "\$data" -> RozieTokenTypes.DATA_BODY to "JavaScript"
                        "\$refs" -> RozieTokenTypes.TEMPLATE_BODY to "HTML"
                        else -> return
                    }

                    val host = RoziePropsReference.resolveHost(memberExpr) ?: return
                    val range = RoziePropsReference.findBlockBodyRange(host, token) ?: return
                    val injected = RoziePropsReference.findInjectedFile(host, range, lang) ?: return

                    val members = when (sigil) {
                        "\$refs" -> refMembers(injected)
                        "\$data" -> objectKeyMembers(injected, valueAsType = false, fallbackType = "data")
                        else -> objectKeyMembers(injected, valueAsType = false, fallbackType = "prop")
                    }
                    if (members.isEmpty()) return

                    for ((name, typeText) in members) {
                        result.addElement(LookupElementBuilder.create(name).withTypeText(typeText))
                    }
                    // Own this position: a `$sigil.` caret has no valid completion
                    // other than these members, so suppress stock JS member guesses
                    // + postfix/live templates that would otherwise flood the popup.
                    result.stopHere()
                }
            },
        )
    }

    private companion object {
        /**
         * Direct (top-level) keys of the first object literal in [jsFile] — the
         * paren-wrapped `({ … })` `<props>`/`<data>` body. For each prop the
         * declared `type:` (e.g. `String`) becomes the type-text hint; falls
         * back to [fallbackType] when there's no `{ type: … }` descriptor.
         */
        fun objectKeyMembers(
            jsFile: PsiFile,
            @Suppress("SameParameterValue") valueAsType: Boolean,
            fallbackType: String,
        ): List<Pair<String, String>> {
            val obj = PsiTreeUtil.findChildOfType(jsFile, JSObjectLiteralExpression::class.java)
                ?: return emptyList()
            return obj.properties.mapNotNull { prop ->
                val name = prop.name ?: return@mapNotNull null
                val descriptor = prop.value as? JSObjectLiteralExpression
                val declaredType = descriptor?.findProperty("type")?.value?.text
                val typeText = when {
                    declaredType != null -> declaredType
                    valueAsType -> prop.value?.text ?: fallbackType
                    else -> fallbackType
                }
                name to typeText
            }
        }

        /** Template `ref="…"` attribute values. */
        fun refMembers(htmlFile: PsiFile): List<Pair<String, String>> =
            PsiTreeUtil.findChildrenOfType(htmlFile, XmlAttribute::class.java)
                .filter { it.name == "ref" }
                .mapNotNull { it.value }
                .distinct()
                .map { it to "ref" }
    }
}
