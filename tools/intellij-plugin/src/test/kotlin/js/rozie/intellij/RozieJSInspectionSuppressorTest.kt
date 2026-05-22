package js.rozie.intellij

import com.intellij.codeInspection.InspectionSuppressor
import com.intellij.codeInspection.LanguageInspectionSuppressors
import com.intellij.lang.Language
import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.psi.PsiFile
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.inspection.RozieJSInspectionSuppressor

/**
 * SC-3 / SC-4 contract test for [js.rozie.intellij.inspection.RozieJSInspectionSuppressor].
 *
 * The platform's JS inspection profile in the test sandbox does NOT necessarily
 * enable JSUnusedGlobalSymbols/JSUnusedLocalSymbols by default, and the suite
 * is not allowed to flip global inspection-profile settings. So instead of
 * driving `myFixture.doHighlighting()` and asserting on its filtered output
 * (which would be ambiguous: "no warning" could mean "inspection ran and was
 * suppressed" OR "inspection never ran"), we exercise the suppressor's contract
 * DIRECTLY by:
 *
 *   1. Loading a fixture .rozie / .js file.
 *   2. Locating an injected JS PSI element (a [JSReferenceExpression] or
 *      [JSFunctionDeclaration]) inside the target block.
 *   3. Invoking [InspectionSuppressor.isSuppressedFor] on the suppressor
 *      registered via [LanguageInspectionSuppressors] for `JavascriptLanguage`.
 *   4. Asserting the boolean answer matches expectations:
 *      - true  for {JSUnusedGlobalSymbols, JSUnusedLocalSymbols} inside .rozie
 *        SCRIPT / PROPS / DATA / COMPONENTS / LISTENERS bodies.
 *      - false for the same tool IDs inside a plain .js file (Pitfall 2 leak guard).
 *      - false for unrelated tool IDs (e.g. "JSStatementExpected") even inside
 *        Rozie blocks — proves the allow-list is narrow per the plan's "Statement
 *        expected family is intentionally NOT suppressed here" contract.
 *
 * This directly exercises the public IntelliJ Platform InspectionSuppressor SPI
 * surface, sidestepping the inspection-profile question.
 *
 * JUnit-3 method-name convention: every test method MUST start with `test`
 * (see RozieAnnotatorTest.kt line 22 for the canonical comment).
 */
class RozieJSInspectionSuppressorTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/inspection"

    // === Behavior 1: <script> unused-function suppression (P1-UAT-05 close) ===

    fun testScriptUnusedSymbolsAreSuppressed() {
        myFixture.configureByFile("js-script-unused.rozie")
        val injectedJsLeaf = findInjectedJsLeafAt("function increment")
        val suppressor = resolveJsSuppressor()
        assertTrue(
            "JSUnusedGlobalSymbols MUST be suppressed inside .rozie <script> body",
            suppressor.isSuppressedFor(injectedJsLeaf, "JSUnusedGlobalSymbols"),
        )
        assertTrue(
            "JSUnusedLocalSymbols MUST be suppressed inside .rozie <script> body",
            suppressor.isSuppressedFor(injectedJsLeaf, "JSUnusedLocalSymbols"),
        )
    }

    // === Behavior 2: <props>/<data>/<components> object-literal keys suppressed (P1-UAT-04 JS-side) ===

    fun testPropsObjectLiteralKeysSuppressed() {
        myFixture.configureByFile("js-props-object-literal.rozie")
        // Anchor inside the <props> body — "value: { type:" is unique to the props block.
        val propsLeaf = findInjectedJsLeafAt("value: { type")
        val suppressor = resolveJsSuppressor()
        assertTrue(
            "JSUnusedGlobalSymbols MUST be suppressed inside .rozie <props> body",
            suppressor.isSuppressedFor(propsLeaf, "JSUnusedGlobalSymbols"),
        )
        assertTrue(
            "JSUnusedLocalSymbols MUST be suppressed inside .rozie <props> body",
            suppressor.isSuppressedFor(propsLeaf, "JSUnusedLocalSymbols"),
        )
    }

    fun testDataObjectLiteralKeysSuppressed() {
        myFixture.configureByFile("js-props-object-literal.rozie")
        // Anchor inside the <data> body — "History: [" is unique to the data block.
        val dataLeaf = findInjectedJsLeafAt("History: [")
        val suppressor = resolveJsSuppressor()
        assertTrue(
            "JSUnusedGlobalSymbols MUST be suppressed inside .rozie <data> body",
            suppressor.isSuppressedFor(dataLeaf, "JSUnusedGlobalSymbols"),
        )
    }

    fun testComponentsObjectLiteralKeysSuppressed() {
        myFixture.configureByFile("js-props-object-literal.rozie")
        // Anchor inside the <components> body.
        val compLeaf = findInjectedJsLeafAt("Counter: './Counter")
        val suppressor = resolveJsSuppressor()
        assertTrue(
            "JSUnusedGlobalSymbols MUST be suppressed inside .rozie <components> body",
            suppressor.isSuppressedFor(compLeaf, "JSUnusedGlobalSymbols"),
        )
    }

    // === Behavior 3: NEGATIVE — plain .js file untouched (Pitfall 2 leak guard) ===

    fun testPlainJsFileIsUnaffected() {
        myFixture.configureByFile("plain-js-unused.js")
        // For a plain .js file, the file's PSI IS the JS PSI tree — no injection.
        // (The platform reports the language id as either "JavaScript" or
        // "ECMAScript 6" depending on bundled-plugin version; either way the
        // file is NOT a .rozie host, so the suppressor MUST stay inert.)
        val jsFile = myFixture.file
        val text = jsFile.text
        val offset = text.indexOf("increment")
        check(offset >= 0)
        val leaf = jsFile.findElementAt(offset)
            ?: error("Could not find JS leaf at offset $offset in plain-js-unused.js")
        val suppressor = resolveJsSuppressor()
        assertFalse(
            "JSUnusedGlobalSymbols MUST NOT be suppressed in a plain .js file (Pitfall 2 leak guard)",
            suppressor.isSuppressedFor(leaf, "JSUnusedGlobalSymbols"),
        )
        assertFalse(
            "JSUnusedLocalSymbols MUST NOT be suppressed in a plain .js file (Pitfall 2 leak guard)",
            suppressor.isSuppressedFor(leaf, "JSUnusedLocalSymbols"),
        )
    }

    // === Behavior 4: Narrow allow-list — unrelated tool IDs NOT suppressed ===

    fun testNonAllowListedToolIdsNotSuppressed() {
        myFixture.configureByFile("js-script-unused.rozie")
        val injectedJsLeaf = findInjectedJsLeafAt("function increment")
        val suppressor = resolveJsSuppressor()
        // JSStatementExpected is intentionally NOT suppressed by this plan
        // (Plan 10's paren-wrap is the principled fix). The allow-list MUST
        // stay narrow.
        assertFalse(
            "JSStatementExpected MUST NOT be suppressed by this plan (deferred to Plan 10 paren-wrap)",
            suppressor.isSuppressedFor(injectedJsLeaf, "JSStatementExpected"),
        )
        // A garbage inspection ID we definitely don't recognise.
        assertFalse(
            "An unrelated inspection ID MUST NOT be suppressed (allow-list must be narrow)",
            suppressor.isSuppressedFor(injectedJsLeaf, "SomeRandomInspectionId"),
        )
    }

    // === Helpers ===

    /**
     * Resolve the JavaScript [InspectionSuppressor] registered for our plugin.
     * The platform may have multiple suppressors registered for a language;
     * we explicitly pick our own class so the assertion is unambiguous.
     */
    private fun resolveJsSuppressor(): RozieJSInspectionSuppressor {
        // `Language.findLanguageByID("JavaScript")` rather than
        // `JavascriptLanguage.INSTANCE`: the latter's `INSTANCE` field was
        // removed in IntelliJ 2025.3 (the class became a Kotlin `object`),
        // so the static accessor compiles on 2024.2 but not 2025.3. Lookup
        // by language ID is stable across both platform versions.
        val jsLanguage = Language.findLanguageByID("JavaScript")!!
        val all = LanguageInspectionSuppressors.INSTANCE.allForLanguage(jsLanguage)
        val ours = all.filterIsInstance<RozieJSInspectionSuppressor>().firstOrNull()
        assertNotNull(
            "RozieJSInspectionSuppressor must be registered via " +
                "<lang.inspectionSuppressor language=\"JavaScript\"> in plugin.xml; " +
                "found suppressors: ${all.map { it::class.qualifiedName }}",
            ours,
        )
        return ours!!
    }

    /**
     * Locate the [PsiFile] of the injected JS fragment at the given anchor in the
     * fixture text, then return any leaf [com.intellij.psi.PsiElement] inside that
     * injected file (the suppressor consults the leaf's containing-host walk-back).
     */
    private fun findInjectedJsLeafAt(anchor: String): com.intellij.psi.PsiElement {
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
