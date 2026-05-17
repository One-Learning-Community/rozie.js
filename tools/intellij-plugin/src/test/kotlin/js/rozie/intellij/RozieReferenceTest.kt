package js.rozie.intellij

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.psi.JSProperty
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.psi.xml.XmlAttribute
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.parser.RozieRootBlock

/**
 * SC-5 contract test for the cross-block PsiReferenceContributor stack
 * (`RozieJSReferenceContributor` + `RoziePropsReference` + `RozieDataReference` +
 * `RozieRefsReference`).
 *
 * **Spike test (Task 0)** [testInjectionHostIsRozieRootBlock]: empirically
 * validates that `InjectedLanguageManager.getInjectionHost(jsRefExpression)` returns
 * the `RozieRootBlock` host for a `JSReferenceExpression` living inside the
 * `<script>` block's JS injection. RESEARCH Open Question 1 / Assumption A1.
 *
 * - GREEN  → Tasks 1-3 implement reference classes using the primary
 *            `InjectedLanguageManager.getInjectionHost(...)` path.
 * - RED    → Tasks 1-3 fall back to `element.containingFile.context as? RozieRootBlock`
 *            per RESEARCH Pitfall 5 (lines 851–854). Both have precedent and either
 *            is acceptable per RESEARCH § Pattern 5.
 *
 * **Cross-block-resolution tests (Task 1)** [testPropsValueResolves /
 * testDataCountResolves / testRefsRootResolves]: assert `myFixture.file
 * .findReferenceAt(myFixture.caretOffset)?.resolve()` returns a non-null target
 * inside the appropriate sibling SFC block.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RozieReferenceTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/references"

    // === Task 0 SPIKE — validate getInjectionHost returns RozieRootBlock ===

    fun testInjectionHostIsRozieRootBlock() {
        myFixture.configureByFile("spike-injection-host.rozie")
        val text = myFixture.file.text
        // Anchor on `$props.value` inside the <script> block. The whole `$props`
        // substring is the receiver; we want a position INSIDE that token so the
        // walk lands on a JSReferenceExpression in injected JS PSI.
        val offset = text.indexOf("\$props.value")
        check(offset >= 0) { "spike fixture missing `\$props.value` anchor" }
        // Walk by one char inside `$props` so findInjectedElementAt lands on the
        // identifier leaf rather than the leading sigil character boundary.
        val injectedElement = InjectedLanguageManager.getInstance(project)
            .findInjectedElementAt(myFixture.file, offset + 1)
        check(injectedElement != null) { "no injected element at offset $offset" }
        val jsRef = PsiTreeUtil.getParentOfType(injectedElement, JSReferenceExpression::class.java)
        check(jsRef != null) {
            "no JSReferenceExpression ancestor at offset $offset; injected element was " +
                "${injectedElement::class.qualifiedName}"
        }
        val host = InjectedLanguageManager.getInstance(project).getInjectionHost(jsRef)
        // RESEARCH Open Question 1 / Assumption A1 — either GREEN (host is RozieRootBlock)
        // or RED (host is null) is documented as acceptable. The assertion below
        // captures the EXPECTED-GREEN outcome. If this assertion fires RED in CI,
        // Task 2 falls back to the `element.containingFile.context` path per
        // RESEARCH Pitfall 5 (lines 851–854) — both have precedent.
        assertNotNull(
            "InjectedLanguageManager.getInjectionHost returned null for a JSReferenceExpression " +
                "inside a <script> JS injection. RESEARCH Open Question 1 / Pitfall 5 fallback path " +
                "(element.containingFile.context) is the documented alternative.",
            host,
        )
        assertTrue(
            "InjectedLanguageManager.getInjectionHost returned ${host?.javaClass?.name} instead " +
                "of RozieRootBlock. If this fails in CI, switch Tasks 2-3 to the " +
                "element.containingFile.context fallback per RESEARCH Pitfall 5.",
            host is RozieRootBlock,
        )
    }

    // === Task 1 / Behavior 1: $props.X resolves into <props> block ===

    fun testPropsValueResolves() {
        myFixture.configureByFile("counter-props-ref.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "findReferenceAt returned null at caret on `\$props.value`; expected a " +
                "RoziePropsReference contributed by RozieJSReferenceContributor",
            ref,
        )
        val resolved = ref!!.resolve()
        assertNotNull(
            "RoziePropsReference.resolve() returned null for `\$props.value`; expected the " +
                "JSProperty for `value:` inside the <props> block of the same .rozie file",
            resolved,
        )
        assertTrue(
            "Resolved target was ${resolved?.javaClass?.name} instead of JSProperty",
            resolved is JSProperty,
        )
        assertEquals("value", (resolved as JSProperty).name)
        // Confirm the resolved JSProperty's top-level file is the same .rozie host
        // file we configured — the resolution crossed an injection boundary but
        // stayed within one host file. Use getTopLevelFile to walk back from the
        // injected JS PsiFile to the host RozieFile.
        val ilm = InjectedLanguageManager.getInstance(project)
        val resolvedTopLevelFile = ilm.getTopLevelFile(resolved.containingFile) ?: resolved.containingFile
        assertEquals(
            "Resolved JSProperty's top-level host file should match the test fixture",
            myFixture.file.name,
            resolvedTopLevelFile.name,
        )
    }

    // === Task 1 / Behavior 2: $data.X resolves into <data> block ===

    fun testDataCountResolves() {
        myFixture.configureByFile("counter-data-ref.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull("findReferenceAt returned null at caret on `\$data.count`", ref)
        val resolved = ref!!.resolve()
        assertNotNull(
            "RozieDataReference.resolve() returned null for `\$data.count`; expected the " +
                "JSProperty for `count:` inside the <data> block",
            resolved,
        )
        assertTrue(
            "Resolved target was ${resolved?.javaClass?.name} instead of JSProperty",
            resolved is JSProperty,
        )
        assertEquals("count", (resolved as JSProperty).name)
    }

    // === Task 1 / Behavior 3: $refs.X resolves into <template> ref="X" attribute ===

    fun testRefsRootResolves() {
        myFixture.configureByFile("counter-refs-ref.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull("findReferenceAt returned null at caret on `\$refs.root`", ref)
        val resolved = ref!!.resolve()
        assertNotNull(
            "RozieRefsReference.resolve() returned null for `\$refs.root`; expected the " +
                "XmlAttribute `ref=\"root\"` inside the <template> block",
            resolved,
        )
        assertTrue(
            "Resolved target was ${resolved?.javaClass?.name} instead of XmlAttribute",
            resolved is XmlAttribute,
        )
        val attr = resolved as XmlAttribute
        assertEquals("ref", attr.name)
        assertEquals("root", attr.value)
    }
}
