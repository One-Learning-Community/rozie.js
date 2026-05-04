package js.rozie.intellij.parser

import com.intellij.extapi.psi.ASTWrapperPsiElement
import com.intellij.lang.ASTNode
import com.intellij.lang.ParserDefinition
import com.intellij.lang.PsiParser
import com.intellij.lexer.Lexer
import com.intellij.openapi.project.Project
import com.intellij.psi.FileViewProvider
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.tree.IElementType
import com.intellij.psi.tree.IFileElementType
import com.intellij.psi.tree.TokenSet
import js.rozie.intellij.RozieLanguage
import js.rozie.intellij.lexer.RozieLexerAdapter
import js.rozie.intellij.lexer.RozieTokenTypes

/**
 * Minimal Rozie parser definition.
 *
 * The parser emits a single composite [RozieRootBlock] PSI element under the file
 * root that wraps every lexer token. Empirical injection probing in Plan 04 showed
 * that the IntelliJ Platform's `MultiHostInjector` dispatcher does NOT walk to
 * `PsiFile` itself when looking for injection hosts — it only visits intermediate
 * composite PSI elements. So the "single block under root" wrapper exists solely
 * to give the dispatcher a non-file PsiLanguageInjectionHost it can reach.
 *
 * Trade-off: still no per-block parsing — bodies remain single tokens — but the
 * tree shape is `RozieFile -> RozieRootBlock -> [60 leaf tokens]` rather than
 * `RozieFile -> [60 leaf tokens]`.
 */
class RozieParserDefinition : ParserDefinition {

    override fun createLexer(project: Project): Lexer = RozieLexerAdapter()

    override fun createParser(project: Project): PsiParser = PsiParser { root, builder ->
        val rootMarker = builder.mark()
        // Wrap all tokens in a RozieRootBlock element so the platform's injection
        // dispatcher has a composite PsiElement to visit.
        val blockMarker = builder.mark()
        while (!builder.eof()) builder.advanceLexer()
        blockMarker.done(ROZIE_ROOT_BLOCK)
        rootMarker.done(root)
        builder.treeBuilt
    }

    override fun getFileNodeType(): IFileElementType = ROZIE_FILE
    override fun getCommentTokens(): TokenSet = RozieTokenTypes.COMMENTS
    override fun getStringLiteralElements(): TokenSet = TokenSet.EMPTY

    override fun createElement(node: ASTNode): PsiElement = when (node.elementType) {
        ROZIE_ROOT_BLOCK -> RozieRootBlock(node)
        else -> throw UnsupportedOperationException(
            "Unexpected Rozie element type: ${node.elementType}",
        )
    }

    override fun createFile(viewProvider: FileViewProvider): PsiFile = RozieFile(viewProvider)

    companion object {
        val ROZIE_FILE: IFileElementType = IFileElementType(RozieLanguage)
        val ROZIE_ROOT_BLOCK: IElementType = RozieRootBlockElementType
    }
}

/**
 * IElementType marker for the single composite block beneath [RozieFile]. Constructed
 * as a singleton so AST diff/equality checks stay stable.
 */
private object RozieRootBlockElementType : IElementType("ROZIE_ROOT_BLOCK", RozieLanguage)

/**
 * Composite PSI element wrapping every lexer token. Implements [com.intellij.psi.PsiLanguageInjectionHost]
 * so the platform's injection-dispatcher walks here when looking for injection hosts.
 */
class RozieRootBlock(node: ASTNode) :
    ASTWrapperPsiElement(node),
    com.intellij.psi.PsiLanguageInjectionHost {

    override fun isValidHost(): Boolean = true

    override fun updateText(text: String): com.intellij.psi.PsiLanguageInjectionHost {
        // Replace this element's text by re-parsing the host file from text.
        val newFile = com.intellij.psi.PsiFileFactory.getInstance(project)
            .createFileFromText(
                "dummy.rozie",
                js.rozie.intellij.RozieFileType,
                text,
            ) as RozieFile
        // The new file's root block becomes our replacement.
        val newBlock = newFile.firstChild as? RozieRootBlock
            ?: error("New Rozie file has no root block")
        this.node.replaceAllChildrenToChildrenOf(newBlock.node)
        return this
    }

    override fun createLiteralTextEscaper(): com.intellij.psi.LiteralTextEscaper<RozieRootBlock> =
        com.intellij.psi.LiteralTextEscaper.createSimple(this)
}
