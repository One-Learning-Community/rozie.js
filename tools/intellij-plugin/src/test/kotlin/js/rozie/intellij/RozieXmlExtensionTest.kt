package js.rozie.intellij

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.openapi.extensions.ExtensionPointName
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.psi.xml.XmlTag
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import com.intellij.xml.XmlAttributeDescriptor
import com.intellij.xml.XmlAttributeDescriptorsProvider

/**
 * SC-3 contract test for [js.rozie.intellij.xml.RozieAttributeDescriptorsProvider]:
 * the provider returns a non-null [XmlAttributeDescriptor] for `r-*`, `@event`,
 * `:prop`, `#slot`, `ref` attribute names inside the HTML PSI injected into
 * `<template>` bodies of `.rozie` files; returns null for arbitrary names.
 *
 * Each fixture file is a minimal SFC anchoring one attribute under test. The
 * test helper walks into the HTML-injected PSI tree via
 * [InjectedLanguageManager.findInjectedElementAt] (post-Plan-01 the template
 * body is one contiguous TEMPLATE_BODY host token that HTMLLanguage injection
 * carves into an HTML PSI tree), grabs the enclosing [XmlTag], loads the
 * registered [RozieAttributeDescriptorsProvider] off the
 * [XmlAttributeDescriptorsProvider.EP_NAME] extension point, and asks for the
 * descriptor by name.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RozieXmlExtensionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/xml"

    // === Positive cases — descriptor non-null for every Rozie sigil flavor ===

    fun testRIfAttributeRecognised() {
        val descriptor = lookupAttributeDescriptor("r-if-recognised.rozie", "r-if")
        assertNotNull("r-if should have a non-null descriptor", descriptor)
        assertEquals("r-if", descriptor!!.name)
    }

    fun testRForAttributeRecognised() {
        val descriptor = lookupAttributeDescriptor("r-for-recognised.rozie", "r-for")
        assertNotNull("r-for should have a non-null descriptor", descriptor)
        assertEquals("r-for", descriptor!!.name)
    }

    fun testEventClickAttributeRecognised() {
        val descriptor = lookupAttributeDescriptor("event-click-recognised.rozie", "@click")
        assertNotNull("@click should have a non-null descriptor", descriptor)
        assertEquals("@click", descriptor!!.name)
    }

    fun testPropDisabledAttributeRecognised() {
        val descriptor = lookupAttributeDescriptor("prop-disabled-recognised.rozie", ":disabled")
        assertNotNull(":disabled should have a non-null descriptor", descriptor)
        assertEquals(":disabled", descriptor!!.name)
    }

    fun testSlotHeaderAttributeRecognised() {
        val descriptor = lookupAttributeDescriptor("slot-header-recognised.rozie", "#header")
        assertNotNull("#header should have a non-null descriptor", descriptor)
        assertEquals("#header", descriptor!!.name)
    }

    fun testRefAttributeRecognised() {
        val descriptor = lookupAttributeDescriptor("ref-recognised.rozie", "ref")
        assertNotNull("ref should have a non-null descriptor", descriptor)
        assertEquals("ref", descriptor!!.name)
    }

    // === Negative case — arbitrary attribute names return null ===

    fun testUnknownAttributeReturnsNull() {
        val descriptor = lookupAttributeDescriptor("unknown-attr-not-recognised.rozie", "foo")
        assertNull("foo should NOT have a descriptor (would mean ANY name resolves)", descriptor)
    }

    // === Helpers ===

    /**
     * Configures the IDE fixture with the given .rozie test data file, walks to
     * the offset of [attributeName] inside the host text, descends into the
     * HTML-injected PSI at that offset, finds the enclosing [XmlTag], then asks
     * the registered [RozieAttributeDescriptorsProvider] for the descriptor.
     *
     * Returns null if either the provider isn't registered (Task-1 RED state)
     * OR the provider returns null for the given name in this context.
     */
    private fun lookupAttributeDescriptor(
        fixtureFile: String,
        attributeName: String,
    ): XmlAttributeDescriptor? {
        myFixture.configureByFile(fixtureFile)
        val text = myFixture.file.text
        val offset = text.indexOf(attributeName)
        check(offset >= 0) { "Anchor '$attributeName' not found in $fixtureFile" }

        val ilm = InjectedLanguageManager.getInstance(project)
        val injectedElement = ilm.findInjectedElementAt(myFixture.file, offset)
        // Inside the HTML-injected fragment, walk up to the enclosing XmlTag.
        val tag: XmlTag? = injectedElement
            ?.let { PsiTreeUtil.getParentOfType(it, XmlTag::class.java, false) }

        // Load the Rozie provider off the platform extension point. EP_NAME is
        // the canonical way to enumerate all registered XmlAttributeDescriptors-
        // Provider extensions. We pick our own by simple-name match so this test
        // doesn't import the class directly (keeps the Task-1 RED state failing
        // with a "provider is null" message, which is a clearer signal than a
        // ClassNotFoundException would be when Task 3 hasn't run yet).
        val providers = EP_NAME.extensionList
        val provider = providers.firstOrNull { it.javaClass.simpleName == PROVIDER_SIMPLE_NAME }
            ?: return null
        return provider.getAttributeDescriptor(attributeName, tag)
    }

    companion object {
        private val EP_NAME: ExtensionPointName<XmlAttributeDescriptorsProvider> =
            ExtensionPointName.create("com.intellij.xml.attributeDescriptorsProvider")
        private const val PROVIDER_SIMPLE_NAME = "RozieAttributeDescriptorsProvider"
    }
}
