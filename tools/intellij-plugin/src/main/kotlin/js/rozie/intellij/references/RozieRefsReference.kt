package js.rozie.intellij.references

import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElementResolveResult
import com.intellij.psi.PsiReferenceBase
import com.intellij.psi.ResolveResult
import com.intellij.psi.util.CachedValueProvider
import com.intellij.psi.util.CachedValuesManager
import com.intellij.psi.util.PsiModificationTracker
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.psi.xml.XmlAttribute
import js.rozie.intellij.lexer.RozieTokenTypes

/**
 * Cross-block PsiReference for `$refs.X` access — resolves the accessed name `X`
 * to the corresponding `XmlAttribute` (`ref="X"`) inside the sibling `<template>`
 * block's injected HTML PSI.
 *
 * Differs from [RoziePropsReference] / [RozieDataReference] in two ways:
 *   1. Targets [RozieTokenTypes.TEMPLATE_BODY] (HTML injection), not a JS body.
 *   2. Walks for an [XmlAttribute] with `name == "ref"` and `value == accessedName`,
 *      not a `JSProperty`.
 *
 * See [RoziePropsReference] for the full algorithm + Pitfall 5 cache rationale.
 * Re-uses the shared `findBlockBodyRange` and `findInjectedFile` helpers on
 * [RoziePropsReference.Companion] (looking up "HTML" instead of "JavaScript").
 */
class RozieRefsReference(
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
            val targetRange = RoziePropsReference.findBlockBodyRange(host, RozieTokenTypes.TEMPLATE_BODY)
                ?: return ResolveResult.EMPTY_ARRAY
            val targetHtmlFile = RoziePropsReference.findInjectedFile(host, targetRange, "HTML")
                ?: return ResolveResult.EMPTY_ARRAY
            val target = PsiTreeUtil.findChildrenOfType(targetHtmlFile, XmlAttribute::class.java)
                .firstOrNull { it.name == "ref" && it.value == name }
                ?: return ResolveResult.EMPTY_ARRAY
            return arrayOf(PsiElementResolveResult(target))
        }
    }
}
