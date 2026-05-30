package js.rozie.intellij.completion

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionProvider
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.CompletionType
import com.intellij.codeInsight.completion.CompletionUtilCore
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.psi.JSLiteralExpression
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.PsiElement
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.util.ProcessingContext
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.xml.RozieBlockScope
import js.rozie.intellij.xml.RozieContextCheck

/**
 * Path autocomplete for `<components>` import strings — typing
 * `Modal: './<caret>'` offers the relative paths of sibling `.rozie` files so an
 * author can wire up a composed component without leaving the editor or
 * remembering the exact path. The companion to component-tag / import-path
 * go-to-definition ([js.rozie.intellij.navigation.RozieComponentGotoDeclarationHandler]).
 *
 * Confined to a string literal inside the `<components>` block (via
 * [RozieBlockScope]) so it never fires on `<script>` import strings, where the
 * JS plugin's own module resolution owns completion.
 *
 * Offers FULL relative paths (`./Modal.rozie`, `./ui/Button.rozie`) as single
 * lookup items rather than path-segment-by-segment, and narrows the prefix
 * matcher to the partial path already typed so acceptance replaces the whole
 * string content cleanly. Scans the host file's directory subtree up to
 * [MAX_DEPTH] levels deep, excluding the file being edited.
 */
class RozieComponentImportPathCompletionContributor : CompletionContributor() {

    init {
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement().inside(JSLiteralExpression::class.java),
            object : CompletionProvider<CompletionParameters>() {
                override fun addCompletions(
                    parameters: CompletionParameters,
                    context: ProcessingContext,
                    result: CompletionResultSet,
                ) {
                    val pos = parameters.position
                    if (!RozieContextCheck.isRozieContext(pos)) return
                    if (!RozieBlockScope.injectedCaretInBlock(
                            pos, parameters.offset, RozieTokenTypes.COMPONENTS_BODY,
                        )
                    ) {
                        return
                    }

                    val literal = PsiTreeUtil.getParentOfType(pos, JSLiteralExpression::class.java)
                        ?: return
                    if (!literal.isStringLiteral) return

                    val ilm = InjectedLanguageManager.getInstance(pos.project)
                    val host = ilm.getTopLevelFile(pos.containingFile) ?: return
                    val dir = host.originalFile.virtualFile?.parent ?: return
                    val selfName = host.originalFile.virtualFile?.name

                    val paths = collectRoziePaths(dir, selfName)
                    if (paths.isEmpty()) return

                    val rs = result.withPrefixMatcher(partialPathBeforeCaret(literal, parameters.offset))
                    for (path in paths) {
                        rs.addElement(LookupElementBuilder.create(path).withTypeText("component"))
                    }
                }
            },
        )
    }

    private companion object {
        const val MAX_DEPTH = 3

        /**
         * The string content typed before the caret, with the synthetic
         * completion dummy stripped. Used as the prefix matcher so a fully-typed
         * `./ui/Bu` still matches `./ui/Button.rozie` and acceptance replaces the
         * whole partial path.
         */
        fun partialPathBeforeCaret(literal: JSLiteralExpression, caret: Int): String {
            val start = literal.textRange.startOffset
            val raw = literal.text
            // Drop the opening quote; take up to the caret within the literal.
            val end = (caret - start).coerceIn(1, raw.length)
            val before = raw.substring(1, end)
            return before.substringBefore(CompletionUtilCore.DUMMY_IDENTIFIER_TRIMMED)
        }

        /**
         * Relative paths (`./Foo.rozie`, `./sub/Bar.rozie`) of every `.rozie` file
         * under [dir] up to [MAX_DEPTH] levels deep, excluding [selfName] in the
         * top directory (a component never imports itself).
         */
        fun collectRoziePaths(dir: VirtualFile, selfName: String?): List<String> {
            val out = ArrayList<String>()
            fun walk(current: VirtualFile, relPrefix: String, depth: Int) {
                for (child in current.children) {
                    if (child.isDirectory) {
                        if (depth < MAX_DEPTH) walk(child, "$relPrefix${child.name}/", depth + 1)
                        continue
                    }
                    if (child.extension != "rozie") continue
                    if (relPrefix == "./" && child.name == selfName) continue
                    out.add("$relPrefix${child.name}")
                }
            }
            walk(dir, "./", 1)
            return out
        }
    }
}
