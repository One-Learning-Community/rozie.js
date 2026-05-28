package js.rozie.intellij.references

import com.intellij.lang.ecmascript6.psi.ES6ImportDeclaration
import com.intellij.lang.javascript.psi.JSFunctionDeclaration
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.lang.javascript.psi.JSVarStatement
import com.intellij.lang.javascript.psi.ecmal4.JSClass
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiElementResolveResult
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiReference
import com.intellij.psi.PsiReferenceBase
import com.intellij.psi.PsiReferenceProvider
import com.intellij.psi.ResolveResult
import com.intellij.psi.util.CachedValueProvider
import com.intellij.psi.util.CachedValuesManager
import com.intellij.psi.util.PsiModificationTracker
import com.intellij.util.ProcessingContext
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.xml.RozieContextCheck

/**
 * Cross-block PsiReference for **bare-identifier** references from any injected
 * JS range (template `{{ }}` interpolations, `r-*` directive values, `@event`
 * handler values, `:prop` colon-bind values, `<listeners>` modifier-arg JS)
 * back to **top-level declarations** in the sibling `<script>` block.
 *
 * Resolves to one of the 5 producer kinds (Phase 08.3 SPEC Req 1–4):
 *   - `let` / `const` (top-level `JSVariable` inside a `JSVarStatement`)
 *   - `function` (`JSFunctionDeclaration`)
 *   - `class` (`JSClass`)
 *   - `import { X } from '…'` / `import X from '…'` / `import * as X from '…'`
 *     (`ES6ImportSpecifier` / `ES6ImportedBinding`)
 *
 * Companion helpers `resolveHost` / `findBlockBodyRange` / `findInjectedFile`
 * are reused **verbatim** from [RoziePropsReference.Companion] via FQN per
 * Phase 08.3 CONTEXT D-03 / D-04 / D-05 — do NOT re-implement.
 *
 * The walker [Companion.findScriptDeclByName] iterates `jsFile.children` (top-
 * level ONLY) — **never** a recursive PSI walk (e.g. PsiTreeUtil's deep
 * find-children-of-type APIs). A recursive walk would falsely resolve nested-
 * scope decls (inside function bodies / blocks) and break SPEC Req 5 (the
 * negative top-level-only invariant).
 *
 * Caching invariant (CONTEXT D-10 / RoziePropsReference Pitfall 5): the
 * `multiResolve` body wraps in `CachedValuesManager.getCachedValue(element)`
 * with `PsiModificationTracker.MODIFICATION_COUNT` invalidation. The cache
 * lambda MUST NOT close over a `PsiElement` field on this reference — the
 * host is recomputed on every resolve via [RoziePropsReference.resolveHost].
 *
 * Disjoint with the magic-ident sibling provider per CONTEXT D-09: this
 * reference only ever exists for `JSReferenceExpression` elements whose
 * `qualifier == null` (the magic-ident provider handles `$X.Y` shapes).
 */
