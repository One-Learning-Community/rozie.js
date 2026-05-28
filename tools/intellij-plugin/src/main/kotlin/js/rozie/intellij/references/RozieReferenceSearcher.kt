package js.rozie.intellij.references

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.openapi.application.QueryExecutorBase
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiNamedElement
import com.intellij.psi.PsiReference
import com.intellij.psi.impl.source.resolve.reference.ReferenceProvidersRegistry
import com.intellij.psi.search.RequestResultProcessor
import com.intellij.psi.search.UsageSearchContext
import com.intellij.psi.search.searches.ReferencesSearch
import com.intellij.util.Processor

/**
 * Plan 08.3-04 — bridges Find-Usages text-search results to the contributor-
 * contributed [RozieScriptDeclReference] / [RoziePropsReference] /
 * [RozieDataReference] / [RozieRefsReference] PSI references that live on
 * injected JS PSI nodes.
 *
 * **Why this is required** (Plan 08.3-04 Rule-2 in-band gap closure, surfaced
 * during Task 3 verification): the IntelliJ platform's `ReferencesSearch`
 * pipeline relies on `PsiElement.getReferences()` to discover references at
 * each candidate offset. The JS plugin's [JSReferenceExpression] implementation
 * returns ONLY its built-in self-reference from `getReferences()` — it does NOT
 * include `PsiReferenceContributor`-contributed references in the result. So
 * the platform never sees [RozieScriptDeclReference] in the search and reports
 * zero usages even when the contributed reference would correctly resolve via
 * its multiResolve.
 *
 * Verified empirically via diagnostic instrumentation:
 * `JSReferenceExpression.references` and
 * `PsiReferenceService.getContributedReferences(jsRef)` both return
 * `[JSReferenceExpressionImpl]` (only the self-ref), but
 * `ReferenceProvidersRegistry.getReferencesFromProviders` returns
 * `[RozieScriptDeclReference]` (the contributor's ref). The disconnect is
 * internal to the JS plugin's `getReferences()` override; we work around it by
 * participating directly in the `ReferencesSearch` pipeline.
 *
 * **Vue's precedent:** `org.jetbrains.vuejs.findUsages.VueReferenceSearcher`
 * uses the same `referencesSearch` EP for the exact same reason — Vue's
 * cross-injection refs into `<script setup>` decls cannot rely on JSReference's
 * built-in `getReferences()`. Confirmed via javap on the Vue plugin's class.
 *
 * **Search shape:** delegate the text-search to the platform's
 * [com.intellij.psi.search.SearchRequestCollector.searchWord] pipeline (the
 * canonical FindUsages pattern Vue uses), supplying a custom
 * [RequestResultProcessor] that walks each text occurrence into the injected
 * JS PSI and queries [ReferenceProvidersRegistry] for contributor-contributed
 * references that `isReferenceTo(target)`. The processor returns standard
 * [PsiReference]s the platform's smart-pointer system can serialize.
 *
 * **Pitfall 2:** the searcher's outer guard short-circuits on
 * `target.containingFile not in Rozie context`. Without this guard, the
 * searcher would fire on every JS Find-Usages action everywhere, doing a
 * pointless extra word-scan + PsiReferenceContributor-walk for every vanilla
 * JS decl (perf hit + cross-leak risk).
 */
class RozieReferenceSearcher :
    QueryExecutorBase<PsiReference, ReferencesSearch.SearchParameters>(true) {

    override fun processQuery(
        queryParameters: ReferencesSearch.SearchParameters,
        @Suppress("UNUSED_PARAMETER") consumer: Processor<in PsiReference>,
    ) {
        val target = queryParameters.elementToSearch
        if (target !is PsiNamedElement) return
        val targetName = target.name ?: return

        // Pitfall 2 — only fire on targets that live in Rozie SFCs.
        val ilm = InjectedLanguageManager.getInstance(target.project)
        val targetContainingFile = target.containingFile ?: return
        val targetTopLevel = ilm.getTopLevelFile(targetContainingFile) ?: targetContainingFile
        if (targetTopLevel.fileType.name != "Rozie") return

        // Delegate to the platform's standard search pipeline. The
        // SearchRequestCollector.searchWord call enqueues a word-index sweep
        // over the effective search scope (which includes the host Rozie file
        // via RozieUseScopeEnlarger); each occurrence is dispatched to our
        // RequestResultProcessor below. Mirrors Vue's VueReferenceSearcher
        // pattern (verified via javap).
        val collector = queryParameters.optimizer
        collector.searchWord(
            targetName,
            queryParameters.effectiveSearchScope,
            UsageSearchContext.IN_CODE,
            true, // case-sensitive
            target,
            RozieRequestResultProcessor(target),
        )
    }

    /**
     * Per-occurrence processor invoked by the platform's
     * [com.intellij.psi.impl.search.LowLevelSearchUtil] for each text match of
     * the target's name in the search scope. Returns true to keep searching,
     * false to stop.
     *
     * For each text occurrence:
     *   1. Walk the leaf's parent chain for a [JSReferenceExpression] (the
     *      occurrence might already be in injected JS PSI, or we may need to
     *      walk into an injection via [InjectedLanguageManager.findInjectedElementAt]).
     *   2. Ask [ReferenceProvidersRegistry] for contributor-contributed refs on
     *      that JSReferenceExpression — the JS plugin's getReferences() bypasses
     *      contributor refs, so we go through the registry directly.
     *   3. For each contributed ref, check isReferenceTo(target) — only refs
     *      that resolve back to our target are reported as usages.
     */
    private class RozieRequestResultProcessor(
        private val target: PsiElement,
    ) : RequestResultProcessor() {

        override fun processTextOccurrence(
            element: PsiElement,
            offsetInElement: Int,
            consumer: Processor<in PsiReference>,
        ): Boolean {
            // Locate the JSReferenceExpression covering this occurrence.
            // The occurrence may be:
            //   (a) already inside injected JS PSI — element.containingFile is
            //       the injected JS file; walk parents directly.
            //   (b) in the host Rozie file (XML text leaf) — ask
            //       InjectedLanguageManager for the injected element at the
            //       occurrence's host offset.
            val jsRef = findJsReferenceExpression(element, offsetInElement) ?: return true

            // Ask the registry for contributor-contributed refs. The JS
            // plugin's element.getReferences() returns only the self-ref;
            // contributor refs go through this registry path.
            val contributedRefs = ReferenceProvidersRegistry.getReferencesFromProviders(jsRef)
            for (contributedRef in contributedRefs) {
                if (contributedRef.isReferenceTo(target)) {
                    if (!consumer.process(contributedRef)) return false
                }
            }
            return true
        }

        private fun findJsReferenceExpression(
            element: PsiElement,
            offsetInElement: Int,
        ): JSReferenceExpression? {
            // Direct parent walk — works when element is already in JS PSI.
            val directWalk = generateSequence<PsiElement>(element) { it.parent }
                .firstOrNull { it is JSReferenceExpression } as? JSReferenceExpression
            if (directWalk != null) return directWalk

            // Element is in the host file; walk into the injection.
            val ilm = InjectedLanguageManager.getInstance(element.project)
            val hostFile = element.containingFile as? PsiFile ?: return null
            val hostOffset = element.textRange.startOffset + offsetInElement
            val injectedLeaf = ilm.findInjectedElementAt(hostFile, hostOffset) ?: return null
            return generateSequence<PsiElement>(injectedLeaf) { it.parent }
                .firstOrNull { it is JSReferenceExpression } as? JSReferenceExpression
        }
    }
}
