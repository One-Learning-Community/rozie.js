package js.rozie.intellij.xml

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.psi.PsiElement
import js.rozie.intellij.lexer.RozieTokenTypes

/**
 * Extracts the CSS class names declared in a `.rozie` file's `<style>` block —
 * the shared source for both the static `class="…"` completion
 * ([js.rozie.intellij.completion.RozieClassNameCompletionContributor]) and the
 * bound `:class="…"` string-literal completion
 * ([js.rozie.intellij.completion.RozieBoundClassCompletionContributor]).
 *
 * A lightweight regex scan of the `<style>` body (works across plain CSS, SCSS,
 * and LESS) rather than a CSS PSI walk, so it never depends on the injected CSS
 * fragment being resolved at completion time.
 */
object RozieStyleClasses {

    /** Class-selector token: a `.` followed by a CSS identifier. */
    private val CLASS_REGEX = Regex("""\.(-?[_a-zA-Z][-_a-zA-Z0-9]*)""")

    /**
     * Distinct class names declared in the first `<style>` block of [element]'s
     * host `.rozie` file. Empty for non-Rozie files or files without a `<style>`
     * block.
     */
    fun forElement(element: PsiElement): List<String> {
        val containing = element.containingFile ?: return emptyList()
        val ilm = InjectedLanguageManager.getInstance(containing.project)
        val host = ilm.getTopLevelFile(containing) ?: containing
        if (host.fileType.name != "Rozie") return emptyList()
        val body = RozieComponentRegistry.blockBodyText(host.text, RozieTokenTypes.STYLE_BODY)
            ?: return emptyList()
        return CLASS_REGEX.findAll(body).map { it.groupValues[1] }.distinct().toList()
    }
}
