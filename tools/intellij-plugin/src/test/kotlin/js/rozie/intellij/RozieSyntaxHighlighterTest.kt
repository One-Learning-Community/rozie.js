package js.rozie.intellij

import com.intellij.psi.tree.IElementType
import js.rozie.intellij.highlighting.RozieSyntaxHighlighter
import js.rozie.intellij.lexer.RozieTokenTypes
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Smoke regression guard for the syntax-highlighter mapping (Plan 03).
 *
 * Asserts that every Rozie-specific [IElementType] declared on
 * [RozieTokenTypes] returns a non-empty `TextAttributesKey[]` from
 * [RozieSyntaxHighlighter.getTokenHighlights] — preventing silent regressions
 * where a token is left unmapped (and would render uncolored) after a
 * future refactor.
 *
 * **Body / generic structural tokens** (e.g., `SCRIPT_BODY`, `TEMPLATE_BODY`,
 * `EQ`, `GT`, `WHITE_SPACE`, `ATTR_VALUE_*`, `MUSTACHE_BODY`, `MODIFIER_ARGS`)
 * are intentionally allowed to fall through to `else -> emptyArray()` —
 * Plan 04 will color them via the host language injection. This test
 * **excludes** them from the must-be-colored set so it remains a forward-
 * compatible guard rather than a brittle fixture.
 *
 * Plain JUnit 4 (no `BasePlatformTestCase`) is sufficient: the highlighter
 * neither parses files nor touches PSI; `TextAttributesKey.createTextAttributesKey`
 * works without an IDE instance, and `getTokenHighlights` is pure dispatch.
 */
class RozieSyntaxHighlighterTest {

    /**
     * Every Rozie-specific IElementType the highlighter MUST color
     * (i.e., the ones with their own `TextAttributesKey` in
     * [RozieSyntaxHighlighter]'s companion object).
     *
     * Adding a new colored token to RozieSyntaxHighlighter without adding it
     * here is fine — the test only complains if a token in this list is
     * silently dropped to `emptyArray()` by a future refactor.
     */
    private val mustBeColored: List<Pair<String, IElementType>> = listOf(
        // Block open tags
        "ROZIE_BLOCK_TAG" to RozieTokenTypes.ROZIE_BLOCK_TAG,
        "TEMPLATE_BLOCK_TAG" to RozieTokenTypes.TEMPLATE_BLOCK_TAG,
        "SCRIPT_BLOCK_TAG" to RozieTokenTypes.SCRIPT_BLOCK_TAG,
        "PROPS_BLOCK_TAG" to RozieTokenTypes.PROPS_BLOCK_TAG,
        "DATA_BLOCK_TAG" to RozieTokenTypes.DATA_BLOCK_TAG,
        "LISTENERS_BLOCK_TAG" to RozieTokenTypes.LISTENERS_BLOCK_TAG,
        "STYLE_BLOCK_TAG" to RozieTokenTypes.STYLE_BLOCK_TAG,
        // Block close tags
        "ROZIE_CLOSE_TAG" to RozieTokenTypes.ROZIE_CLOSE_TAG,
        "TEMPLATE_CLOSE_TAG" to RozieTokenTypes.TEMPLATE_CLOSE_TAG,
        "SCRIPT_CLOSE_TAG" to RozieTokenTypes.SCRIPT_CLOSE_TAG,
        "PROPS_CLOSE_TAG" to RozieTokenTypes.PROPS_CLOSE_TAG,
        "DATA_CLOSE_TAG" to RozieTokenTypes.DATA_CLOSE_TAG,
        "LISTENERS_CLOSE_TAG" to RozieTokenTypes.LISTENERS_CLOSE_TAG,
        "STYLE_CLOSE_TAG" to RozieTokenTypes.STYLE_CLOSE_TAG,
        // Template-level Rozie tokens
        "R_DIRECTIVE" to RozieTokenTypes.R_DIRECTIVE,
        "EVENT_AT" to RozieTokenTypes.EVENT_AT,
        "EVENT_NAME" to RozieTokenTypes.EVENT_NAME,
        "MODIFIER_DOT" to RozieTokenTypes.MODIFIER_DOT,
        "MODIFIER_NAME" to RozieTokenTypes.MODIFIER_NAME,
        "MODIFIER_LPAREN" to RozieTokenTypes.MODIFIER_LPAREN,
        "MODIFIER_RPAREN" to RozieTokenTypes.MODIFIER_RPAREN,
        "PROP_COLON" to RozieTokenTypes.PROP_COLON,
        "PROP_NAME" to RozieTokenTypes.PROP_NAME,
        "MUSTACHE_OPEN" to RozieTokenTypes.MUSTACHE_OPEN,
        "MUSTACHE_CLOSE" to RozieTokenTypes.MUSTACHE_CLOSE,
        "MAGIC_IDENT" to RozieTokenTypes.MAGIC_IDENT,
        "REF_ATTR_NAME" to RozieTokenTypes.REF_ATTR_NAME,
        "LANG_ATTR_NAME" to RozieTokenTypes.LANG_ATTR_NAME,
        "LANG_ATTR_VALUE" to RozieTokenTypes.LANG_ATTR_VALUE,
        "ATTR_NAME" to RozieTokenTypes.ATTR_NAME,
        "HTML_COMMENT_OPEN" to RozieTokenTypes.HTML_COMMENT_OPEN,
        "HTML_COMMENT_CONTENT" to RozieTokenTypes.HTML_COMMENT_CONTENT,
        "HTML_COMMENT_CLOSE" to RozieTokenTypes.HTML_COMMENT_CLOSE,
        "BAD_CHARACTER" to RozieTokenTypes.BAD_CHARACTER
    )

