package js.rozie.intellij

import com.intellij.lang.LanguageCommenters
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.editor.RozieCommenter

/**
 * Contract + registration test for [RozieCommenter]. Asserts the platform
 * resolves the Rozie-language commenter to our class (so the comment actions
 * fire on host SFC positions) and that it exposes the HTML-shaped block-comment
 * pair with no line-comment form.
 *
 * The commenter's prefixes/suffixes are asserted directly rather than through
 * the comment editor action — block-comment edge spacing is governed by
 * per-IDE code-style settings (`BLOCK_COMMENT_ADD_SPACE`) and would make an
 * action-level assertion brittle across the 2024.2.5 / 2025.3 platform legs.
 *
 * JUnit-3 convention: every test method starts with `test`.
 */
class RozieCommenterTest : BasePlatformTestCase() {

    fun testRozieLanguageResolvesToRozieCommenter() {
        val commenter = LanguageCommenters.INSTANCE.forLanguage(RozieLanguage)
        assertNotNull(
            "No commenter registered for language=Rozie — the lang.commenter EP " +
                "registration in plugin.xml is missing or the language id mismatches.",
            commenter,
        )
        assertTrue(
            "Expected RozieCommenter, got ${commenter?.javaClass?.name}.",
            commenter is RozieCommenter,
        )
    }

    fun testCommenterContract() {
        val commenter = RozieCommenter()
        // HTML/XML structural level — no line comment, HTML block-comment pair.
        assertNull(
            "Rozie host has no line-comment syntax; the line-comment action must " +
                "fall back to the block-comment form.",
            commenter.lineCommentPrefix,
        )
        assertEquals("<!--", commenter.blockCommentPrefix)
        assertEquals("-->", commenter.blockCommentSuffix)
        assertEquals("<!--", commenter.commentedBlockCommentPrefix)
        assertEquals("-->", commenter.commentedBlockCommentSuffix)
    }
}
