package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.completion.RozieProducerSurface
import js.rozie.intellij.xml.RozieComponentRegistry

/**
 * Contract test for
 * [js.rozie.intellij.completion.RozieComponentAttributeCompletionContributor]:
 * typing `:` / `@` / `#` on a composed-component tag (`<Modal …>`) inside a
 * consumer `.rozie` `<template>` surfaces the PRODUCER's real props / emits /
 * slots — resolved by following the consumer's `<components>` import path to the
 * sibling producer file — rather than only the stock HTML DOM defaults.
 *
 * This is the IntelliJ-side analog of the LSP cross-file component-attribute
 * completion VS Code gets; it must be native because LSP4IJ completion does not
 * reach carets inside injected HTML fragments.
 *
 * Each test loads a two-file fixture (consumer + producer, same dir so the
 * `./xfile-producer.rozie` relative import resolves). JUnit-3 convention: every
 * test method MUST start with `test`.
 */
class RozieComponentAttributeCompletionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/completion"

    fun testExtractTopLevelEntriesPure() {
        val body = "{\n  Modal: './xfile-producer.rozie',\n}"
        assertEquals(mapOf("Modal" to "./xfile-producer.rozie"), RozieComponentRegistry.extractTopLevelEntries(body))
    }

    fun testProducerSurfaceResolvesDirectly() {
        myFixture.configureByFiles("xfile-consumer-prop.rozie", "xfile-producer.rozie")
        val host = com.intellij.lang.injection.InjectedLanguageManager.getInstance(project)
            .getTopLevelFile(myFixture.file)
        assertEquals("host file type", "Rozie", host.fileType.name)
        assertEquals("declaredComponents keys", setOf("Modal"), RozieComponentRegistry.declaredComponents(host))
        val imports = RozieComponentRegistry.declaredComponentImports(host)
        assertEquals("imports: $imports", "./xfile-producer.rozie", imports["Modal"])
        val surface = RozieProducerSurface.forComponent(host, "Modal")
        assertNotNull("Producer surface should resolve", surface)
        assertEquals("props", listOf("title", "open"), surface!!.props)
        assertEquals("events", listOf("close", "confirm"), surface.events)
        assertEquals("slots", listOf("header", "footer", "sidebar"), surface.slots)
    }

    fun testColonSurfacesProducerProps() {
        myFixture.configureByFiles("xfile-consumer-prop.rozie", "xfile-producer.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue("Expected `:title` from producer <props>; got: $lookups", ":title" in lookups)
        assertTrue("Expected `:open` from producer <props>; got: $lookups", ":open" in lookups)
        // An emit is not a prop.
        assertFalse("`:close` is an emit, not a prop; got: $lookups", ":close" in lookups)
        // Nested descriptor keys must not leak as props.
        assertFalse("`:type` is a nested descriptor key; got: $lookups", ":type" in lookups)
        assertFalse("`:default` is a nested descriptor key; got: $lookups", ":default" in lookups)
    }

    fun testAtSurfacesProducerEmits() {
        myFixture.configureByFiles("xfile-consumer-event.rozie", "xfile-producer.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue("Expected `@close` from producer emit; got: $lookups", "@close" in lookups)
        assertTrue("Expected `@confirm` from producer emit; got: $lookups", "@confirm" in lookups)
        // A prop is not an emit.
        assertFalse("`@title` is a prop, not an emit; got: $lookups", "@title" in lookups)
    }

    fun testHashSurfacesProducerSlots() {
        myFixture.configureByFiles("xfile-consumer-slot.rozie", "xfile-producer.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        // `#sidebar` is NOT in the static SLOT_FILL_HINTS — it can only come from
        // the producer's `<slot name="sidebar">`, proving cross-file resolution.
        assertTrue("Expected `#sidebar` from producer <slot name>; got: $lookups", "#sidebar" in lookups)
        assertTrue("Expected `#header` from producer <slot name>; got: $lookups", "#header" in lookups)
        assertFalse("`#title` is a prop, not a slot; got: $lookups", "#title" in lookups)
    }

    /** Producer members must NOT bleed onto stock lowercase DOM tags. */
    fun testLowercaseTagDoesNotSurfaceProducerProps() {
        myFixture.configureByFiles("xfile-consumer-div.rozie", "xfile-producer.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertFalse("Producer `:title` must not appear on a <div>; got: $lookups", ":title" in lookups)
        assertFalse("Producer `:open` must not appear on a <div>; got: $lookups", ":open" in lookups)
    }
}
