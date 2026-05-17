package js.rozie.intellij

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.openapi.extensions.ExtensionPointName
import com.intellij.psi.impl.source.xml.XmlElementDescriptorProvider
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.psi.xml.XmlTag
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import com.intellij.xml.XmlAttributeDescriptor
import com.intellij.xml.XmlAttributeDescriptorsProvider
import com.intellij.xml.XmlElementDescriptor

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

    // === SC-3 tag-side coverage — Plan 03 ===
    //
    // Mirrors the attribute-side pattern above for the PascalCase component-ref
    // recognition added by [js.rozie.intellij.xml.RozieComponentTagProvider]. The
    // provider implements BOTH `XmlTagNameProvider` AND `XmlElementDescriptorProvider`;
    // the descriptor side is what silences "Unknown HTML tag" inspections on
    // `<Modal>`, `<Counter>`, `<CardHeader>`, etc. inside `.rozie` templates.

    fun testModalComponentTagRecognised() {
        val descriptor = lookupComponentDescriptor("component-modal-recognised.rozie", "<Modal ")
        assertNotNull("<Modal> should have a non-null component descriptor", descriptor)
        // Class identity check — guarantees we're hitting RozieComponentTagProvider
        // (not some default platform descriptor fallback).
        assertEquals(
            "descriptor class should be RozieComponentElementDescriptor",
            "RozieComponentElementDescriptor",
            descriptor!!.javaClass.simpleName,
        )
        assertEquals("Modal", descriptor.name)
    }

    fun testCounterComponentTagRecognised() {
        val descriptor = lookupComponentDescriptor("component-counter-recognised.rozie", "<Counter ")
        assertNotNull("<Counter /> should have a non-null component descriptor", descriptor)
        assertEquals(
            "descriptor class should be RozieComponentElementDescriptor",
            "RozieComponentElementDescriptor",
            descriptor!!.javaClass.simpleName,
        )
        assertEquals("Counter", descriptor.name)
    }

    fun testLowercaseTagNotRecognised() {
        // Lowercase tags fall through to HTML's stock descriptors — the Rozie
        // provider MUST return null so we don't shadow the platform's actual
        // `<div>` descriptor (which carries real validation + completion data).
        val descriptor = lookupComponentDescriptor("lowercase-div-not-component.rozie", "<div ")
        assertNull("<div> should NOT get a Rozie component descriptor", descriptor)
    }

    // === Plan 08.2-10 P1-UAT-03 recognition-half: addTagNameVariants surfaces
    // file-local <components> declarations as autocomplete LookupElements ===

    /**
     * Regression: a `.rozie` file with `<components>` declaring {CardHeader,
     * CardFooter}; trigger tag-name-variant collection by handing the provider
     * a tag from the same file. Asserts both declared PascalCase names appear
     * in the emitted [com.intellij.codeInsight.lookup.LookupElement] list.
     *
     * Mirrors the reflection-based provider-lookup pattern used by the
     * descriptor-side helpers above so the test stays compilable across
     * RED states.
     */
    fun testLocalComponentsSurfaceInAddTagNameVariants() {
        myFixture.configureByFile("tag-provider-local-components-card.rozie")
        val elements = collectTagNameVariants(prefix = "Car")
        val names = elements.map { it.lookupString }.toSet()
        assertTrue(
            "Expected 'CardHeader' to appear in tag-name variants, got: $names",
            "CardHeader" in names,
        )
        assertTrue(
            "Expected 'CardFooter' to appear in tag-name variants, got: $names",
            "CardFooter" in names,
        )
    }

    /**
     * Regression: a `.rozie` file with NO `<components>` block — addTagNameVariants
     * must NOT crash and must NOT emit spurious LookupElements. The Plan 03
     * permissive `getDescriptor` fallback is intentionally preserved per the
     * Plan 08.2-10 Decision (KDoc line 25 of RozieComponentTagProvider stays
     * permissive in v0.2.0); the v0.3.0 narrowing is a future polish opportunity.
     */
    fun testFileWithoutComponentsBlockEmitsNoLookupElements() {
        myFixture.configureByFile("component-modal-recognised.rozie")
        val elements = collectTagNameVariants(prefix = null)
        // The fixture has no <components> block, so RozieComponentRegistry
        // returns emptySet -> addTagNameVariants emits nothing.
        assertTrue(
            "Expected zero tag-name variants from file without <components> block, " +
                "got: ${elements.map { it.lookupString }}",
            elements.isEmpty(),
        )
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

    /**
     * Same shape as [lookupAttributeDescriptor] but for the Plan-03 tag-side
     * provider ([js.rozie.intellij.xml.RozieComponentTagProvider]). We anchor
     * by a tag-open substring (e.g. `"<Modal "`, `"<Counter "`, `"<div "`)
     * because attribute names live inside attribute lists but tag names are
     * only located via the leading `<` and a trailing space (open vs self-close
     * isn't relevant here — both shapes are followed by whitespace before the
     * first attribute or the `/>`).
     *
     * Returns null if either the [RozieComponentTagProvider] isn't registered
     * (Wave-0 RED state) OR the provider returns null for the given tag.
     */
    private fun lookupComponentDescriptor(
        fixtureFile: String,
        tagOpenAnchor: String,
    ): XmlElementDescriptor? {
        myFixture.configureByFile(fixtureFile)
        val text = myFixture.file.text
        val anchorOffset = text.indexOf(tagOpenAnchor)
        check(anchorOffset >= 0) {
            "Anchor '$tagOpenAnchor' not found in $fixtureFile"
        }
        // Land the cursor just past the `<` so InjectedLanguageManager descends
        // into the HTML-injected fragment at a position that's inside the tag
        // name token (not on the `<` itself, which can land us on the parent
        // element rather than the tag).
        val offset = anchorOffset + 1

        val ilm = InjectedLanguageManager.getInstance(project)
        val injectedElement = ilm.findInjectedElementAt(myFixture.file, offset)
        val tag: XmlTag? = injectedElement
            ?.let { PsiTreeUtil.getParentOfType(it, XmlTag::class.java, false) }

        // Reflection-based provider lookup mirroring the attribute-side helper
        // above: enumerate all XmlElementDescriptorProvider extensions and pick
        // ours by simple-name. Keeps this test class compilable across the
        // Wave-0 RED window when `RozieComponentTagProvider` doesn't exist yet.
        val providers = TAG_PROVIDER_EP_NAME.extensionList
        val provider = providers.firstOrNull {
            it.javaClass.simpleName == TAG_PROVIDER_SIMPLE_NAME
        } ?: return null
        return tag?.let { provider.getDescriptor(it) }
    }

    /**
     * Plan 08.2-10 helper: enumerate `XmlTagNameProvider` extensions, locate the
     * Rozie provider by simple-name (mirrors the reflection-lookup pattern of
     * the descriptor-side helpers above), grab the first `<template>`-injected
     * [XmlTag] in the configured fixture, and invoke `addTagNameVariants`.
     * Returns the emitted [com.intellij.codeInsight.lookup.LookupElement] list
     * unchanged.
     */
    private fun collectTagNameVariants(
        prefix: String?,
    ): List<com.intellij.codeInsight.lookup.LookupElement> {
        // Find the first PascalCase-looking tag in the template-injected HTML
        // PSI by walking the file text. Anchoring on `<` is enough — every
        // template-position tag we care about starts with `<`.
        val text = myFixture.file.text
        // Search the LAST `<` (closer to the bottom of the file, more likely
        // to be inside the actual template body rather than the <components>
        // block opener). This is a robust-enough proxy in the test setting;
        // the real provider call-site uses InjectedLanguageManager.
        val templateAnchor = text.indexOf("<template>").let { if (it >= 0) it else 0 }
        val firstTagInTemplate = text.indexOf("<", templateAnchor + "<template>".length)
        check(firstTagInTemplate >= 0) {
            "Could not locate any tag inside the template body of the configured fixture"
        }
        val offset = firstTagInTemplate + 1
        val ilm = InjectedLanguageManager.getInstance(project)
        val injectedElement = ilm.findInjectedElementAt(myFixture.file, offset)
        val tag: XmlTag = injectedElement
            ?.let { PsiTreeUtil.getParentOfType(it, XmlTag::class.java, false) }
            ?: error("No XmlTag found at injected offset $offset")

        val providers = TAG_NAME_PROVIDER_EP_NAME.extensionList
        val provider = providers.firstOrNull {
            it.javaClass.simpleName == TAG_PROVIDER_SIMPLE_NAME
        } ?: error(
            "RozieComponentTagProvider not found among registered " +
                "XmlTagNameProvider extensions — registration regression"
        )
        val sink = mutableListOf<com.intellij.codeInsight.lookup.LookupElement>()
        provider.addTagNameVariants(sink, tag, prefix)
        return sink
    }

    companion object {
        private val EP_NAME: ExtensionPointName<XmlAttributeDescriptorsProvider> =
            ExtensionPointName.create("com.intellij.xml.attributeDescriptorsProvider")
        private const val PROVIDER_SIMPLE_NAME = "RozieAttributeDescriptorsProvider"

        // Plan 03 — XmlElementDescriptorProvider EP. The interface lives in the
        // psi.impl.* package per RESEARCH Pitfall 7 (semi-internal but Angular
        // has used the same import for ~10 years with no incident). EP name
        // verified from the platform XML: <com.intellij.xml.elementDescriptorProvider>
        // — same shape as the attributeDescriptorsProvider EP above.
        private val TAG_PROVIDER_EP_NAME: ExtensionPointName<XmlElementDescriptorProvider> =
            ExtensionPointName.create("com.intellij.xml.elementDescriptorProvider")
        private const val TAG_PROVIDER_SIMPLE_NAME = "RozieComponentTagProvider"

        // Plan 08.2-10 — XmlTagNameProvider EP for the addTagNameVariants
        // exercise. Same provider class as TAG_PROVIDER_SIMPLE_NAME above
        // (the Rozie provider implements BOTH interfaces in one class).
        private val TAG_NAME_PROVIDER_EP_NAME: ExtensionPointName<com.intellij.xml.XmlTagNameProvider> =
            ExtensionPointName.create("com.intellij.xml.tagNameProvider")
    }
}
