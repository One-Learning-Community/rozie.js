package js.rozie.intellij.references

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.psi.PsiElement
import com.intellij.psi.search.LocalSearchScope
import com.intellij.psi.search.SearchScope
import com.intellij.psi.search.UseScopeEnlarger
import js.rozie.intellij.xml.RozieContextCheck

/**
 * Plan 08.3-04 — enlarges the Find-Usages text-search scope of a `<script>`
 * top-level decl so the platform scans the Rozie host file (and finds the
 * `{{ fmt(…) }}` / `:foo="onClick"` / etc. template call sites that live in
 * sibling SFC blocks of the same `.rozie` file).
 *
 * **Why this is required** (Rule-2 critical functionality, in-band gap closure
 * surfaced during Plan 08.3-04 Task 3 verification): a `JSFunctionDeclaration`
 * declared inside the injected JS PSI of a `<script>` block has its default
 * [PsiElement.getUseScope] computed by the JS plugin as a [LocalSearchScope]
 * over the **injected JS file only**. The platform's Find-Usages action runs a
 * word-index sweep against that scope, then dispatches `ReferencesSearch` per
 * candidate offset; without this enlarger the sweep never visits the Rozie host
 * file, so the template call site is invisible to Find-Usages — even though
 * [RozieScriptDeclReference.isReferenceTo] would happily say "yes, this is a
 * reference to your target" if it were ever asked.
 *
 * Plan 08.3-04's [RozieFindUsagesProvider] is necessary (it teaches the
 * platform that the JS decl is a findable target in Rozie context) but not
 * sufficient — without this enlarger the platform "finds usages" of a target
 * whose scope is the injected JS file alone, returning zero hits because the
 * template ref lives in a sibling injection (separate injected file, separate
 * PSI subtree, completely outside the default scope). Vue's plugin uses the
 * same `useScopeEnlarger` extension for the same reason — verified via the
 * `VueUseScopeEnlarger` class in `vuejs.jar` (2024.2 / 2025.3 floors).
 *
 * **Scope shape:** when [element] is a JS PSI inside a Rozie SFC, return a
 * [LocalSearchScope] of the top-level host `.rozie` file. The host file
 * contains the template / listener / colon-bind / handler text where the bare-
 * ident refs live; the platform's word-index sweep walks that text, the
 * JS-injection layer surfaces JSReferenceExpressions for the matches, the
 * existing Plan 08.3-01 PsiReference provider answers them, and the platform's
 * `ReferencesSearch` pipeline reports them as usages of [element].
 *
 * **Pitfall 2:** the [RozieContextCheck.isRozieContext] short-circuit ensures
 * this enlarger stays inert on every non-Rozie `.js` / `.ts` / `.tsx` file in
 * the user's project. Without that guard, vanilla JS decls everywhere would
 * receive a phantom Rozie-host-file scope (an obvious user-visible bug — and a
 * direct violation of the threat-model entry T-08.3-04-01).
 *
 * **No platform-level registration scope:** unlike `FindUsagesProvider` (which
 * takes a `language="…"` attribute) and `psi.referenceContributor` (same), the
 * `useScopeEnlarger` EP is a single global extension that fires on every
 * `PsiElement` regardless of language — the per-language filtering happens
 * inside [getAdditionalUseScope]. The `RozieContextCheck` guard at the top of
 * the method is mandatory, not optional.
 */
class RozieUseScopeEnlarger : UseScopeEnlarger() {

    override fun getAdditionalUseScope(element: PsiElement): SearchScope? {
        // Pitfall 2 — stay inert on non-Rozie .js / .ts / .tsx files. Without
        // this guard, vanilla JS decls would receive a phantom Rozie-host-file
        // scope, which is meaningless and potentially a perf hit (the platform
        // would scan a non-existent host file for every Find-Usages on every
        // vanilla JS decl). T-08.3-04-01 mitigation.
        if (!RozieContextCheck.isRozieContext(element)) return null

        val containingFile = element.containingFile ?: return null
        val ilm = InjectedLanguageManager.getInstance(element.project)

        // The host file is the .rozie SFC; for an element inside an injected JS
        // file (the typical case for a <script> decl) getTopLevelFile walks back
        // through the injection chain. For an element already in the host file,
        // getTopLevelFile is a no-op identity. In either shape we return a
        // LocalSearchScope of the host file so the platform's word-index sweep
        // scans the full SFC for text occurrences of the element's name.
        val hostFile = ilm.getTopLevelFile(containingFile) ?: containingFile

        // Defensive: if the host file is the same as the containing file AND
        // it's not a Rozie file, the isRozieContext guard above should have
        // already short-circuited — but belt-and-suspenders against future
        // refactors of the context check.
        if (hostFile.fileType.name != "Rozie") return null

        return LocalSearchScope(hostFile)
    }
}
