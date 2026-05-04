package js.rozie.intellij.highlighting

import com.intellij.openapi.fileTypes.SyntaxHighlighter
import com.intellij.openapi.fileTypes.SyntaxHighlighterFactory
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile

/**
 * Factory required by the IntelliJ Platform to instantiate a fresh
 * [RozieSyntaxHighlighter] per file. Wired in plugin.xml under the
 * `<lang.syntaxHighlighterFactory>` extension point.
 */
class RozieSyntaxHighlighterFactory : SyntaxHighlighterFactory() {
    override fun getSyntaxHighlighter(
        project: Project?,
        virtualFile: VirtualFile?
    ): SyntaxHighlighter = RozieSyntaxHighlighter()
}
