package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Contract test for cross-block rename of a Rozie sigil member. Renaming a
 * `$props.X` access (or its `<props>` declaration) must rewrite BOTH the
 * declaration and every template / handler usage — without the
 * `No ElementManipulator instance registered for PsiElement(TEMPLATE_BODY)`
 * crash that fired when the host-anchored Find-Usages reference
 * ([js.rozie.intellij.references.RozieReferenceSearcher] `RozieHostUsageReference`)
 * hit `PsiReferenceBase.handleElementRename`'s default manipulator lookup.
 *
 * JUnit-3 convention: every test method MUST start with `test`.
 */
class RozieRenameTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/rename"

    /**
     * Rename driven from the DECLARATION caret. (Renaming from a `$props.title`
     * USAGE caret resolves correctly in the GUI but, headlessly, TargetElementUtil
     * jumps to the `$props` ambient decl in `rozie-globals.d.ts` — a fixture-only
     * quirk; the processor keys off the resolved target either way.) The renamed
     * `.rozie` text is read off the HOST file (`myFixture.file` is the injected
     * `<props>` JS fragment when the caret sits in it).
     */
    fun testRenamePropRewritesDeclarationAndUsages() {
        val text = renameAtCaret("rename-prop-usage.rozie", "heading")
        assertTrue("declaration key renamed; got:\n$text", "heading:" in text || "heading :" in text)
        assertTrue("interpolation usage renamed; got:\n$text", "\$props.heading" in text)
        assertFalse("stale `\$props.title` remains; got:\n$text", "\$props.title" in text)
    }

    fun testRenameDataRewritesDeclarationAndUsages() {
        val text = renameAtCaret("rename-data-usage.rozie", "tally")
        assertTrue("declaration key renamed; got:\n$text", "tally:" in text || "tally :" in text)
        // Both the script handler and the interpolation usage rewrite.
        assertFalse("stale `\$data.count` remains; got:\n$text", "\$data.count" in text)
        assertTrue("script usage renamed; got:\n$text", "\$data.tally" in text)
    }

    /** Rename the element at caret in [fixture] to [newName]; return the host `.rozie` text. */
    private fun renameAtCaret(fixture: String, newName: String): String {
        myFixture.configureByFile(fixture)
        val ilm = com.intellij.lang.injection.InjectedLanguageManager.getInstance(project)
        val hostFile = ilm.getTopLevelFile(myFixture.file)
        myFixture.renameElementAtCaret(newName)
        com.intellij.psi.PsiDocumentManager.getInstance(project).commitAllDocuments()
        return hostFile.text
    }
}
