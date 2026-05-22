package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.inspection.RozieTemplateAttributeInspection

/**
 * Contract test for [js.rozie.intellij.inspection.RozieTemplateAttributeInspection]:
 * a typo'd `r-*` directive or `.modifier` chain segment inside a `.rozie`
 * `<template>` is flagged with a warning; a well-spelled template is clean;
 * the "did you mean" rename quick-fix corrects the attribute.
 *
 * Warnings raised inside the HTML-injected `<template>` fragment surface in
 * `doHighlighting()` on the host file (the same channel the inspection
 * suppressor tests exercise), so the assertions filter that list by the
 * inspection's own message prefix.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RozieAttributeInspectionTest : BasePlatformTestCase() {

    // === Behavior 1: an unknown r-* directive is flagged ===

    fun testUnknownDirectiveIsFlagged() {
        configureRozie("  <div r-fi=\"x\"></div>")
        myFixture.enableInspections(RozieTemplateAttributeInspection())
        val warnings = rozieWarnings()
        assertTrue(
            "Expected an 'Unknown Rozie directive' warning for `r-fi`; got: $warnings",
            warnings.any { it.contains("Unknown Rozie directive 'r-fi'") },
        )
    }

    // === Behavior 2: an unknown event modifier is flagged ===

    fun testUnknownModifierIsFlagged() {
        configureRozie("  <button @click.stpo=\"y\"></button>")
        myFixture.enableInspections(RozieTemplateAttributeInspection())
        val warnings = rozieWarnings()
        assertTrue(
            "Expected an 'Unknown Rozie modifier' warning for `stpo`; got: $warnings",
            warnings.any { it.contains("Unknown Rozie modifier 'stpo'") },
        )
    }

    // === Behavior 3: a well-spelled template raises no Rozie warnings ===

    fun testValidTemplateHasNoWarnings() {
        configureRozie("  <button r-if=\"ok\" @click.stop=\"go()\"></button>")
        myFixture.enableInspections(RozieTemplateAttributeInspection())
        val warnings = rozieWarnings()
        assertTrue(
            "A valid r-if / @click.stop template must raise no Rozie warnings; got: $warnings",
            warnings.isEmpty(),
        )
    }

    // === Behavior 4: the rename quick-fix corrects a typo'd directive ===
    //
    // The caret sits inside the typo'd directive so `findSingleIntention`
    // resolves the fix against live PSI at apply time (a file-wide
    // `getAllQuickFixes()` sweep hands back a wrapper whose injected-PSI
    // descriptor has gone stale by launch time).

    fun testQuickFixCorrectsDirective() {
        myFixture.configureByText(
            "Inspect.rozie",
            "<rozie name=\"Inspect\">\n<template>\n  <div r-f<caret>i=\"x\"></div>\n</template>\n</rozie>",
        )
        myFixture.enableInspections(RozieTemplateAttributeInspection())
        val intention = myFixture.findSingleIntention("Change to 'r-if'")
        myFixture.launchAction(intention)
        assertTrue(
            "After the quick-fix the attribute should read `r-if`; got:\n${myFixture.file.text}",
            "r-if=\"x\"" in myFixture.file.text,
        )
    }

    // === Helpers ===

    /** Configure a `.rozie` file whose `<template>` body is [templateLine]. */
    private fun configureRozie(templateLine: String) {
        myFixture.configureByText(
            "Inspect.rozie",
            "<rozie name=\"Inspect\">\n<template>\n$templateLine\n</template>\n</rozie>",
        )
    }

    /** Descriptions of every `doHighlighting()` info raised by this inspection. */
    private fun rozieWarnings(): List<String> =
        myFixture.doHighlighting()
            .mapNotNull { it.description }
            .filter { it.startsWith("Unknown Rozie ") }
}
