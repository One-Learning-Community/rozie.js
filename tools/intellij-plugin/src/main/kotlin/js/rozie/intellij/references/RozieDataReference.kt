package js.rozie.intellij.references

import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElementResolveResult
import com.intellij.psi.PsiReferenceBase
import com.intellij.psi.ResolveResult
import com.intellij.psi.util.CachedValueProvider
import com.intellij.psi.util.CachedValuesManager
import com.intellij.psi.util.PsiModificationTracker
import js.rozie.intellij.lexer.RozieTokenTypes

/**
 * Cross-block PsiReference for `$data.X` access — sibling of
 * [RoziePropsReference] targeting the [RozieTokenTypes.DATA_BODY] block
 * instead of PROPS_BODY. Identical algorithm; only the token type and
 * conceptual semantics differ.
 *
 * See [RoziePropsReference] for the full algorithm + Pitfall 5 cache rationale
 * + spike-conditional fallback notes. The shared `findBlockBodyRange` and
 * `findInjectedFile` helpers live on [RoziePropsReference.Companion].
 */
class RozieDataReference(
    element: JSReferenceExpression,
    rangeInElement: TextRange,
    private val accessedName: String,
) : PsiReferenceBase.Poly<JSReferenceExpression>(element, rangeInElement, false) {

    override fun multiResolve(incompleteCode: Boolean): Array<ResolveResult> {
        // PSI-leak avoidance: the cache lambda MUST NOT close over a PSI field.
        // See [RoziePropsReference.multiResolve] for the full rationale.
        return CachedValuesManager.getCachedValue(element) {
            val resolved = doResolve()
            CachedValueProvider.Result.create(
                resolved,
                PsiModificationTracker.MODIFICATION_COUNT,
            )
        }
    }

    private fun doResolve(): Array<ResolveResult> {
        val host = RoziePropsReference.resolveHost(element) ?: return ResolveResult.EMPTY_ARRAY
        val targetRange = RoziePropsReference.findBlockBodyRange(host, RozieTokenTypes.DATA_BODY)
            ?: return ResolveResult.EMPTY_ARRAY
        val targetJsFile = RoziePropsReference.findInjectedFile(host, targetRange, "JavaScript")
            ?: return ResolveResult.EMPTY_ARRAY
        val target = RoziePropsReference.findJsKeyByName(targetJsFile, accessedName)
            ?: return ResolveResult.EMPTY_ARRAY
        return arrayOf(PsiElementResolveResult(target))
    }
}
