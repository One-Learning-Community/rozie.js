package js.rozie.intellij.references

import com.intellij.lang.cacheBuilder.WordsScanner
import com.intellij.lang.findUsages.FindUsagesProvider
import com.intellij.lang.javascript.findUsages.JavaScriptFindUsagesProvider
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiNamedElement
import js.rozie.intellij.xml.RozieContextCheck

/**
 * FindUsagesProvider for Rozie-injected JavaScript. Closes Phase 08.3 SPEC Req 7
 * — the IntelliJ platform's Find-Usages action requires this extension to walk
 * cross-injection PsiReferences (not just the PsiReference contract Plan 08.3-01
 * ships). Without this provider, `myFixture.findUsages(target)` returns an empty
 * list even when a valid [RozieScriptDeclReference] resolves to the target.
 *
 * **Registration scope:** registered for `language="JavaScript"` because the
 * elements we Find-Usages-on (the `<script>` decl targets) and the elements
 * that reference them (the template / directive / handler / colon-bind /
 * modifier-arg call sites) all live in the injected JavaScript PSI — same
 * registration scope as Plan 08.3-01's [RozieJSReferenceContributor] (Pitfall 3).
 *
 * **Pitfall 2 mitigation:** [canFindUsagesFor] short-circuits on
 * `!RozieContextCheck.isRozieContext` so this provider stays inert on every
 * non-Rozie `.js` / `.ts` / `.tsx` file in the user's project. This is the
 * single method we OWN; the other 5 delegate to the JS plugin's stock
 * [JavaScriptFindUsagesProvider].
 *
 * **Delegation:** heavy lifting (word-scanning, descriptive-name extraction,
 * type classification) routes through [JavaScriptFindUsagesProvider]. The JS
 * provider already correctly classifies the 5 producer kinds Plan 08.3-01's
 * walker returns (JSFunctionDeclaration / JSVariable / JSClass /
 * ES6ImportSpecifier / ES6ImportedBinding) as findable named elements; we
 * inherit that classification verbatim. Verified via `javap` on the
 * `JavaScriptFindUsagesProvider` class in both `IU-242.24807.4` and
 * `IU-253.28294.334` jars — identical 6-method public signature on both floors.
 *
 * **Historical context:** Plan 08.3-02 SUMMARY § Deviations § "[Rule 4 -
 * Architectural - DEFERRED] SPEC Req 7" documents the architectural reason this
 * extension wasn't shipped in the original Plan 08.3 wave — Plan 08.3-01 shipped
 * only the PsiReference contract, which is necessary but not sufficient for
 * cross-injection Find-Usages. Plan 08.3-04 closes the gap by adding this
 * provider alongside the modifier-arg JS sub-injection (which closes Req 3).
 */
class RozieFindUsagesProvider : FindUsagesProvider {

    private val delegate = JavaScriptFindUsagesProvider()

    override fun getWordsScanner(): WordsScanner? = delegate.wordsScanner

    override fun canFindUsagesFor(psiElement: PsiElement): Boolean {
        // Pitfall 2 — stay inert on non-Rozie .js / .ts / .tsx files. The
        // FindUsagesProvider extension fires for EVERY JS PSI element the
        // platform considers; without this guard, Find-Usages on a vanilla
        // JS function in a non-Rozie file would be routed through our
        // delegate-wrapper, potentially altering the IDE's standard
        // Find-Usages presentation for non-Rozie code (T-08.3-04-01).
        if (!RozieContextCheck.isRozieContext(psiElement)) return false

        // PsiNamedElement check covers all 5 producer kinds Plan 08.3-01's
        // walker returns (JSFunctionDeclaration / JSVariable / JSClass /
        // ES6ImportSpecifier / ES6ImportedBinding — each carries `.name` via
        // PsiNamedElement). Delegating to delegate.canFindUsagesFor ensures the
        // platform's existing rules (e.g., "you can't Find-Usages on a literal")
        // still apply.
        return psiElement is PsiNamedElement && delegate.canFindUsagesFor(psiElement)
    }

    override fun getHelpId(psiElement: PsiElement): String? =
        delegate.getHelpId(psiElement)

    override fun getType(element: PsiElement): String =
        delegate.getType(element)

    override fun getDescriptiveName(element: PsiElement): String =
        delegate.getDescriptiveName(element)

    override fun getNodeText(element: PsiElement, useFullName: Boolean): String =
        delegate.getNodeText(element, useFullName)
}
