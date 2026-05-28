package js.rozie.intellij.references

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.openapi.application.QueryExecutorBase
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiNamedElement
import com.intellij.psi.PsiReference
import com.intellij.psi.PsiReferenceBase
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
 * references that `isReferenceTo(target)`. When one matches, the processor
 * reports a HOST-anchored [PsiReference] (whose element is the ordinary `.rozie`
 * leaf, not the injected JS) so the platform's UsageInfo smart-pointer survives
 * 2025.3's hardened injected-pointer restore self-check — see
 * [RozieRequestResultProcessor.processTextOccurrence].
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
            RozieRequestResultProcessor(target, targetName),
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
        private val targetName: String,
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
            val isUsage = contributedRefs.any { it.isReferenceTo(target) }
            if (!isUsage) return true

            // Report the usage anchored to the HOST `.rozie` element — NEVER the
            // injected JS the contributed ref lives on.
            //
            // WHY (the 2025.3 Find-Usages regression): the platform turns each
            // reported PsiReference into a UsageInfo, which immediately builds a
            // SmartPsiElementPointer for `reference.getElement()`. For an
            // element inside our `<script>`/template JS injection, that pointer
            // is an InjectedSelfElementInfo over the single whole-file
            // RozieRootBlock host carrying many sibling injections; 2025.3
            // hardened SmartPsiElementPointerImpl.createElementInfo to restore
            // the freshly-created pointer and `LOG.error` when restore returns
            // null (it does for our multi-injection host) — which the test
            // framework converts into a hard failure. 2024.2.5 lacked that
            // self-check, so reporting the injected ref happened to work there.
            //
            // Anchoring to host PSI sidesteps injected-pointer restore entirely
            // (a `.rozie` element is ordinary, restorable PSI) and is also the
            // more correct usage location: it points at the template / handler /
            // colon-bind call site the user actually reads, and it is the
            // representation a future LSP/VSCode parity layer must emit (LSP
            // usages are host document ranges, not injection coordinates).
            //
            // CRITICAL: `element` here is host-or-injected depending on whether
            // the platform's word sweep descended into the injected file
            // (LowLevelSearchUtil.processInjectedFile) — which is index/cache
            // (hence order-) dependent. We must normalize BOTH shapes to a host
            // anchor; anchoring blindly to `element` reintroduces the injected
            // pointer whenever the sweep handed us an injected leaf.
            val hostAnchor = toHostAnchor(element, offsetInElement) ?: return true
            val hostRef = RozieHostUsageReference(hostAnchor.first, hostAnchor.second, target)
            return consumer.process(hostRef)
        }

        /**
         * Normalize a text occurrence — whose [element] may be a host `.rozie`
         * leaf OR an injected JS leaf — to a `(hostElement, rangeInHostElement)`
         * pair suitable for a restorable host-anchored [PsiReference]. Returns
         * null when the occurrence range falls outside the element (defensive)
         * or the injection host can't be resolved.
         */
        private fun toHostAnchor(
            element: PsiElement,
            offsetInElement: Int,
        ): Pair<PsiElement, TextRange>? {
            val nameLen = targetName.length
            if (offsetInElement + nameLen > element.textLength) return null

            val ilm = InjectedLanguageManager.getInstance(element.project)
            val injectionHost = ilm.getInjectionHost(element)
            if (injectionHost == null) {
                // Already in the host file — anchor directly to the leaf.
                return element to TextRange(offsetInElement, offsetInElement + nameLen)
            }

            // Injected leaf — map the occurrence's injected-document range back to
            // host-document coordinates, then express it relative to the host.
            val injectedRange = element.textRange.let {
                TextRange(it.startOffset + offsetInElement, it.startOffset + offsetInElement + nameLen)
            }
            val hostAbsRange = ilm.injectedToHost(element, injectedRange)
            val rangeInHost = hostAbsRange.shiftLeft(injectionHost.textRange.startOffset)
            if (rangeInHost.startOffset < 0 || rangeInHost.endOffset > injectionHost.textLength) return null
            return injectionHost to rangeInHost
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

    /**
     * Host-anchored reference reported as a Find-Usages hit for a cross-block
     * template / handler / colon-bind / modifier-arg call site of a `<script>`
     * decl.
     *
     * Its [getElement] is the ordinary `.rozie` host leaf at the occurrence (not
     * the injected `JSReferenceExpression`), so the platform's UsageInfo can
     * build a restorable [com.intellij.psi.SmartPsiElementPointer] without
     * touching the injection layer — see [RozieRequestResultProcessor.processTextOccurrence]
     * for why injected-element pointers are fatal on 2025.3.
     *
     * Marked **soft** ([PsiReferenceBase] `soft = true`): this reference exists
     * only transiently inside the ReferencesSearch consumer; it is never
     * contributed back onto the host leaf's [PsiElement.getReferences], so it
     * must never participate in unresolved-reference highlighting. [resolve]
     * returns [target] so the usage correctly attributes back to the decl.
     */
    private class RozieHostUsageReference(
        hostElement: PsiElement,
        rangeInHost: TextRange,
        private val target: PsiElement,
    ) : PsiReferenceBase<PsiElement>(hostElement, rangeInHost, /* soft = */ true) {

        override fun resolve(): PsiElement? = target.takeIf { it.isValid }

        override fun isReferenceTo(element: PsiElement): Boolean {
            if (!element.isValid || !target.isValid) return false
            return element.manager.areElementsEquivalent(element, target)
        }
    }
}