class RozieScriptDeclReference(
    element: JSReferenceExpression,
    rangeInElement: TextRange,
    private val accessedName: String,
) : PsiReferenceBase.Poly<JSReferenceExpression>(element, rangeInElement, false) {

    override fun multiResolve(incompleteCode: Boolean): Array<ResolveResult> {
        // CRITICAL: the cache lambda MUST NOT close over a PSI field on the
        // outer reference — IntelliJ's PSI-leak detector flags any
        // CachedValueProvider that retains a reachable PsiElement through its
        // closure (PsiElement instances can be invalidated on file edits;
        // retained references then access stale PSI). Recompute the host on
        // every resolve via [RoziePropsReference.resolveHost]; the host walk is
        // microseconds-cheap. The cache key is `element` (a long-lived
        // PsiReference target via CachedValuesManager); per-key invalidation
        // rides on PsiModificationTracker.MODIFICATION_COUNT.
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
        val targetRange = RoziePropsReference.findBlockBodyRange(host, RozieTokenTypes.SCRIPT_BODY)
            ?: return ResolveResult.EMPTY_ARRAY
        val targetJsFile = RoziePropsReference.findInjectedFile(host, targetRange, "JavaScript")
            ?: return ResolveResult.EMPTY_ARRAY
        val target = findScriptDeclByName(targetJsFile, accessedName)
            ?: return ResolveResult.EMPTY_ARRAY
        return arrayOf(PsiElementResolveResult(target))
    }

    companion object {
        /**
         * Walk **top-level children only** of [jsFile] looking for a producer
         * declaration whose name matches [name]. Returns the name-identifier
         * leaf (CONTEXT D-07) so Find-Usages output and Rename cursor land
         * cleanly on the name itself.
         *
         * **Anti-pattern guard:** this walker iterates `jsFile.children`
         * directly — it MUST NOT use a recursive PSI walk (e.g. PsiTreeUtil's
         * deep find-children-of-type APIs). Recursive walk would falsely
         * resolve nested-scope decls (e.g. `const inner` inside
         * `function outer() { … }`) and break SPEC Req 5 (the negative
         * top-level-only invariant).
         */
        internal fun findScriptDeclByName(jsFile: PsiFile, name: String): PsiElement? {
            for (child in jsFile.children) {
                val match = matchTopLevelDecl(child, name)
                if (match != null) return match
            }
            return null
        }

        /**
         * Match a single top-level child against [name], returning the name-
         * identifier leaf for the matching producer kind, or null when the
         * child is not a decl producer or its name does not match.
         *
         * Producer kinds (CONTEXT D-07, SPEC Req 1–4):
         *   - [JSFunctionDeclaration] → `.nameIdentifier`
         *   - [JSVarStatement] (containing one or more [JSVariable]) →
         *     matching variable's `.nameIdentifier`
         *   - [JSClass] → `.nameIdentifier`
         *   - [ES6ImportDeclaration] → matching `ES6ImportSpecifier.alias`
         *     (or `.specifier` when no alias) for named imports, OR matching
         *     `ES6ImportedBinding.nameIdentifier` for default / namespace
         *     imports
         */
        private fun matchTopLevelDecl(child: PsiElement, name: String): PsiElement? = when (child) {
            is JSFunctionDeclaration ->
                if (child.name == name) child.nameIdentifier else null
            is JSVarStatement ->
                child.variables.firstOrNull { it.name == name }?.nameIdentifier
            is JSClass ->
                if (child.name == name) child.nameIdentifier else null
            is ES6ImportDeclaration ->
                child.importSpecifiers.firstOrNull { it.declaredName == name }
                    ?.let { (it.alias as? PsiElement) ?: it.referenceNameElement }
                    ?: child.importedBindings.firstOrNull { it.name == name }?.nameIdentifier
            else -> null
        }
    }
}

/**
 * Bare-identifier dispatch sibling of `RozieMagicAccessReferenceProvider`.
 * Fires on the same `JSPatterns.jsReferenceExpression()` pattern; each
 * provider early-returns on the cases the other handles (CONTEXT D-09 — the
 * two providers target disjoint shapes: qualified `$X.Y` vs bare `Y`).
 *
 * Co-located in the same file as the reference it constructs to keep the
 * walker, the reference, and the dispatch logic in one auditable unit
 * (mirrors the `RozieMagicAccessReferenceProvider` co-location inside
 * `RozieJSReferenceContributor.kt`). Marked `internal` (not `private`) so
 * [RozieJSReferenceContributor] can construct it from the sibling file —
 * Kotlin top-level `private` is file-scoped, not package-scoped, so the
 * sibling cannot see it under `private`. Module visibility (`internal`) is
 * the right tool: the class stays out of the plugin's public Kotlin surface
 * but the contributor can still register it.
 */
internal class RozieScriptDeclReferenceProvider : PsiReferenceProvider() {
    override fun getReferencesByElement(
        element: PsiElement,
        context: ProcessingContext,
    ): Array<PsiReference> {
        val ref = element as? JSReferenceExpression ?: return PsiReference.EMPTY_ARRAY

        // Pitfall 2 — stay inert on non-Rozie .js files.
        if (!RozieContextCheck.isRozieContext(element)) return PsiReference.EMPTY_ARRAY

        // Bare-ident only — the magic-ident provider above handles $X.Y shapes
        // (CONTEXT D-09; this is the INVERSE of the analog's qualifier filter).
        if (ref.qualifier != null) return PsiReference.EMPTY_ARRAY

        val accessedName = ref.referenceName ?: return PsiReference.EMPTY_ARRAY

        // The reference's TextRange is the accessed-name leaf relative to the
        // outer JSReferenceExpression element. For a bare-ident expression,
        // referenceNameElement is the identifier leaf itself, so
        // textRangeInParent is the full range of the bare identifier.
        val rangeInElement = ref.referenceNameElement?.textRangeInParent
            ?: return PsiReference.EMPTY_ARRAY

        return arrayOf(RozieScriptDeclReference(ref, rangeInElement, accessedName))
    }
}
