package js.rozie.intellij

import com.intellij.codeInsight.template.TemplateActionContext
import com.intellij.codeInsight.template.impl.TemplateSettings
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.editor.RozieTemplateContextType

/**
 * Tests for the Rozie live-template surface: the [RozieTemplateContextType]
 * gate and the bundled `liveTemplates/Rozie.xml` snippet set.
 *
 * JUnit-3 convention: every test method starts with `test`.
 */
class RozieLiveTemplateTest : BasePlatformTestCase() {

    fun testContextActiveInRozieFile() {
        myFixture.configureByText("x.rozie", "<rozie name=\"X\">\n<template></template>\n</rozie>")
        val ctx = TemplateActionContext.expanding(myFixture.file, 0)
        assertTrue(
            "RozieTemplateContextType must be in-context for a .rozie file so the " +
                "scaffolding snippets are offered.",
            RozieTemplateContextType().isInContext(ctx),
        )
    }

    fun testContextInactiveInNonRozieFile() {
        myFixture.configureByText("x.js", "const a = 1;")
        val ctx = TemplateActionContext.expanding(myFixture.file, 0)
        assertFalse(
            "RozieTemplateContextType must NOT activate in a plain .js file — the " +
                "snippet set must stay scoped to .rozie via RozieContextCheck.",
            RozieTemplateContextType().isInContext(ctx),
        )
    }

    fun testBundledTemplatesLoaded() {
        val settings = TemplateSettings.getInstance()
        val expected = listOf(
            "rcomponent", "rtemplate", "rscript", "rprops",
            "rdata", "rcomponents", "rlisteners", "rstyle",
        )
        for (key in expected) {
            assertNotNull(
                "Bundled live template `$key` (group Rozie) not loaded — check " +
                    "defaultLiveTemplates registration + liveTemplates/Rozie.xml.",
                settings.getTemplate(key, "Rozie"),
            )
        }
    }
}
