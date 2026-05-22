package js.rozie.intellij.props

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.psi.JSBlockStatement
import com.intellij.lang.javascript.psi.JSLabeledStatement
import com.intellij.lang.javascript.psi.JSObjectLiteralExpression
import com.intellij.lang.javascript.psi.JSProperty
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.util.PsiTreeUtil
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.parser.RozieRootBlock
import js.rozie.intellij.references.RoziePropsReference

/**
 * One declared `<props>` entry. [declaration] is the key PSI node inside the
 * `<props>` block — a Go-to-Declaration target. The structure is intentionally
 * open to extension: `type` / `default` / `required` can be added as fields
 * without touching call sites that only read [name] / [isModel].
 */
data class RoziePropInfo(
    val name: String,
    val isModel: Boolean,
    val declaration: PsiElement,
)

/**
 * Reusable structured view of a `.rozie` component's `<props>` block.
 *
 * Given any PSI element inside a `.rozie` file's injected JS (or the injected
 * file itself), [propsOf] resolves the sibling `<props>` block and returns the
 * declared props with their metadata. Built on the cross-block resolution
 * helpers [RoziePropsReference] already exposes (`findBlockBodyRange` /
 * `findInjectedFile`).
 *
 * **Two PSI shapes.** A `<props>` body — `{ value: { type: String, model: true } }`
 * — injects either as a paren-wrapped [JSObjectLiteralExpression] (the current
 * shape; commas force object-literal parsing) or, for a single-entry body, as
 * a [JSBlockStatement] of [JSLabeledStatement]s. [directEntries] handles both,
 * and recurses uniformly: the props container and each prop's config object
 * are the same "key → value container" shape.
 *
 * Consumed by [js.rozie.intellij.inspection.RoziePropAssignmentInspection]; the
 * structured shape is deliberately reusable for future prop-aware features
 * (completion, validation, navigation).
 */
object RoziePropsModel {

    /** A `key: value` entry of a props container or a prop config object. */
    private data class Entry(val name: String, val keyElement: PsiElement, val value: PsiElement?)

    /**
     * The props declared in the `<props>` block of the `.rozie` file that
     * hosts [context] (any element in the file's injected JS, or the injected
     * file itself). Empty when there is no `<props>` block.
     */
    fun propsOf(context: PsiElement): List<RoziePropInfo> {
        val host = resolveHost(context) ?: return emptyList()
        val range = RoziePropsReference.findBlockBodyRange(host, RozieTokenTypes.PROPS_BODY)
            ?: return emptyList()
        val jsFile = RoziePropsReference.findInjectedFile(host, range, "JavaScript")
            ?: return emptyList()
        val container = topContainer(jsFile) ?: return emptyList()
        return directEntries(container).map { entry ->
            RoziePropInfo(
                name = entry.name,
                isModel = isModelConfig(entry.value),
                declaration = entry.keyElement,
            )
        }
    }

    /** The single prop named [name], or null if the component declares none. */
    fun find(context: PsiElement, name: String): RoziePropInfo? =
        propsOf(context).firstOrNull { it.name == name }

    private fun resolveHost(context: PsiElement): RozieRootBlock? {
        val ilm = InjectedLanguageManager.getInstance(context.project)
        (ilm.getInjectionHost(context) as? RozieRootBlock)?.let { return it }
        return context.containingFile?.context as? RozieRootBlock
    }

    /**
     * The outermost key-value container in the injected `<props>` JS — a
     * [JSObjectLiteralExpression] (paren-wrapped injection) or a
     * [JSBlockStatement] (plain-body injection of a single-entry `{ … }`).
     */
    private fun topContainer(jsFile: PsiFile): PsiElement? =
        PsiTreeUtil.findChildOfType(jsFile, JSObjectLiteralExpression::class.java)
            ?: PsiTreeUtil.findChildOfType(jsFile, JSBlockStatement::class.java)

    /** Direct `key → value` entries of an object-literal or labeled-block container. */
    private fun directEntries(element: PsiElement?): List<Entry> = when (element) {
        is JSObjectLiteralExpression ->
            element.properties.mapNotNull { p ->
                val name = p.name ?: return@mapNotNull null
                Entry(name, p.nameIdentifier ?: p, p.value)
            }
        is JSBlockStatement ->
            // Direct labeled-statement children. NOT `element.statements`: that
            // is `JSBlockStatement.getStatements()`, deprecated in 2024.2 and
            // removed in 2025.3 — the verifier flags it as a binary-compat
            // (NoSuchMethodError) problem. `PsiTreeUtil.getChildrenOfTypeAsList`
            // is stable across both platform versions and gives the same set.
            PsiTreeUtil.getChildrenOfTypeAsList(element, JSLabeledStatement::class.java).mapNotNull { labeled ->
                val name = labeled.label ?: return@mapNotNull null
                Entry(name, labeled.labelIdentifier ?: labeled, labeled.statement)
            }
        else -> emptyList()
    }

    /** True when a prop's config object ([configValue]) carries `model: true`. */
    private fun isModelConfig(configValue: PsiElement?): Boolean {
        val model = directEntries(configValue).firstOrNull { it.name == "model" } ?: return false
        val text = model.value?.text?.trim()?.trimEnd(';')?.trim()
        return text == "true"
    }
}
