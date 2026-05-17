package js.rozie.intellij.references

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.psi.JSLabeledStatement
import com.intellij.lang.javascript.psi.JSProperty
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiElementResolveResult
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiReferenceBase
import com.intellij.psi.ResolveResult
import com.intellij.psi.util.CachedValueProvider
import com.intellij.psi.util.CachedValuesManager
import com.intellij.psi.util.PsiModificationTracker
import com.intellij.psi.util.PsiTreeUtil
import js.rozie.intellij.lexer.RozieLexerAdapter
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.parser.RozieRootBlock

/**
 * Cross-block PsiReference for `$props.X` access — resolves the accessed name `X`
 * to the corresponding `JSProperty` declaration inside the sibling `<props>` block.
 *
 * Algorithm (RESEARCH Pattern 5 sketch, lines 617–656):
 *   1. Re-lex [host].text using [RozieLexerAdapter] to find the
 *      [RozieTokenTypes.PROPS_BODY] token's byte range.
 *   2. Ask [InjectedLanguageManager] for all injected PSI files under [host];
 *      pick the one whose injected range covers the PROPS_BODY range AND
 *      whose `language.id == "JavaScript"`.
 *   3. Walk that injected JS file for a [JSProperty] whose `name == accessedName`.
 *   4. Wrap the entire walk in `CachedValuesManager.getCachedValue(...)` per
 *      RESEARCH Pitfall 5 — repeated navigation invocations on the same
 *      reference element should not re-walk the host token stream.
 *
 * Re-lex pattern source: adapted verbatim from
 * [js.rozie.intellij.injection.RozieMultiHostInjector.scanTokens] (lines 159–176)
 * — same `RozieLexerAdapter().apply { start(text) }` + token-type matching loop.
 *
 * Spike-conditional fallback (RESEARCH Pitfall 5, lines 851–854): if Task 0's
 * spike had returned RED (`getInjectionHost` → null), this class would receive
 * the host via `element.containingFile.context as? RozieRootBlock` instead of
 * as a constructor parameter. Task 0 spike was GREEN, so we use the primary path.
 */
