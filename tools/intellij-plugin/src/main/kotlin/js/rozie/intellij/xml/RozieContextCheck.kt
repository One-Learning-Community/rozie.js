package js.rozie.intellij.xml

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile

/**
 * Factored out of the duplicated `isRozieContext` check across Plans 02–06 per
 * 08.2-RESEARCH Pitfall 2. Every new platform extension class
 * (`RozieAttributeDescriptorsProvider`, `RozieComponentTagProvider`,
 * `RozieAnnotator`, `RozieJsAnnotator`, `RozieAttributeNameCompletionContributor`,
 * `RozieJSReferenceContributor`, the three reference classes) MUST short-circuit
 * on `!RozieContextCheck.isRozieContext(...)` to prevent leaking effect into
 * non-Rozie `.html` / `.js` files in the user's project.
 *
 * The check mirrors the canonical pattern already shipped in
 * [js.rozie.intellij.inspection.RozieHtmlInspectionSuppressor.isProviderAvailable]
 * (lines 34–38): walk via [InjectedLanguageManager.getTopLevelFile] so the guard
 * fires whether the platform asks for context on the injected fragment OR the
 * .rozie host file directly.
 */
object RozieContextCheck {

    /**
     * Returns true iff [element]'s containing file (or, when the element lives
     * inside an injected fragment, the top-level host file) is a `.rozie` file.
     */
    fun isRozieContext(element: PsiElement): Boolean {
        val containing = element.containingFile ?: return false
        return isRozieContext(containing)
    }

    /**
     * Convenience overload accepting a [PsiFile] directly. Used by
     * `XmlSuppressionProvider.isProviderAvailable(file: PsiFile)` and any future
     * extension whose hook receives the file rather than a per-element handle.
     */
    fun isRozieContext(file: PsiFile): Boolean {
        val project = file.project
        val host = InjectedLanguageManager.getInstance(project).getTopLevelFile(file) ?: file
        return host.fileType.name == "Rozie"
    }
}
