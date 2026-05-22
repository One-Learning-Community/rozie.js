package js.rozie.intellij

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.psi.xml.XmlAttribute
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.documentation.RozieAttributeDocumentationProvider
import js.rozie.intellij.documentation.RozieDocs

/**
 * Contract test for [js.rozie.intellij.documentation.RozieAttributeDocumentationProvider]
 * and its [RozieDocs] content registry.
 *
 * Behaviors 1–4 exercise the pure renderer [RozieDocs.attributeDoc] directly —
 * no PSI, fully deterministic. Behaviors 5–6 drive the provider against the
 * HTML-injected `XmlAttribute` PSI inside a `.rozie` `<template>` (reached via
 * [InjectedLanguageManager.findInjectedElementAt], the same descent the
 * `RozieXmlExtensionTest` helpers use).
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RozieDocumentationTest : BasePlatformTestCase() {

    // === Behavior 1: directive doc content ===

    fun testDirectiveDocContent() {
        val doc = RozieDocs.attributeDoc("r-if")
        assertNotNull("r-if should have documentation", doc)
        assertTrue(
            "r-if doc should describe conditional rendering; got: $doc",
            doc!!.contains("Conditionally render"),
        )
    }

    // === Behavior 2: event binding doc lists every modifier in the chain ===

    fun testEventModifierDocListsModifiers() {
        val doc = RozieDocs.attributeDoc("@click.stop.prevent")
        assertNotNull("@click.stop.prevent should have documentation", doc)
        assertTrue("Expected the .stop modifier doc; got: $doc", doc!!.contains("stopPropagation"))
        assertTrue("Expected the .prevent modifier doc; got: $doc", doc.contains("preventDefault"))
    }

    // === Behavior 3: r-model modifier doc ===

    fun testModelModifierDoc() {
        val doc = RozieDocs.attributeDoc("r-model.number")
        assertNotNull("r-model.number should have documentation", doc)
        assertTrue(
            "Expected the .number modifier doc; got: $doc",
            doc!!.contains("cast the bound value to a number"),
        )
    }

    // === Behavior 4: arbitrary / plain attributes get no doc ===

    fun testUnknownAttributeHasNoDoc() {
        assertNull("plain HTML `class` is not a Rozie construct", RozieDocs.attributeDoc("class"))
        assertNull("`foo` is not a Rozie construct", RozieDocs.attributeDoc("foo"))
        assertNull("unknown `r-`-prefixed names get no doc", RozieDocs.attributeDoc("r-bogus"))
    }

    // === Behavior 5: provider documents an injected `r-*` directive attribute ===

    fun testProviderDocumentsInjectedDirective() {
        val attr = injectedAttribute(
            "<rozie name=\"Doc\">\n<template>\n  <button r-if=\"ok\"></button>\n</template>\n</rozie>",
            "r-if",
        )
        val provider = RozieAttributeDocumentationProvider()
        val doc = provider.generateDoc(attr, null)
        assertNotNull("provider should document the injected r-if attribute", doc)
        assertTrue(
            "generated doc should carry the r-if description; got: $doc",
            doc!!.contains("Conditionally render"),
        )
    }

    // === Behavior 6: getCustomDocumentationElement resolves the sigil attribute ===

    fun testProviderResolvesCustomDocElement() {
        val attr = injectedAttribute(
            "<rozie name=\"Doc\">\n<template>\n  <button @click.stop=\"go()\"></button>\n</template>\n</rozie>",
            "@click",
        )
        val provider = RozieAttributeDocumentationProvider()
        val context = attr.nameElement?.firstChild ?: attr.nameElement ?: attr
        val resolved = provider.getCustomDocumentationElement(
            myFixture.editor,
            myFixture.file,
            context,
            context.textOffset,
        )
        assertSame(
            "getCustomDocumentationElement should return the enclosing XmlAttribute",
            attr,
            resolved,
        )
    }

    // === Helper ===

    /**
     * Configure a `.rozie` file from [source], descend into the HTML-injected
     * PSI at the first occurrence of [anchor], and return the enclosing
     * [XmlAttribute].
     */
    private fun injectedAttribute(source: String, anchor: String): XmlAttribute {
        myFixture.configureByText("Doc.rozie", source)
        val offset = myFixture.file.text.indexOf(anchor)
        check(offset >= 0) { "Anchor '$anchor' not found in fixture source" }
        val injected = InjectedLanguageManager.getInstance(project)
            .findInjectedElementAt(myFixture.file, offset)
        return PsiTreeUtil.getParentOfType(injected, XmlAttribute::class.java, false)
            ?: error("No XmlAttribute found in injected HTML at offset $offset")
    }
}
