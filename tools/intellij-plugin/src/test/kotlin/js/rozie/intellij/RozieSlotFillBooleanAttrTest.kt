package js.rozie.intellij

import com.intellij.codeInspection.htmlInspections.HtmlUnknownBooleanAttributeInspection
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * A value-less slot-fill shorthand (`<template #header>`) must NOT be flagged by
 * the "Incorrect boolean attribute" inspection (HtmlUnknownBooleanAttribute) —
 * `#`-prefixed slot attributes are intentionally value-less, like `r-else`.
 * Regression guard for the round-2 GUI finding ("#header requires value").
 *
 * The inspection is NOT in the fixture default profile, so it must be enabled
 * explicitly to reproduce what the GUI shows.
 */
class RozieSlotFillBooleanAttrTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/completion"

    fun testSlotFillShorthandNotFlaggedAsIncorrectBooleanAttribute() {
        myFixture.enableInspections(HtmlUnknownBooleanAttributeInspection())
        myFixture.configureByFile("slot-fill-boolean-attr.rozie")
        val complaints = myFixture.doHighlighting()
            .filter { it.severity.myVal >= HighlightSeverity.WARNING.myVal }
            .filter { (it.description ?: "").contains("#header") || (it.description ?: "").contains("#footer") }
        assertTrue(
            "Slot-fill shorthand flagged as incorrect boolean attribute: " +
                complaints.map { it.description },
            complaints.isEmpty(),
        )
    }
}
