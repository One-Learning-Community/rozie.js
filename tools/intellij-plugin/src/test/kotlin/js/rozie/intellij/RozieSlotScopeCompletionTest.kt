package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.completion.RozieProducerSurface

/**
 * Contract test for
 * [js.rozie.intellij.completion.RozieSlotScopeCompletionContributor]: a slot-fill
 * scope binding (`<template #header="{ <caret> }">`) surfaces the scope props the
 * producer's matching `<slot name="header" :close :title>` exposes.
 *
 * JUnit-3 convention: every test method MUST start with `test`.
 */
class RozieSlotScopeCompletionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/completion"

    fun testSlotPropsExtractionDirect() {
        myFixture.configureByFiles("slot-scope-consumer.rozie", "slot-producer.rozie")
        val host = com.intellij.lang.injection.InjectedLanguageManager.getInstance(project)
            .getTopLevelFile(myFixture.file)
        assertEquals(
            "named slot scope props",
            listOf("close", "title"),
            RozieProducerSurface.slotProps(host, "Panel", "header"),
        )
        assertEquals(
            "default slot scope props",
            listOf("item", "index"),
            RozieProducerSurface.slotProps(host, "Panel", "default"),
        )
    }

    fun testNamedSlotScopeCompletion() {
        myFixture.configureByFiles("slot-scope-consumer.rozie", "slot-producer.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue("Expected `close` from producer header slot; got: $lookups", "close" in lookups)
        assertTrue("Expected `title` from producer header slot; got: $lookups", "title" in lookups)
        // The default slot's props must not leak into the named-slot scope.
        assertFalse("`item` belongs to the default slot; got: $lookups", "item" in lookups)
    }

    fun testDefaultSlotScopeCompletion() {
        myFixture.configureByFiles("slot-scope-default-consumer.rozie", "slot-producer.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue("Expected `item` from producer default slot; got: $lookups", "item" in lookups)
        assertTrue("Expected `index` from producer default slot; got: $lookups", "index" in lookups)
        assertFalse("`close` belongs to the header slot; got: $lookups", "close" in lookups)
    }
}