class RoziePropsReference(
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
        // every resolve via [resolveHost]; the host walk is microseconds-cheap.
        // The cache key is `element` (a long-lived PsiReference target via
        // CachedValuesManager); per-key invalidation rides on
        // PsiModificationTracker.MODIFICATION_COUNT.
        return CachedValuesManager.getCachedValue(element) {
            val resolved = doResolve()
            CachedValueProvider.Result.create(
                resolved,
                PsiModificationTracker.MODIFICATION_COUNT,
            )
        }
    }

    private fun doResolve(): Array<ResolveResult> {
        val host = resolveHost(element) ?: return ResolveResult.EMPTY_ARRAY
        val targetRange = findBlockBodyRange(host, RozieTokenTypes.PROPS_BODY)
            ?: return ResolveResult.EMPTY_ARRAY
        val targetJsFile = findInjectedFile(host, targetRange, "JavaScript")
            ?: return ResolveResult.EMPTY_ARRAY
        val target = findJsKeyByName(targetJsFile, accessedName) ?: return ResolveResult.EMPTY_ARRAY
        return arrayOf(PsiElementResolveResult(target))
    }

    companion object {
        /**
         * Walk back from the injected [element] to its [RozieRootBlock] host,
         * combining the primary [InjectedLanguageManager.getInjectionHost] path
         * (validated GREEN by the Task 0 spike for the SC-5 use case) with the
         * `element.containingFile.context` fallback per RESEARCH Pitfall 5
         * (lines 851–854) for cached/stale injected elements.
         *
         * Always called from inside the CachedValueProvider lambda so the result
         * lives only as long as the resolution itself — no PSI is retained across
         * resolve invocations.
         */
        internal fun resolveHost(element: JSReferenceExpression): RozieRootBlock? {
            val ilm = InjectedLanguageManager.getInstance(element.project)
            val viaInjector = ilm.getInjectionHost(element) as? RozieRootBlock
            if (viaInjector != null) return viaInjector
            return element.containingFile?.context as? RozieRootBlock
        }

        /**
         * Walk [jsFile] for a node whose "key name" matches [accessedName].
         *
         * JavaScript ambiguity: the `<props>` and `<data>` block bodies look like
         * `{ value: { type: Number, default: 0 } }` — a JS object literal in
         * intent. But at JS file top-level (statement position), `{ x: y }` is
         * parsed as a [com.intellij.lang.javascript.psi.JSBlockStatement]
         * containing a [JSLabeledStatement] where the label `x:` carries the
         * "key" semantics, NOT as a [com.intellij.lang.javascript.psi.JSObjectLiteralExpression]
         * with [JSProperty] children. To make the reference resolve correctly
         * without fragmenting the injector, we accept BOTH PSI shapes:
         *
         *   - [JSProperty] (when the body happens to parse as an object literal —
         *     e.g., a future planned injection wrap like `(...)` or `=...`).
         *   - [JSLabeledStatement] (the current actual shape produced by the
         *     plain-body JS injection from Plan 02's RozieMultiHostInjector).
         *
         * The returned [PsiElement] is the PSI node that "carries" the name —
         * the JSProperty itself, or the JSLabeledStatement's labelIdentifier
         * element (which is what Go-to-Declaration jumps to visually). This
         * keeps the navigation cursor on the *key*, not the surrounding block.
         */
        internal fun findJsKeyByName(jsFile: PsiFile, accessedName: String): PsiElement? {
            // Prefer JSProperty when present (cleanest semantic match).
            val asProperty = PsiTreeUtil.findChildrenOfType(jsFile, JSProperty::class.java)
                .firstOrNull { it.name == accessedName }
            if (asProperty != null) return asProperty

            // Fall back to JSLabeledStatement — the actual top-level parse shape
            // of `{ key: value }` in statement position.
            val asLabel = PsiTreeUtil.findChildrenOfType(jsFile, JSLabeledStatement::class.java)
                .firstOrNull { it.label == accessedName }
            if (asLabel != null) {
                // Navigate to the labelIdentifier (the `value` in `value:`) for
                // a precise Go-to-Declaration cursor landing.
                return asLabel.labelIdentifier ?: asLabel
            }
            return null
        }

        /**
         * Re-lex [host].text and return the byte range of the first token whose
         * type matches [blockBodyToken]. Returns null when the block is absent.
         *
         * Shared by [RoziePropsReference], [RozieDataReference], and
         * [RozieRefsReference] — same scanTokens shape across all three.
         */
        internal fun findBlockBodyRange(
            host: RozieRootBlock,
            blockBodyToken: com.intellij.psi.tree.IElementType,
        ): TextRange? {
            val text = host.text
            val lexer = RozieLexerAdapter().apply { start(text) }
            while (lexer.tokenType != null) {
                if (lexer.tokenType == blockBodyToken) {
                    // Token offsets are RELATIVE to the lexer's input (= host.text).
                    // The injected-range walk needs FILE-absolute offsets — translate
                    // by the host's start offset.
                    val hostStart = host.textRange.startOffset
                    return TextRange(
                        hostStart + lexer.tokenStart,
                        hostStart + lexer.tokenEnd,
                    )
                }
                lexer.advance()
            }
            return null
        }

        /**
         * Find the injected [PsiFile] under [host] whose injection range covers
         * [targetRange] AND whose `language.id == expectedLanguageId`.
         */
        internal fun findInjectedFile(
            host: RozieRootBlock,
            targetRange: TextRange,
            expectedLanguageId: String,
        ): PsiFile? {
            val ilm = InjectedLanguageManager.getInstance(host.project)
            // PRIMARY PATH: force injector to run by calling findInjectedElementAt
            // at the target range start. This is the canonical pattern from
            // RozieInjectionTest (line 110-118) — getInjectedPsiFiles returns cached
            // results which may be empty when the injector hasn't been kicked yet
            // (Pitfall 5 cache cold-start). findInjectedElementAt forces resolution
            // for a specific offset and returns the injected element directly.
            val containingFile = host.containingFile ?: return null
            val injectedElement = ilm.findInjectedElementAt(containingFile, targetRange.startOffset)
            val directFile = injectedElement?.containingFile
            if (directFile != null && directFile.language.id == expectedLanguageId) {
                return directFile
            }

            // FALLBACK: scan all cached injections under the host. NOTE the range
            // semantics — getInjectedPsiFiles returns ranges that are absolute
            // offsets relative to the SAME file [host] lives in. RozieRootBlock
            // is a single composite spanning the entire file body, so its
            // textRange.startOffset is 0 and absolute == relative. We use
            // contains(offset) directly, no translation needed.
            val injected = ilm.getInjectedPsiFiles(host) ?: return null
            for (pair in injected) {
                val psi = pair.first
                val range = pair.second
                val file = psi as? PsiFile ?: continue
                if (file.language.id != expectedLanguageId) continue
                if (range.containsOffset(targetRange.startOffset)) {
                    return file
                }
            }
            return null
        }
    }
}
