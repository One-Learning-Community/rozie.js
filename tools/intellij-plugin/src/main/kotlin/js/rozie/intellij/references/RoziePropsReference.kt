package js.rozie.intellij.references

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.psi.JSProperty
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.openapi.util.TextRange
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
    private val host: RozieRootBlock,
    private val accessedName: String,
) : PsiReferenceBase.Poly<JSReferenceExpression>(element, rangeInElement, false) {

    override fun multiResolve(incompleteCode: Boolean): Array<ResolveResult> {
        return CachedValuesManager.getCachedValue(element) {
            CachedValueProvider.Result.create(
                doResolve(),
                PsiModificationTracker.MODIFICATION_COUNT,
            )
        }
    }

    private fun doResolve(): Array<ResolveResult> {
        val targetRange = findBlockBodyRange(host, RozieTokenTypes.PROPS_BODY)
            ?: return ResolveResult.EMPTY_ARRAY
        val targetJsFile = findInjectedFile(host, targetRange, "JavaScript")
            ?: return ResolveResult.EMPTY_ARRAY
        val target = PsiTreeUtil.findChildrenOfType(targetJsFile, JSProperty::class.java)
            .firstOrNull { it.name == accessedName }
            ?: return ResolveResult.EMPTY_ARRAY
        return arrayOf(PsiElementResolveResult(target))
    }

    companion object {
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
            // Returns Java `List<Pair<PsiElement, TextRange>>` (com.intellij.openapi.util.Pair),
            // NOT kotlin.Pair — no destructuring; use .getFirst() / .getSecond() via the
            // Kotlin synthetic property accessors `.first` / `.second`.
            val injected = ilm.getInjectedPsiFiles(host) ?: return null
            val hostStart = host.textRange.startOffset
            for (pair in injected) {
                val psi = pair.first
                val range = pair.second
                val file = psi as? PsiFile ?: continue
                if (file.language.id != expectedLanguageId) continue
                // Translate the injected `range` (relative to the host) to file-absolute
                // offsets so we can compare against [targetRange] (already absolute).
                val absoluteStart = hostStart + range.startOffset
                val absoluteEnd = hostStart + range.endOffset
                if (targetRange.startOffset in absoluteStart until absoluteEnd) {
                    return file
                }
            }
            return null
        }
    }
}
