package js.rozie.intellij.parser

import com.intellij.extapi.psi.PsiFileBase
import com.intellij.openapi.fileTypes.FileType
import com.intellij.openapi.project.Project
import com.intellij.psi.FileViewProvider
import com.intellij.psi.LiteralTextEscaper
import com.intellij.psi.PsiFileFactory
import com.intellij.psi.PsiLanguageInjectionHost
import js.rozie.intellij.RozieFileType
import js.rozie.intellij.RozieLanguage

/**
 * Root PSI element for `.rozie` files. Single injection host for every block body
 * and template attribute value (RESEARCH A4 — start simple).
 *
 * The [com.intellij.lang.injection.MultiHostInjector] does not need per-block PSI
 * elements: it walks the host's text via the lexer and registers TextRange-based
 * injection ranges via `addPlace(host, range)`. If the empirical smoke tests in
 * Plan 04 fail, the fallback is per-block PSI hosts (~2-4 hours additional work
 * per RESEARCH OQ-2).
 */
class RozieFile(viewProvider: FileViewProvider) :
    PsiFileBase(viewProvider, RozieLanguage),
    PsiLanguageInjectionHost {

    override fun getFileType(): FileType = RozieFileType

    override fun toString(): String = "Rozie File"

    // --- PsiLanguageInjectionHost contract ---

    override fun isValidHost(): Boolean = true

    /**
     * Called by the platform when an injected fragment is edited and the host
     * text needs to be rewritten. Standard MDX/Astro pattern: re-create the
     * host file from the new text and graft its AST in place.
     */
    override fun updateText(text: String): PsiLanguageInjectionHost {
        val newFile = createDummyRozieFile(project, text)
        this.node.replaceAllChildrenToChildrenOf(newFile.node)
        return this
    }

    override fun createLiteralTextEscaper(): LiteralTextEscaper<RozieFile> =
        LiteralTextEscaper.createSimple(this)

    private fun createDummyRozieFile(project: Project, text: String): RozieFile =
        PsiFileFactory.getInstance(project)
            .createFileFromText("dummy.rozie", RozieFileType, text) as RozieFile
}
