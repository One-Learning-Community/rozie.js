package js.rozie.intellij.highlighting

import com.intellij.lexer.Lexer
import com.intellij.openapi.editor.DefaultLanguageHighlighterColors as DLHC
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.fileTypes.SyntaxHighlighterBase
import com.intellij.psi.tree.IElementType
import js.rozie.intellij.lexer.RozieLexerAdapter
import js.rozie.intellij.lexer.RozieTokenTypes

/**
 * Maps each Rozie host-lexer [IElementType] from [RozieTokenTypes] to a
 * [TextAttributesKey].
 *
 * Post-pivot (Phase 08.2): the host lexer's when-arm dispatch only covers
 * surviving SFC-boundary tokens (block-open/close tags, lang attribute,
 * HTML comment, bad character). Template-level Rozie sigils (`r-*`, `@`,
 * `:`, `#`, `<Component>`, `$magic`) are coloured by RozieAnnotator /
 * RozieJsAnnotator (Plan 04) over the HTMLLanguage-injected / JavaScript-
 * injected PSI — NOT here.
 *
 * The R_DIRECTIVE / EVENT_AT / PROP_BINDING_NAME / SLOT_FILL_MARKER /
 * COMPONENT_REF / REF_ATTR / MAGIC_IDENT TextAttributesKey constants are
 * KEPT on the companion object (Option A per 08.2-PATTERNS Disposition
 * Decision 1) for RozieAnnotator + RozieJsAnnotator reuse.
 *
 * **Important — naming convention:** the external names passed to
 * `TextAttributesKey.createTextAttributesKey(name, fallback)` (e.g.,
 * `ROZIE_BLOCK_TAG`, `ROZIE_R_DIRECTIVE`) become the persisted color-scheme
 * keys in users' saved IDE preferences. After v1 ships these names are
 * STABLE API — renaming a key breaks color customization for every user.
 * The convention is `ROZIE_<UPPER_SNAKE>` matching the IElementType name
 * where possible. (T-8-03-01.)
 */
class RozieSyntaxHighlighter : SyntaxHighlighterBase() {

    companion object {
        // === User-themable token classes (D-06) ===

        val BLOCK_TAG: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_BLOCK_TAG", DLHC.METADATA)

        /**
         * Rozie directive (`r-if`, `r-for`, `r-model`, ...). Annotator-painted
         * from Plan 04 — kept as a companion-object constant so the Annotator
         * can reference it without re-declaring the external name.
         */
        val R_DIRECTIVE: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_R_DIRECTIVE", DLHC.KEYWORD)

        /** Event prefix (`@`). Annotator-painted from Plan 04. */
        val EVENT_AT: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_EVENT_AT", DLHC.METADATA)

        /** Prop-binding name (e.g. `:disabled`, `:value`). Annotator-painted from Plan 04. */
        val PROP_BINDING_NAME: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_PROP_BINDING_NAME", DLHC.STATIC_FIELD)

        /** Slot-fill marker (`#` in `<template #slotName>`). Annotator-painted from Plan 04. */
        val SLOT_FILL_MARKER: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_SLOT_FILL_MARKER", DLHC.METADATA)

        /** Component reference (PascalCase tag name inside template). Annotator-painted from Plan 04. */
        val COMPONENT_REF: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_COMPONENT_REF", DLHC.CLASS_NAME)

        /** `ref` attribute (`ref="root"`). Annotator-painted from Plan 04. */
        val REF_ATTR: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_REF_ATTR", DLHC.STATIC_FIELD)

        /** Magic identifier (`$props`, `$data`, ...). RozieJsAnnotator-painted from Plan 04. */
        val MAGIC_IDENT: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_MAGIC_IDENT", DLHC.PREDEFINED_SYMBOL)

        val LANG_ATTR: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_LANG_ATTR", DLHC.METADATA)
        val HTML_COMMENT: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey("ROZIE_HTML_COMMENT", DLHC.LINE_COMMENT)
        val BAD_CHARACTER: TextAttributesKey =
            TextAttributesKey.createTextAttributesKey(
                "ROZIE_BAD_CHARACTER",
                DLHC.INVALID_STRING_ESCAPE
            )

        // Pre-allocated arrays returned by getTokenHighlights — avoid allocating per call.
        private val BLOCK_TAG_KEYS = arrayOf(BLOCK_TAG)
        private val LANG_KEYS = arrayOf(LANG_ATTR)
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
        RozieTokenTypes.COMPONENTS_BLOCK_TAG, RozieTokenTypes.STYLE_BLOCK_TAG,
        RozieTokenTypes.ROZIE_CLOSE_TAG, RozieTokenTypes.TEMPLATE_CLOSE_TAG,
        RozieTokenTypes.SCRIPT_CLOSE_TAG, RozieTokenTypes.PROPS_CLOSE_TAG,
        RozieTokenTypes.DATA_CLOSE_TAG, RozieTokenTypes.LISTENERS_CLOSE_TAG,
        RozieTokenTypes.COMPONENTS_CLOSE_TAG, RozieTokenTypes.STYLE_CLOSE_TAG -> BLOCK_TAG_KEYS

        // Lang attribute
        RozieTokenTypes.LANG_ATTR_NAME, RozieTokenTypes.LANG_ATTR_VALUE -> LANG_KEYS

        // HTML comments
        RozieTokenTypes.HTML_COMMENT_OPEN, RozieTokenTypes.HTML_COMMENT_CONTENT,
        RozieTokenTypes.HTML_COMMENT_CLOSE -> HTML_COMMENT_KEYS

        // Errors
        RozieTokenTypes.BAD_CHARACTER -> BAD_KEYS

        // ATTR_NAME (block-tag attr names like `name`, `scoped`), body tokens, EQ,
        // GT, LT_SLASH, ATTR_VALUE_PLAIN, WHITE_SPACE — leave uncolored. Template-
        // body attribute names render via HTML injection; the few block-tag attr
        // names render adequately via default highlighting.
        else -> EMPTY_KEYS
    }
}
