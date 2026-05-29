package js.rozie.intellij.refactoring

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiDocumentManager
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiNameIdentifierOwner
import com.intellij.psi.PsiNamedElement
import com.intellij.psi.PsiReference
import com.intellij.psi.search.SearchScope
import com.intellij.psi.search.searches.ReferencesSearch
import com.intellij.refactoring.listeners.RefactoringElementListener
import com.intellij.refactoring.rename.RenamePsiElementProcessor
import com.intellij.usageView.UsageInfo
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.parser.RozieRootBlock
import js.rozie.intellij.references.RoziePropsReference

/**
 * Custom rename for Rozie `<props>` / `<data>` sigil members (the keys a
 * consumer reaches as `$props.X` / `$data.X`).
 *
 * **Why a whole processor instead of patching a reference.** Renaming such a key
 * is, to the platform, renaming a JS declaration that lives inside one injected
 * fragment whose `$props.X` usages live in OTHER injected fragments (template
 * interpolations, `:`-bind expressions, handlers) sharing ONE multi-injection
 * `RozieRootBlock` host. The JS plugin's [JSDefaultRenameProcessor] drives that
 * rename and crashes two different ways depending on platform build:
 *   - it builds a `SmartPsiElementPointer` over the injected `$props.X`
 *     `JSReferenceExpression`, which cannot restore against the multi-injection
 *     host (`Cannot restore JSReferenceExpression … from injected{…}` — fatal in
 *     2024.2-era findUsages), and
 *   - even when usages are host-anchored, `PsiReferenceBase.handleElementRename`
 *     asks for an `ElementManipulator` on the raw `TEMPLATE_BODY` leaf, of which
 *     none is registered (`No ElementManipulator instance registered …` — Dan's
 *     2025.3 GUI crash).
 *
 * Both are symptoms of letting the platform's usage-info + manipulator machinery
 * touch the injection layer. This processor sidesteps the layer entirely: it
 * (1) reports ONLY host-anchored references during findUsages (restorable
 * pointers — see [findReferences]) and (2) performs every edit — declaration and
 * usages — directly on the host `.rozie` document in [renameElement], so neither
 * an injected smart-pointer nor an `ElementManipulator` is ever needed.
 *
 * Scope is deliberately narrow ([canProcessElement]): only `<props>`/`<data>`
 * keys, which are pure cross-block declarations. Local `<script>` symbols whose
 * usages stay inside their own fragment are left to the JS plugin (which renames
 * them correctly — there is no cross-injection hop to break).
 */
class RozieSigilRenameProcessor : RenamePsiElementProcessor() {

    override fun canProcessElement(element: PsiElement): Boolean {
        if (element !is PsiNamedElement) return false
        val containing = element.containingFile ?: return false
        val ilm = InjectedLanguageManager.getInstance(element.project)
        val host = rootBlock(element, ilm) ?: return false
        if (ilm.getTopLevelFile(containing)?.fileType?.name != "Rozie") return false

        // Confine to keys whose injected decl falls inside the <props>/<data>
        // block body — those are the only decls reached cross-block as $props.X /
        // $data.X (and thus the only ones the JS rename path mishandles).
        val declHost = declHostRange(element, ilm) ?: return false
        return blockContains(host, RozieTokenTypes.PROPS_BODY, declHost.startOffset) ||
            blockContains(host, RozieTokenTypes.DATA_BODY, declHost.startOffset)
    }

    /**
     * Report ONLY host-anchored references (those whose element lives in the
     * `.rozie` host, not an injected fragment). The host-anchored
     * `RozieReferenceSearcher` results are restorable; filtering out the JS
     * plugin's injected `$props.X` references is what prevents the fatal
     * injected-pointer-restore during the platform's findUsages pass.
     */
    override fun findReferences(
        element: PsiElement,
        searchScope: SearchScope,
        searchInCommentsAndStrings: Boolean,
    ): MutableCollection<PsiReference> {
        val ilm = InjectedLanguageManager.getInstance(element.project)
        return ReferencesSearch.search(element, searchScope).findAll()
            .filter { ref ->
                val el = ref.element
                ilm.getInjectionHost(el) == null && el.containingFile?.fileType?.name == "Rozie"
            }
            .toMutableList()
    }

