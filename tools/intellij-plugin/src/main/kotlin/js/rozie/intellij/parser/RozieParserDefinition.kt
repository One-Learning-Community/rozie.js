package js.rozie.intellij.parser

import com.intellij.lang.ASTNode
import com.intellij.lang.ParserDefinition
import com.intellij.lang.PsiParser
import com.intellij.lexer.Lexer
import com.intellij.openapi.project.Project
import com.intellij.psi.FileViewProvider
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.tree.IFileElementType
import com.intellij.psi.tree.TokenSet
import js.rozie.intellij.RozieLanguage
import js.rozie.intellij.lexer.RozieLexerAdapter
import js.rozie.intellij.lexer.RozieTokenTypes

/**
 * Minimal Rozie parser definition.
 *
 * Per RESEARCH.md A2: a single root marker covering the entire token stream is
 * sufficient for [com.intellij.lang.injection.MultiHostInjector] to find injection
 * hosts. The injector operates at the [PsiElement] level (the [RozieFile] root),
 * not at per-token PSI elements, so we deliberately do NOT build a structured
 * PSI tree per block.
 *
 * If the empirical injection-smoke tests in Plan 04 demonstrate this is
 * insufficient (e.g., the injector cannot find [RozieFile] hosts), the fallback
 * is to split per-block PSI elements (RESEARCH OQ-2; A4 deviation path).
 */
class RozieParserDefinition : ParserDefinition {

    override fun createLexer(project: Project): Lexer = RozieLexerAdapter()

    override fun createParser(project: Project): PsiParser = PsiParser { root, builder ->
        // Minimal: consume all tokens into a single root element.
        // RESEARCH A2: this is sufficient for MultiHostInjector to find injection hosts.
        val rootMarker = builder.mark()
        while (!builder.eof()) builder.advanceLexer()
        rootMarker.done(root)
        builder.treeBuilt
    }

    override fun getFileNodeType(): IFileElementType = ROZIE_FILE
    override fun getCommentTokens(): TokenSet = RozieTokenTypes.COMMENTS
    override fun getStringLiteralElements(): TokenSet = TokenSet.EMPTY
    override fun createElement(node: ASTNode): PsiElement =
        throw UnsupportedOperationException(
            "Rozie has no per-token PSI elements; tokens are wrapped in RozieFile and injected.",
        )
    override fun createFile(viewProvider: FileViewProvider): PsiFile = RozieFile(viewProvider)

    companion object {
        val ROZIE_FILE: IFileElementType = IFileElementType(RozieLanguage)
    }
}
