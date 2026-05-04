package js.rozie.intellij.highlighting

import com.intellij.lexer.Lexer
import com.intellij.openapi.editor.DefaultLanguageHighlighterColors as DLHC
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.fileTypes.SyntaxHighlighterBase
import com.intellij.psi.tree.IElementType
import js.rozie.intellij.lexer.RozieLexerAdapter
import js.rozie.intellij.lexer.RozieTokenTypes

/**
 * Maps each Rozie [IElementType] from [RozieTokenTypes] to a [TextAttributesKey]
 * so the editor can colorize tokens according to RESEARCH.md Pattern 6.
 *
 * **Important — naming convention:** the external names passed to
 * `TextAttributesKey.createTextAttributesKey(name, fallback)` (e.g.,
 * `ROZIE_BLOCK_TAG`, `ROZIE_R_DIRECTIVE`) become the persisted color-scheme keys
 * in users' saved IDE preferences. After v1 ships these names are STABLE API —
 * renaming a key breaks color customization for every user. The convention is
 * `ROZIE_<UPPER_SNAKE>` matching the IElementType name where possible. (T-8-03-01.)
 */
class RozieSyntaxHighlighter : SyntaxHighlighterBase() {

    companion object {
        // === User-themable token classes (D-06) ===

        val BLOCK_TAG: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_BLOCK_TAG", DLHC.METADATA)
        val R_DIRECTIVE: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_R_DIRECTIVE", DLHC.KEYWORD)
        val EVENT_AT: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_EVENT_AT", DLHC.METADATA)
        val EVENT_NAME: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_EVENT_NAME", DLHC.INSTANCE_METHOD)
        val MODIFIER: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_MODIFIER", DLHC.STATIC_METHOD)
        val MODIFIER_PUNCTUATION: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_MODIFIER_PUNCTUATION", DLHC.DOT)
        val PROP_BINDING_PUNCTUATION: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_PROP_BINDING_PUNCT", DLHC.DOT)
        val PROP_BINDING_NAME: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_PROP_BINDING_NAME", DLHC.STATIC_FIELD)
        val INTERPOLATION_DELIM: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey(
                "ROZIE_INTERPOLATION_DELIM",
                DLHC.TEMPLATE_LANGUAGE_COLOR
            )
        val MAGIC_IDENT: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_MAGIC_IDENT", DLHC.PREDEFINED_SYMBOL)
        val REF_ATTR: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_REF_ATTR", DLHC.STATIC_FIELD)
        val LANG_ATTR: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_LANG_ATTR", DLHC.METADATA)
        val HTML_ATTR_NAME: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_HTML_ATTR_NAME", DLHC.MARKUP_ATTRIBUTE)
        val HTML_COMMENT: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_HTML_COMMENT", DLHC.LINE_COMMENT)
        val BAD_CHARACTER: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey(
                "ROZIE_BAD_CHARACTER",
                DLHC.INVALID_STRING_ESCAPE
            )

        // Pre-allocated arrays returned by getTokenHighlights — avoid allocating per call.
        private val BLOCK_TAG_KEYS = arrayOf(BLOCK_TAG)
        private val R_DIRECTIVE_KEYS = arrayOf(R_DIRECTIVE)
        private val EVENT_AT_KEYS = arrayOf(EVENT_AT)
        private val EVENT_NAME_KEYS = arrayOf(EVENT_NAME)
        private val MODIFIER_KEYS = arrayOf(MODIFIER)
        private val MODIFIER_PUNCT_KEYS = arrayOf(MODIFIER_PUNCTUATION)
        private val PROP_PUNCT_KEYS = arrayOf(PROP_BINDING_PUNCTUATION)
        private val PROP_NAME_KEYS = arrayOf(PROP_BINDING_NAME)
        private val INTERP_KEYS = arrayOf(INTERPOLATION_DELIM)
        private val MAGIC_KEYS = arrayOf(MAGIC_IDENT)
        private val REF_KEYS = arrayOf(REF_ATTR)
        private val LANG_KEYS = arrayOf(LANG_ATTR)
        private val HTML_ATTR_KEYS = arrayOf(HTML_ATTR_NAME)
        private val HTML_COMMENT_KEYS = arrayOf(HTML_COMMENT)
        private val BAD_KEYS = arrayOf(BAD_CHARACTER)
        private val EMPTY_KEYS = emptyArray<TextAttributesKey>()
    }

