package js.rozie.intellij

import com.intellij.codeInspection.InspectionSuppressor
import com.intellij.codeInspection.LanguageInspectionSuppressors
import com.intellij.lang.css.CSSLanguage
import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.inspection.RozieCssInspectionSuppressor

/**
 * SC-3 / SC-4 contract test for [js.rozie.intellij.inspection.RozieCssInspectionSuppressor].
 *
 * Mirrors the [RozieJSInspectionSuppressorTest] mechanism — exercise the
 * [com.intellij.codeInspection.InspectionSuppressor] SPI DIRECTLY rather than
 * filtering [com.intellij.testFramework.fixtures.CodeInsightTestFixture.doHighlighting]
 * output. The platform's CSS inspection profile in the test sandbox does NOT
 * necessarily enable `CssUnusedSymbol` by default, so a `doHighlighting()`-based
 * "no warning fires" assertion would be ambiguous (no warning could mean
 * "inspection ran and was suppressed" OR "inspection never ran").
 *
 * The contract under test:
 *   1. Inside a `.rozie` `<style>` block, the suppressor MUST return true for
 *      `CssUnusedSymbol` (positive — P1-UAT-06 closure).
 *   2. Inside a plain `.css` file, the suppressor MUST return false for the
 *      SAME tool id (negative — Pitfall 2 leak guard).
 *   3. Inside a `.rozie` `<style>` block, the suppressor MUST return false for
 *      unrelated tool ids (e.g. structural CSS errors) — proves the allow-list
 *      stays narrow per T-08.2-19 disposition.
 *
 * JUnit-3 method-name convention: every test method MUST start with `test`
 * (see RozieAnnotatorTest.kt line 22 for the canonical comment).
 */
class RozieCssInspectionSuppressorTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/inspection"

    // === Behavior 1: POSITIVE — <style> unused selectors suppressed (P1-UAT-06) ===

    fun testStyleUnusedSelectorsAreSuppressed() {
        myFixture.configureByFile("css-style-unused.rozie")
        val injectedCssLeaf = findInjectedCssLeafAt(".card")
        val suppressor = resolveCssSuppressor()
        assertTrue(
            "CssUnusedSymbol MUST be suppressed inside .rozie <style> body",
            suppressor.isSuppressedFor(injectedCssLeaf, "CssUnusedSymbol"),
        )
    }

    // === Behavior 2: NEGATIVE — plain .css file untouched (Pitfall 2 leak guard) ===

    fun testPlainCssFileIsUnaffected() {
        myFixture.configureByFile("plain-css-unused.css")
        // For a plain .css file, the file's PSI IS the CSS PSI tree — no injection.
        // The suppressor's contract is "stays inert on non-Rozie host context"
        // regardless of which CSS-flavor language id (CSS / SCSS / Less) shows up.
        val cssFile = myFixture.file
        val text = cssFile.text
        val offset = text.indexOf(".card")
        check(offset >= 0)
        val leaf = cssFile.findElementAt(offset)
            ?: error("Could not find CSS leaf at offset $offset in plain-css-unused.css")
        val suppressor = resolveCssSuppressor()
        assertFalse(
            "CssUnusedSymbol MUST NOT be suppressed in a plain .css file (Pitfall 2 leak guard)",
            suppressor.isSuppressedFor(leaf, "CssUnusedSymbol"),
        )
    }

    // === Behavior 3: Narrow allow-list — unrelated tool IDs NOT suppressed ===

    fun testNonAllowListedToolIdsNotSuppressed() {
        myFixture.configureByFile("css-style-unused.rozie")
        val injectedCssLeaf = findInjectedCssLeafAt(".card")
        val suppressor = resolveCssSuppressor()
        // Structural CSS errors (unbalanced braces, invalid selectors) MUST
        // keep firing — they are real authoring errors, not cross-block-unaware
        // noise. The allow-list MUST stay narrow per T-08.2-19 disposition.
        assertFalse(
            "Unrelated structural CSS inspections MUST NOT be suppressed (allow-list must be narrow)",
            suppressor.isSuppressedFor(injectedCssLeaf, "CssInvalidPseudoSelector"),
        )
        assertFalse(
            "A garbage inspection ID MUST NOT be suppressed (allow-list must be narrow)",
            suppressor.isSuppressedFor(injectedCssLeaf, "SomeRandomCssInspectionId"),
        )
    }

    // === Helpers ===

    /**
     * Resolve the CSS [InspectionSuppressor] registered for our plugin.
     * The platform may have multiple suppressors registered for a language;
     * we explicitly pick our own class so the assertion is unambiguous.
     */
    private fun resolveCssSuppressor(): RozieCssInspectionSuppressor {
        val all = LanguageInspectionSuppressors.INSTANCE.allForLanguage(CSSLanguage.INSTANCE)
        val ours = all.filterIsInstance<RozieCssInspectionSuppressor>().firstOrNull()
        assertNotNull(
            "RozieCssInspectionSuppressor must be registered via " +
                "<lang.inspectionSuppressor language=\"CSS\"> in plugin.xml; " +
                "found suppressors: ${all.map { it::class.qualifiedName }}",
            ours,
        )
        return ours!!
    }

    /**
     * Locate the [com.intellij.psi.PsiFile] of the injected CSS fragment at the
     * given anchor in the fixture text, then return any leaf
     * [com.intellij.psi.PsiElement] inside that injected file. The suppressor
     * consults the leaf's containing-host walk-back.
     */
    private fun findInjectedCssLeafAt(anchor: String): com.intellij.psi.PsiElement {
        val text = myFixture.file.text
        val offset = text.indexOf(anchor)
        check(offset >= 0) { "Anchor '$anchor' not found in fixture text" }
        val ilm = InjectedLanguageManager.getInstance(project)
        val injectedElement = ilm.findInjectedElementAt(myFixture.file, offset)
            ?: error("No injection found at offset $offset (anchor='$anchor')")
        // Walk down to a leaf to mirror what the inspection framework hands us.
        val leaf = PsiTreeUtil.getDeepestFirst(injectedElement)
        return leaf
    }
}
