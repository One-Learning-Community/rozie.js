package js.rozie.intellij.xml

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.psi.PsiElement
import com.intellij.psi.tree.IElementType
import js.rozie.intellij.parser.RozieRootBlock
import js.rozie.intellij.references.RoziePropsReference

/**
 * Shared helper for confining an injected-fragment caret to one specific SFC
 * block. `<script>`, `<props>`, `<data>`, `<listeners>`, and `<components>` all
 * inject JavaScript into the same host, so "the caret is in injected JS" is not
 * enough to tell which block it lives in — contributors that should fire in only
 * one block (descriptor-key completion in `<props>`, import-path completion in
 * `<components>`, …) map the caret back to the host and check it falls inside the
 * target block-body token's range.
 *
 * Reuses [RoziePropsReference]'s lexer-backed [RoziePropsReference.findBlockBodyRange]
 * and the platform `injectedToHost` offset mapping — the same machinery the
 * cross-block references already rely on, so block detection here can never drift
 * from navigation.
 */
object RozieBlockScope {

    /**
     * True iff [element] (an element inside an injected fragment, with caret at
     * injected-document offset [caretInInjected]) maps back to a host offset
     * covered by the [token]-typed SFC block body.
     */
    fun injectedCaretInBlock(element: PsiElement, caretInInjected: Int, token: IElementType): Boolean {
        val ilm = InjectedLanguageManager.getInstance(element.project)
        val host = (ilm.getInjectionHost(element) as? RozieRootBlock)
            ?: (element.containingFile?.context as? RozieRootBlock)
            ?: return false
        val hostOffset = ilm.injectedToHost(element, caretInInjected)
        val range = RoziePropsReference.findBlockBodyRange(host, token) ?: return false
        return range.containsOffset(hostOffset)
    }
}
