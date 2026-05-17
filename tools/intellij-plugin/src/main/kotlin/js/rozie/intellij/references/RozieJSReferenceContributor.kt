package js.rozie.intellij.references

import com.intellij.lang.javascript.patterns.JSPatterns
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiReference
import com.intellij.psi.PsiReferenceContributor
import com.intellij.psi.PsiReferenceProvider
import com.intellij.psi.PsiReferenceRegistrar
import com.intellij.util.ProcessingContext
import js.rozie.intellij.xml.RozieContextCheck

/**
 * SC-5 cross-block navigation contributor. Wires `$props.X` / `$data.X` /
 * `$refs.X` Go-to-Declaration / Find-Usages / Rename in `.rozie` injected JS
 * fragments to the corresponding declaration in the sibling `<props>` /
 * `<data>` / `<template>` block.
 *
 * **Registration language MUST be `"JavaScript"`** (RESEARCH Pitfall 3 / Vue's
 * `VueJSReferenceContributor` precedent): the [JSReferenceExpression]s we match
 * live in the injected JS PSI, NOT in the host Rozie PSI. Registering for
 * `"Rozie"` would never fire on these references.
 *
 * Pitfall 2 (carve-out leak): the provider's `getReferencesByElement` body
 * short-circuits on `!RozieContextCheck.isRozieContext(element)` so this
 * contributor stays inert on every other `.js` file in the user's project.
 *
 * Pitfall 5 fallback: the host walk-back combines the primary
 * `InjectedLanguageManager.getInjectionHost` path AND the
 * `element.containingFile.context` fallback into one chained expression. The
 * Task 0 spike empirically validated that the primary path returns
 * RozieRootBlock; the fallback is belt-and-suspenders for edit-then-revert
 * caching edge cases per RESEARCH Pitfall 5 (lines 851–854).
 */
class RozieJSReferenceContributor : PsiReferenceContributor() {

    override fun registerReferenceProviders(registrar: PsiReferenceRegistrar) {
        // Match every JSReferenceExpression — the provider's body filters down to
        // the $props/$data/$refs receivers. Matching at the pattern level on the
        // qualifier name would require a more elaborate ElementPattern; doing the
        // dispatch in the provider keeps the pattern simple and the filter logic
        // colocated with the reference dispatch.
        registrar.registerReferenceProvider(
            JSPatterns.jsReferenceExpression(),
            RozieMagicAccessReferenceProvider(),
        )
    }

    private class RozieMagicAccessReferenceProvider : PsiReferenceProvider() {
        override fun getReferencesByElement(
            element: PsiElement,
            context: ProcessingContext,
        ): Array<PsiReference> {
            val ref = element as? JSReferenceExpression ?: return PsiReference.EMPTY_ARRAY

            // Pitfall 2 — stay inert on non-Rozie .js files.
            if (!RozieContextCheck.isRozieContext(element)) return PsiReference.EMPTY_ARRAY

            // Only handle `$X.Y` shapes where the qualifier is itself a
            // JSReferenceExpression carrying the magic-ident name. Skip everything
            // else (bare references, member chains deeper than one level, calls).
            val qualifier = ref.qualifier as? JSReferenceExpression ?: return PsiReference.EMPTY_ARRAY
            val qualifierName = qualifier.referenceName ?: return PsiReference.EMPTY_ARRAY
            val accessedName = ref.referenceName ?: return PsiReference.EMPTY_ARRAY

            // NOTE: the RozieRootBlock host is intentionally NOT looked up here
            // and NOT passed into the reference constructor. The reference's
            // multiResolve() recomputes it via [RoziePropsReference.resolveHost]
            // on every call — capturing the host in the reference instance would
            // turn the reference into a PSI-retaining container, which the
            // IntelliJ test framework flags as a CachedValueProvider PSI leak.
            // Pitfall 5 primary+fallback chain lives in resolveHost.

            // The reference's TextRange is the accessed-name leaf relative to the
            // outer JSReferenceExpression element. PsiReferenceBase requires this
            // to be `in` the element's range; referenceNameElement.textRangeInParent
            // gives exactly the right (relative) range for "the .X portion of $foo.X".
            val rangeInElement = ref.referenceNameElement?.textRangeInParent
                ?: return PsiReference.EMPTY_ARRAY

            return when (qualifierName) {
                "\$props" -> arrayOf(RoziePropsReference(ref, rangeInElement, accessedName))
                "\$data" -> arrayOf(RozieDataReference(ref, rangeInElement, accessedName))
                "\$refs" -> arrayOf(RozieRefsReference(ref, rangeInElement, accessedName))
                else -> PsiReference.EMPTY_ARRAY
            }
        }
    }
}
