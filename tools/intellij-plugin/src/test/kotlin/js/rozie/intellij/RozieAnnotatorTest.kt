package js.rozie.intellij

import com.intellij.codeInsight.daemon.impl.HighlightInfo
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * SC-4 contract test for [js.rozie.intellij.highlighting.RozieAnnotator] (HTML
 * sigils + PascalCase component tags) and
 * [js.rozie.intellij.highlighting.RozieJsAnnotator] (JS magic identifiers).
 *
 * Each test method drives the standard highlighting pipeline via
 * `myFixture.doHighlighting()` and filters for INFORMATION-severity
 * [HighlightInfo]s whose `forcedTextAttributesKey.externalName` matches one of
 * the `ROZIE_*` external names that Annotators paint with. The polarity inverts
 * the existing [RozieInjectionTest.testHtmlInspectionsDoNotFlagRozieAttributes]
 * pattern (which asserts NO matching highlights exist) — here we assert at
 * least one INFORMATION highlight covers each expected range with the expected
 * `TextAttributesKey`.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RozieAnnotatorTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/annotator"

    // === Behavior 1: HTML sigil attributes painted by RozieAnnotator ===

    fun testHtmlSigilsArePaintedByAnnotator() {
        myFixture.configureByFile("annotator-html-sigils.rozie")
        val rozieHighlights = findRozieHighlights()

        assertHighlightCoversRange(rozieHighlights, "r-if", "ROZIE_R_DIRECTIVE")
        assertHighlightCoversRange(rozieHighlights, "@click", "ROZIE_EVENT_AT")
        assertHighlightCoversRange(rozieHighlights, ":disabled", "ROZIE_PROP_BINDING_NAME")
        // The "#header" attribute is the slot-fill marker on `<template #header>`.
        assertHighlightCoversRange(rozieHighlights, "#header", "ROZIE_SLOT_FILL_MARKER")
        // Anchor on `ref="` to land on the attribute-name occurrence (not the word
        // "ref" anywhere else in the file).
        assertHighlightCoversRange(rozieHighlights, "ref=", "ROZIE_REF_ATTR")
    }

    // === Behavior 2: PascalCase tag names painted with COMPONENT_REF ===

    fun testPascalCaseTagIsPaintedByAnnotator() {
        myFixture.configureByFile("annotator-component-tag.rozie")
        val rozieHighlights = findRozieHighlights()

        // <Modal …> open-tag: anchor inside the name token by skipping the '<'.
        assertHighlightCoversRange(rozieHighlights, "Modal ", "ROZIE_COMPONENT_REF")
        // <Counter … /> self-closing tag.
        assertHighlightCoversRange(rozieHighlights, "Counter ", "ROZIE_COMPONENT_REF")
    }

    // === Behavior 2b (Plan 08.2-10 P1-UAT-03 regression): PascalCase coloring on
    // open-tag + close-tag + self-closing variants across reference-example shapes ===

    /**
     * Regression: Card.rozie-shaped fixture with `<Card class="outer"> ... </Card>`
     * wrapping a self-closing `<CardHeader />`. The pre-fix RozieAnnotator failed to
     * paint at least one of these three name occurrences. Asserts ALL three are
     * painted with ROZIE_COMPONENT_REF.
     *
     * Anchor strategy:
     *   - "Card class" -> offset of 'C' inside the OPEN-tag name token
     *   - "Card>"      -> offset of 'C' inside the CLOSE-tag name token (`</Card>`)
     *   - "CardHeader " (trailing space) -> 'C' inside the SELF-CLOSING tag name
     */
    fun testCardPascalColoringOpenCloseAndSelfClosing() {
        myFixture.configureByFile("annotator-card-pascal-coloring.rozie")
        val rozieHighlights = findRozieHighlights()

        assertHighlightCoversRange(rozieHighlights, "Card class", "ROZIE_COMPONENT_REF")
        assertHighlightCoversRange(rozieHighlights, "Card>", "ROZIE_COMPONENT_REF")
        assertHighlightCoversRange(rozieHighlights, "CardHeader ", "ROZIE_COMPONENT_REF")
    }

    /**
     * Regression: ModalConsumer.rozie-shaped fixture exercising two distinct
     * PascalCase components (`<Modal>` and `<WrapperModal>`) declared in the same
     * `<components>` block. Asserts both open-tag name occurrences paint.
     */
    fun testModalConsumerLocalComponentsPaintBothOpenTags() {
        myFixture.configureByFile("annotator-modalconsumer-local-components.rozie")
        val rozieHighlights = findRozieHighlights()

        assertHighlightCoversRange(rozieHighlights, "Modal>", "ROZIE_COMPONENT_REF")
        assertHighlightCoversRange(rozieHighlights, "WrapperModal>", "ROZIE_COMPONENT_REF")
    }

    /**
     * Regression: deeply-nested PascalCase tags — Card wraps CardHeader wraps
     * SomeChild. Each tag-name token MUST be painted independently; the
     * pre-fix single-XmlToken walk would only catch the outermost.
     *
     * Anchor uniqueness:
     *   - "Card>" only appears in `</Card>` (open-tag uses `<Card>` without space-before-gt)
     *   - "CardHeader>" only in `</CardHeader>`
     *   - "SomeChild " (trailing space, before `/>`) only in `<SomeChild />`
     */
    fun testNestedPascalTagsAllPainted() {
        myFixture.configureByFile("annotator-nested-pascal-tags.rozie")
        val rozieHighlights = findRozieHighlights()

        // Open tags (anchor on name + first attribute / `>` position)
        assertHighlightCoversRange(rozieHighlights, "Card>\n  <CardHeader", "ROZIE_COMPONENT_REF")
        assertHighlightCoversRange(rozieHighlights, "CardHeader>\n    <SomeChild", "ROZIE_COMPONENT_REF")
        // Self-closing
        assertHighlightCoversRange(rozieHighlights, "SomeChild ", "ROZIE_COMPONENT_REF")
    }

    // === Behavior 3: JS magic identifiers painted by RozieJsAnnotator ===

    fun testJsMagicIdentsArePaintedByJsAnnotator() {
        myFixture.configureByFile("annotator-js-magic-idents.rozie")
        val rozieHighlights = findRozieHighlights()

        assertHighlightCoversRange(rozieHighlights, "\$props", "ROZIE_MAGIC_IDENT")
        assertHighlightCoversRange(rozieHighlights, "\$data", "ROZIE_MAGIC_IDENT")
        assertHighlightCoversRange(rozieHighlights, "\$refs", "ROZIE_MAGIC_IDENT")
        assertHighlightCoversRange(rozieHighlights, "\$onMount", "ROZIE_MAGIC_IDENT")
        assertHighlightCoversRange(rozieHighlights, "\$computed", "ROZIE_MAGIC_IDENT")
        // Constructs added in grammar v0.2.0 — $onUnmount lifecycle hook,
        // $el root-element handle, $classSelector helper (Phase 13), and the
        // $portals slot primitive (Spike 003).
        assertHighlightCoversRange(rozieHighlights, "\$onUnmount", "ROZIE_MAGIC_IDENT")
        assertHighlightCoversRange(rozieHighlights, "\$el", "ROZIE_MAGIC_IDENT")
        assertHighlightCoversRange(rozieHighlights, "\$classSelector", "ROZIE_MAGIC_IDENT")
        assertHighlightCoversRange(rozieHighlights, "\$portals", "ROZIE_MAGIC_IDENT")
    }

    // === Helpers ===

    /**
     * Runs `myFixture.doHighlighting()` and filters for INFORMATION-severity
     * [HighlightInfo]s whose [HighlightInfo.forcedTextAttributesKey]'s
     * `externalName` starts with `"ROZIE_"`. This is the canonical way to scope
     * the assertion to highlights painted by our own Annotators (which use
     * `holder.newSilentAnnotation(HighlightSeverity.INFORMATION).textAttributes(KEY)`).
     */
    private fun findRozieHighlights(): List<HighlightInfo> {
        val all = myFixture.doHighlighting()
        return all.filter { info ->
            info.severity == HighlightSeverity.INFORMATION &&
                info.forcedTextAttributesKey?.externalName?.startsWith("ROZIE_") == true
        }
    }

    /**
     * Asserts that at least one Rozie [HighlightInfo] in [highlights] covers the
     * offset of [anchorSubstring]'s FIRST occurrence in the test file's host
     * text AND that the highlight's `forcedTextAttributesKey.externalName`
     * equals [expectedExternalName]. Range containment is asserted as
     * `[startOffset, endOffset)` containing `offset` (the start of the anchor).
     */
    private fun assertHighlightCoversRange(
        highlights: List<HighlightInfo>,
        anchorSubstring: String,
        expectedExternalName: String,
    ) {
        val text = myFixture.file.text
        val offset = text.indexOf(anchorSubstring)
        check(offset >= 0) {
            "Anchor '$anchorSubstring' not found in fixture text"
        }
        val match = highlights.firstOrNull { info ->
            info.forcedTextAttributesKey?.externalName == expectedExternalName &&
                offset >= info.startOffset && offset < info.endOffset
        }
        assertNotNull(
            "Expected a Rozie INFORMATION highlight with key '$expectedExternalName' " +
                "covering offset $offset (anchor='$anchorSubstring') in fixture text; " +
                "rozie highlights present: " +
                highlights.map {
                    Triple(
                        it.forcedTextAttributesKey?.externalName,
                        it.startOffset,
                        it.endOffset,
                    )
                },
            match,
        )
    }
}
