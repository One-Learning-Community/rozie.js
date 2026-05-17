package js.rozie.intellij.highlighting

import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.fileTypes.SyntaxHighlighter
import com.intellij.openapi.options.colors.AttributesDescriptor
import com.intellij.openapi.options.colors.ColorDescriptor
import com.intellij.openapi.options.colors.ColorSettingsPage
import js.rozie.intellij.RozieIcons
import java.util.ResourceBundle
import javax.swing.Icon

/**
 * Settings → Editor → Color Scheme → Rozie panel.
 *
 * Post-pivot (Phase 08.2): the descriptor list collapses from 21 entries to 6.
 * Surviving entries are the SFC-boundary scopes the host lexer still emits
 * directly (block-tag, lang-attr, HTML comment, bad character) plus the two
 * Annotator-painted scopes shipped in Wave 2 (r-directive, magic identifier).
 *
 * Additional Annotator-painted scopes will be added in later waves as
 * RozieAnnotator coverage expands (per 08.2-RESEARCH § ColorSettingsPage
 * retirements line 156 recommendation).
 */
class RozieColorSettingsPage : ColorSettingsPage {

    private val bundle: ResourceBundle = ResourceBundle.getBundle("messages.RozieBundle")
    private fun msg(key: String): String = bundle.getString(key)

    private val descriptors: Array<AttributesDescriptor> = arrayOf(
        AttributesDescriptor(msg("rozie.color.block.tag"), RozieSyntaxHighlighter.BLOCK_TAG),
        AttributesDescriptor(msg("rozie.color.lang.attr"), RozieSyntaxHighlighter.LANG_ATTR),
        AttributesDescriptor(msg("rozie.color.html.comment"), RozieSyntaxHighlighter.HTML_COMMENT),
        AttributesDescriptor(
            msg("rozie.color.bad.character"),
            RozieSyntaxHighlighter.BAD_CHARACTER
        ),
        AttributesDescriptor(msg("rozie.color.r.directive"), RozieSyntaxHighlighter.R_DIRECTIVE),
        AttributesDescriptor(msg("rozie.color.magic.ident"), RozieSyntaxHighlighter.MAGIC_IDENT)
    )

    override fun getAttributeDescriptors(): Array<AttributesDescriptor> = descriptors

    override fun getColorDescriptors(): Array<ColorDescriptor> = ColorDescriptor.EMPTY_ARRAY

    override fun getDisplayName(): String = msg("rozie.color.settings.page.name")

    override fun getIcon(): Icon = RozieIcons.FILE

    override fun getHighlighter(): SyntaxHighlighter = RozieSyntaxHighlighter()

    override fun getAdditionalHighlightingTagToDescriptorMap(): Map<String, TextAttributesKey>? =
        null

    /**
     * Demo `.rozie` snippet shown in the live-preview pane. Exercises the
     * surviving descriptors (block tag, lang attr, HTML comment, bad char)
     * plus the two Annotator-painted scopes (r-directive, magic identifier)
     * — the latter render via RozieAnnotator over the HTMLLanguage-injected
     * PSI in real `.rozie` files (the preview pane uses the host SyntaxHighlighter
     * only, so r-directive / magic-ident colour appears as their DLHC fallback
     * KEYWORD / PREDEFINED_SYMBOL until the Annotator runs against user code).
     *
     * Note on `${'$'}` escaping: Kotlin raw strings still interpret `$` as a
     * template-substitution sigil; we use `${'$'}` to literally emit `$` for
     * Rozie's magic identifiers.
     */
    override fun getDemoText(): String = """
        <!-- Live demo of Rozie syntax highlighting -->
        <rozie name="Counter">
        <props>
        {
          value: { type: Number, default: 0 }
        }
        </props>
        <script>
        const initial = ${'$'}props.value
        </script>
        <template>
          <button r-if="initial > 0">Above zero</button>
        </template>
        <style lang="scss">
        .counter { padding: 1rem; }
        </style>
        </rozie>
    """.trimIndent()
}