    override fun getHighlightingLexer(): Lexer = RozieLexerAdapter()

    override fun getTokenHighlights(t: IElementType): Array<TextAttributesKey> = when (t) {
        // Block open + close tags — both render as BLOCK_TAG
        RozieTokenTypes.ROZIE_BLOCK_TAG, RozieTokenTypes.TEMPLATE_BLOCK_TAG,
        RozieTokenTypes.SCRIPT_BLOCK_TAG, RozieTokenTypes.PROPS_BLOCK_TAG,
        RozieTokenTypes.DATA_BLOCK_TAG, RozieTokenTypes.LISTENERS_BLOCK_TAG,
        RozieTokenTypes.STYLE_BLOCK_TAG,
        RozieTokenTypes.ROZIE_CLOSE_TAG, RozieTokenTypes.TEMPLATE_CLOSE_TAG,
        RozieTokenTypes.SCRIPT_CLOSE_TAG, RozieTokenTypes.PROPS_CLOSE_TAG,
        RozieTokenTypes.DATA_CLOSE_TAG, RozieTokenTypes.LISTENERS_CLOSE_TAG,
        RozieTokenTypes.STYLE_CLOSE_TAG -> BLOCK_TAG_KEYS

        // Directives
        RozieTokenTypes.R_DIRECTIVE -> R_DIRECTIVE_KEYS

        // Events
        RozieTokenTypes.EVENT_AT -> EVENT_AT_KEYS
        RozieTokenTypes.EVENT_NAME -> EVENT_NAME_KEYS

        // Modifiers
        RozieTokenTypes.MODIFIER_DOT, RozieTokenTypes.MODIFIER_LPAREN,
        RozieTokenTypes.MODIFIER_RPAREN -> MODIFIER_PUNCT_KEYS
        RozieTokenTypes.MODIFIER_NAME -> MODIFIER_KEYS
        // MODIFIER_ARGS — leave as default (could be JS-injected later); render uncolored

        // Prop bindings
        RozieTokenTypes.PROP_COLON -> PROP_PUNCT_KEYS
        RozieTokenTypes.PROP_NAME -> PROP_NAME_KEYS

        // Mustache
        RozieTokenTypes.MUSTACHE_OPEN, RozieTokenTypes.MUSTACHE_CLOSE -> INTERP_KEYS
        // MUSTACHE_BODY — leave default; Plan 04 may inject JS

        // Magic identifiers
        RozieTokenTypes.MAGIC_IDENT -> MAGIC_KEYS

        // Ref attribute
        RozieTokenTypes.REF_ATTR_NAME -> REF_KEYS

        // Lang attribute
        RozieTokenTypes.LANG_ATTR_NAME, RozieTokenTypes.LANG_ATTR_VALUE -> LANG_KEYS

        // Generic HTML attributes (in template tags)
        RozieTokenTypes.ATTR_NAME -> HTML_ATTR_KEYS

        // HTML comments
        RozieTokenTypes.HTML_COMMENT_OPEN, RozieTokenTypes.HTML_COMMENT_CONTENT,
        RozieTokenTypes.HTML_COMMENT_CLOSE -> HTML_COMMENT_KEYS

        // Errors
        RozieTokenTypes.BAD_CHARACTER -> BAD_KEYS

        // Body tokens (SCRIPT_BODY, TEMPLATE_BODY, etc.) and ATTR_VALUE_*
        // — leave uncolored; Plan 04 injection will color via host language
        else -> EMPTY_KEYS
    }
}