    /**
     * Rename by editing the host document directly.
     *
     * Usage ranges are recovered by SCANNING THE HOST TEXT for `$sigil.<oldName>`
     * — NOT from the platform's [usages] / [ReferencesSearch]. That search resolves
     * each occurrence by walking into its injected JS fragment, and on a cold
     * injection cache (e.g. the very first rename after opening the file) those
     * fragments aren't built yet, so it finds zero usages and only the declaration
     * gets renamed — undo-and-retry then "works" because the first pass primed the
     * cache. A lexical host scan has no such dependency: it renames every usage on
     * the first try, every time. The declaration key is added from its
     * injected→host mapping (its fragment is always primed — the rename target was
     * resolved from it). All edits apply in descending offset order so earlier
     * edits never shift later ranges; no PSI manipulator / injected pointer is
     * touched.
     */
    override fun renameElement(
        element: PsiElement,
        newName: String,
        usages: Array<out UsageInfo>,
        listener: RefactoringElementListener?,
    ) {
        val ilm = InjectedLanguageManager.getInstance(element.project)
        val containing = element.containingFile ?: return
        val host = rootBlock(element, ilm) ?: return
        val hostFile = ilm.getTopLevelFile(containing) ?: return
        val docManager = PsiDocumentManager.getInstance(element.project)
        val document = docManager.getDocument(hostFile) ?: return
        val oldName = (element as? PsiNamedElement)?.name ?: return

        val declHost = declHostRange(element, ilm) ?: return
        val sigil = when {
            blockContains(host, RozieTokenTypes.PROPS_BODY, declHost.startOffset) -> "\$props"
            blockContains(host, RozieTokenTypes.DATA_BODY, declHost.startOffset) -> "\$data"
            else -> return
        }

        val ranges = sortedSetOf(compareByDescending<TextRange> { it.startOffset })
        ranges.add(declHost)
        // `$props . oldName` (optional whitespace / optional `?.`), name not part
        // of a longer identifier. Sigil not preceded by an identifier/`$` char.
        val usagePattern = Regex(
            "(?<![\\w$])" + Regex.escape(sigil) + "\\s*\\??\\s*\\.\\s*(" +
                Regex.escape(oldName) + ")(?![\\w$])",
        )
        for (match in usagePattern.findAll(document.text)) {
            val g = match.groups[1]!!.range
            ranges.add(TextRange(g.first, g.last + 1))
        }

        for (range in ranges) { // descending — earlier edits don't shift later ranges
            document.replaceString(range.startOffset, range.endOffset, newName)
        }
        docManager.commitDocument(document)

        if (element.isValid) listener?.elementRenamed(element)
    }

    private companion object {
        /** Resolve the [RozieRootBlock] host of an injected [element]. */
        fun rootBlock(element: PsiElement, ilm: InjectedLanguageManager): RozieRootBlock? =
            ilm.getInjectionHost(element) as? RozieRootBlock
                ?: element.containingFile?.context as? RozieRootBlock

        /** True when [host]'s [token] block body covers host offset [offset]. */
        fun blockContains(host: RozieRootBlock, token: com.intellij.psi.tree.IElementType, offset: Int): Boolean =
            RoziePropsReference.findBlockBodyRange(host, token)?.contains(offset) == true

        /**
         * Host-absolute range of [element]'s name identifier (the declaration
         * key), mapping its injected coordinates back to the host document.
         */
        fun declHostRange(element: PsiElement, ilm: InjectedLanguageManager): TextRange? {
            val nameRange = (element as? PsiNameIdentifierOwner)?.nameIdentifier?.textRange
                ?: element.textRange
                ?: return null
            return ilm.injectedToHost(element, nameRange)
        }
    }
}
