package js.rozie.intellij

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiFile
import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Injection smoke tests for SC-3 + SC-4.
 *
 * Each method exercises one of the 6 D-09 / D-10 / D-11 / D-12 injection categories
 * by anchoring to a substring inside `injection-smoke.rozie` and asserting an
 * injected PsiFile of the expected language covers that offset.
 *
 * The seventh test (`testHtmlInspectionsDoNotFlagRozieAttributes`) loads
 * `inspection-carveout.rozie` and asserts the SC-4 carve-out: HTML inspections
 * (notably `HtmlUnknownAttribute`) do not surface diagnostics for `r-*`, `@*`, `:*`,
 * or `ref` attribute names.
 *
 * Note: [BasePlatformTestCase] descends from JUnit 3's `TestCase`; method names
 * MUST start with `test` to be picked up by Gradle's runner. JUnit 4 `@Test`
 * annotations are ignored on JUnit-3-style classes (see Plan 01 deviation #6).
 */
class RozieInjectionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/injection"

    // === SC-3 + D-09 / D-10 / D-11 / D-12 injection-presence smoke tests ===

    fun testScriptBodyIsJavaScriptInjected() {
        assertInjectedLanguageAt("injection-smoke.rozie", "console.log(message)", "JavaScript")
    }

    fun testPropsBodyIsJavaScriptInjected() {
        assertInjectedLanguageAt("injection-smoke.rozie", "value: { type: Number", "JavaScript")
    }

    fun testDataBodyIsJavaScriptInjected() {
        assertInjectedLanguageAt("injection-smoke.rozie", "count: 0", "JavaScript")
    }

    fun testListenersBodyIsJavaScriptInjectedAsWholeObjectLiteral() {
        // D-12: the entire <listeners> object literal is a single JS-injected range.
        assertInjectedLanguageAt("injection-smoke.rozie", "window:resize", "JavaScript")
    }

    fun testTemplateBodyIsHtmlInjected() {
        // Anchor at "<button" — the offset lies inside TEMPLATE_BODY.
        assertInjectedLanguageAt("injection-smoke.rozie", "<button @click", "HTML")
    }

    fun testStyleBodyIsCssInjected() {
        assertInjectedLanguageAt("injection-smoke.rozie", "color: red", "CSS")
    }

    // === SC-4 inspection carve-out ===

    fun testHtmlInspectionsDoNotFlagRozieAttributes() {
        myFixture.configureByFile("inspection-carveout.rozie")
        // Run the standard highlighting pipeline; this exercises every registered
        // inspection that's enabled in the test fixture's profile (the default
        // profile includes HtmlUnknownAttribute).
        val highlights = myFixture.doHighlighting()
        val rozieAttrComplaints = highlights.filter { info ->
            val text = info.description ?: ""
            val rozieAttr = text.contains("r-if") || text.contains("@click") ||
                text.contains("@keydown") || text.contains(":class") ||
                text.contains(":disabled") || text.contains("'ref'") ||
                text.contains("\"ref\"")
            val unknownish = text.contains("Unknown", ignoreCase = true) ||
                text.contains("not allowed", ignoreCase = true)
            rozieAttr && unknownish
        }
        assert(rozieAttrComplaints.isEmpty()) {
            "HTML inspections flagged Rozie attributes — SC-4 carve-out failed: " +
                rozieAttrComplaints.map { it.description }
        }
    }

    // === Helpers ===

    private fun assertInjectedLanguageAt(
        fixtureFile: String,
        anchor: String,
        expectedLanguageId: String,
    ) {
        myFixture.configureByFile(fixtureFile)
        val text = myFixture.file.text
        val offset = text.indexOf(anchor)
        check(offset >= 0) { "Anchor '$anchor' not found in $fixtureFile" }

        val ilm = InjectedLanguageManager.getInstance(project)

        // findInjectedElementAt() triggers injector resolution for a specific offset and
        // returns a PsiElement inside the injected file (or null if no injection covers
        // that offset). This is the canonical way to verify injection at an offset —
        // getInjectedPsiFiles() returns *cached* results which may be empty when the
        // injector hasn't been kicked yet by the editor.
        val injectedElement = ilm.findInjectedElementAt(myFixture.file, offset)
        val injectedFile = injectedElement?.containingFile

        if (injectedFile != null && injectedFile.language.id == expectedLanguageId) return

        // Fallback: scan all cached injections after running findInjectedElementAt at the
        // anchor (which forces the injector to run). Useful diagnostic if the offset
        // landed on a whitespace/separator token that lacks injected PSI directly.
        val cached = ilm.getInjectedPsiFiles(myFixture.file) ?: emptyList()
        val matching = cached.firstOrNull { pair ->
            val first = pair.first
            val range: TextRange = pair.second
            val file = first as? PsiFile ?: return@firstOrNull false
            range.containsOffset(offset) && file.language.id == expectedLanguageId
        }
        assert(matching != null) {
            "Expected $expectedLanguageId injection at offset $offset (anchor='$anchor') in " +
                "$fixtureFile; findInjectedElementAt -> language=" +
                "${injectedFile?.language?.id}; cached injections: " +
                cached.map { (it.first as? PsiFile)?.language?.id to it.second }
        }
    }
}
