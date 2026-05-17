package js.rozie.intellij

import com.intellij.psi.tree.IElementType
import js.rozie.intellij.highlighting.RozieSyntaxHighlighter
import js.rozie.intellij.lexer.RozieTokenTypes
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Smoke regression guard for the post-pivot syntax-highlighter mapping.
 *
 * Asserts that every host-lexer-emitted IElementType the highlighter is
 * supposed to colour returns a non-empty `TextAttributesKey[]` from
 * [RozieSyntaxHighlighter.getTokenHighlights] — preventing silent regressions
 * where a token is left unmapped (and would render uncolored) after a
 * future refactor.
 *
 * **Body / generic structural tokens** (e.g., `SCRIPT_BODY`, `TEMPLATE_BODY`,
 * `EQ`, `GT`, `WHITE_SPACE`, `ATTR_VALUE_PLAIN`, `ATTR_NAME`, `LT_SLASH`)
 * are intentionally allowed to fall through to `else -> emptyArray()` —
 * RozieMultiHostInjector / RozieAnnotator colour them via the host language
 * injection / Annotator pass. This test **excludes** them from the must-be-
 * coloured set so it remains a forward-compatible guard rather than a
 * brittle fixture.
 *
 * Plain JUnit 4 (no `BasePlatformTestCase`) is sufficient: the highlighter
 * neither parses files nor touches PSI; `TextAttributesKey.createTextAttributesKey`
 * works without an IDE instance, and `getTokenHighlights` is pure dispatch.
 */
class RozieSyntaxHighlighterTest {

    /**
     * Every IElementType the post-pivot highlighter MUST colour (block-tag
     * boundaries, lang attr, HTML comment, bad character).
     *
     * Template-level Rozie sigils (`r-*`, `@`, `:`, `#`, `<Component>`,
     * `$magic`) are NOT in this list because the host lexer no longer emits
     * them as distinct tokens — they're recognised inside the HTMLLanguage-
     * injected PSI by RozieAnnotator (Plan 04).
     */
    private val mustBeColored: List<Pair<String, IElementType>> = listOf(
        // Block open tags
        "ROZIE_BLOCK_TAG" to RozieTokenTypes.ROZIE_BLOCK_TAG,
        "TEMPLATE_BLOCK_TAG" to RozieTokenTypes.TEMPLATE_BLOCK_TAG,
        "SCRIPT_BLOCK_TAG" to RozieTokenTypes.SCRIPT_BLOCK_TAG,
        "PROPS_BLOCK_TAG" to RozieTokenTypes.PROPS_BLOCK_TAG,
        "DATA_BLOCK_TAG" to RozieTokenTypes.DATA_BLOCK_TAG,
        "LISTENERS_BLOCK_TAG" to RozieTokenTypes.LISTENERS_BLOCK_TAG,
        "COMPONENTS_BLOCK_TAG" to RozieTokenTypes.COMPONENTS_BLOCK_TAG,
        "STYLE_BLOCK_TAG" to RozieTokenTypes.STYLE_BLOCK_TAG,
        // Block close tags
        "ROZIE_CLOSE_TAG" to RozieTokenTypes.ROZIE_CLOSE_TAG,
        "TEMPLATE_CLOSE_TAG" to RozieTokenTypes.TEMPLATE_CLOSE_TAG,
        "SCRIPT_CLOSE_TAG" to RozieTokenTypes.SCRIPT_CLOSE_TAG,
        "PROPS_CLOSE_TAG" to RozieTokenTypes.PROPS_CLOSE_TAG,
        "DATA_CLOSE_TAG" to RozieTokenTypes.DATA_CLOSE_TAG,
        "LISTENERS_CLOSE_TAG" to RozieTokenTypes.LISTENERS_CLOSE_TAG,
        "COMPONENTS_CLOSE_TAG" to RozieTokenTypes.COMPONENTS_CLOSE_TAG,
        "STYLE_CLOSE_TAG" to RozieTokenTypes.STYLE_CLOSE_TAG,
        // Lang attribute
        "LANG_ATTR_NAME" to RozieTokenTypes.LANG_ATTR_NAME,
        "LANG_ATTR_VALUE" to RozieTokenTypes.LANG_ATTR_VALUE,
        // HTML comments
        "HTML_COMMENT_OPEN" to RozieTokenTypes.HTML_COMMENT_OPEN,
        "HTML_COMMENT_CONTENT" to RozieTokenTypes.HTML_COMMENT_CONTENT,
        "HTML_COMMENT_CLOSE" to RozieTokenTypes.HTML_COMMENT_CLOSE,
        // Errors
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
            "Highlighter dropped these Rozie tokens to empty mappings: $unmapped",
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
        // decision, never an accident. Includes the Annotator-paint-target
        // constants kept on the companion (R_DIRECTIVE / EVENT_AT / etc.)
        // because they participate in the same STABLE-API contract.
        val keys = listOf(
            RozieSyntaxHighlighter.BLOCK_TAG,
            RozieSyntaxHighlighter.R_DIRECTIVE,
            RozieSyntaxHighlighter.EVENT_AT,
            RozieSyntaxHighlighter.PROP_BINDING_NAME,
            RozieSyntaxHighlighter.SLOT_FILL_MARKER,
            RozieSyntaxHighlighter.COMPONENT_REF,
            RozieSyntaxHighlighter.REF_ATTR,
            RozieSyntaxHighlighter.MAGIC_IDENT,
            RozieSyntaxHighlighter.LANG_ATTR,
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