    @Test
    fun `every Rozie-specific IElementType maps to a non-empty TextAttributesKey array`() {
        val highlighter = RozieSyntaxHighlighter()
        val unmapped = mutableListOf<String>()
        for ((name, token) in mustBeColored) {
            val keys = highlighter.getTokenHighlights(token)
            assertNotNull("getTokenHighlights returned null for $name", keys)
            if (keys.isEmpty()) unmapped += name
        }
        assertTrue(
            "Highlighter dropped these Rozie tokens to empty mappings (Plan 03 regression): $unmapped",
            unmapped.isEmpty()
        )
    }

    @Test
    fun `getHighlightingLexer returns a fresh lexer instance`() {
        val highlighter = RozieSyntaxHighlighter()
        val a = highlighter.highlightingLexer
        val b = highlighter.highlightingLexer
        assertNotNull(a)
        assertNotNull(b)
        // Different instances per call — Pitfall 4 mitigation: each invocation
        // gets its own FlexAdapter so YYINITIAL is never leaked across files.
        assertTrue(
            "RozieSyntaxHighlighter.getHighlightingLexer must yield a fresh lexer per call",
            a !== b
        )
    }

    @Test
    fun `every TextAttributesKey has the stable ROZIE_ external name prefix`() {
        // T-8-03-01: external names are persisted user-customization keys —
        // any deviation from the ROZIE_ prefix should be a deliberate, reviewed
        // decision, never an accident.
        val keys = listOf(
            RozieSyntaxHighlighter.BLOCK_TAG,
            RozieSyntaxHighlighter.R_DIRECTIVE,
            RozieSyntaxHighlighter.EVENT_AT,
            RozieSyntaxHighlighter.EVENT_NAME,
            RozieSyntaxHighlighter.MODIFIER,
            RozieSyntaxHighlighter.MODIFIER_PUNCTUATION,
            RozieSyntaxHighlighter.PROP_BINDING_PUNCTUATION,
            RozieSyntaxHighlighter.PROP_BINDING_NAME,
            RozieSyntaxHighlighter.INTERPOLATION_DELIM,
            RozieSyntaxHighlighter.MAGIC_IDENT,
            RozieSyntaxHighlighter.REF_ATTR,
            RozieSyntaxHighlighter.LANG_ATTR,
            RozieSyntaxHighlighter.HTML_ATTR_NAME,
            RozieSyntaxHighlighter.HTML_COMMENT,
            RozieSyntaxHighlighter.BAD_CHARACTER
        )
        val violators = keys.map { it.externalName }.filterNot { it.startsWith("ROZIE_") }
        assertTrue(
            "TextAttributesKey external names must start with ROZIE_ (T-8-03-01 stability): $violators",
            violators.isEmpty()
        )
    }
}
