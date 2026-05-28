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
) : PsiReferenceBase.Poly<JSReferenceExpression>(element, rangeInElement, false) {

    override fun multiResolve(incompleteCode: Boolean): Array<ResolveResult> {
        // Capture only the element (the cache key), never `this` — see the crash
        // note in [RoziePropsReference.multiResolve].
        val el = element
        return CachedValuesManager.getCachedValue(el) {
            CachedValueProvider.Result.create(
                doResolve(el),
                PsiModificationTracker.MODIFICATION_COUNT,
            )
        }
    }

    companion object {
        private fun doResolve(el: JSReferenceExpression): Array<ResolveResult> {
            val name = el.referenceName ?: return ResolveResult.EMPTY_ARRAY
            val host = RoziePropsReference.resolveHost(el) ?: return ResolveResult.EMPTY_ARRAY
            val targetRange = RoziePropsReference.findBlockBodyRange(host, RozieTokenTypes.DATA_BODY)
                ?: return ResolveResult.EMPTY_ARRAY
            val targetJsFile = RoziePropsReference.findInjectedFile(host, targetRange, "JavaScript")
                ?: return ResolveResult.EMPTY_ARRAY
            val target = RoziePropsReference.findJsKeyByName(targetJsFile, name)
                ?: return ResolveResult.EMPTY_ARRAY
            return arrayOf(PsiElementResolveResult(target))
        }
    }
}
