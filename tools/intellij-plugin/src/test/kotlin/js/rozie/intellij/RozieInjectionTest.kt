package js.rozie.intellij

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.psi.JSBinaryExpression
import com.intellij.lang.javascript.psi.JSLabeledStatement
import com.intellij.lang.javascript.psi.JSObjectLiteralExpression
import com.intellij.lang.javascript.psi.JSProperty
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiFile
import com.intellij.psi.util.PsiTreeUtil
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

    fun testComponentsBodyIsJavaScriptInjected() {
        assertInjectedLanguageAt("injection-smoke.rozie", "Counter: './Counter", "JavaScript")
    }

    // testSlotBracketExpressionIsJavaScriptInjected RETIRED in Phase 08.2 Plan 01:
    // the IN_SLOT_BRACKET_EXPR state and its ATTR_VALUE_JS body emission no longer
    // exist post-pivot. The entire <template> body is one TEMPLATE_BODY token
    // HTML-injected by RozieMultiHostInjector; dynamic-slot JS expressions inside
    // attribute values are not separately JS-injected in v0.2.0 (defer to v0.3.0
    // per 08.2-RESEARCH.md Open Question 5).

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

    // === Plan 08.2-11: Paren-wrap on PROPS_BODY / DATA_BODY / COMPONENTS_BODY ===
    //
    // P1-UAT-04 (Statement-expected / Component-expected / JSLabeledStatement family) is
    // closed at the injection layer by wrapping object-literal-shaped block bodies as
    // `(\n ... \n)` so the JS parser sees a parenthesised expression, not a labeled
    // statement. Tests 1-3 assert the injected JS PSI tree contains a
    // [JSObjectLiteralExpression] with the expected keys as [JSProperty] children
    // (paren-wrap REPARSE outcome) — the previous unwrapped form would produce a
    // [JSLabeledStatement] tree with NO JSObjectLiteralExpression / JSProperty hits.
    // Test 4 (negative) asserts SCRIPT_BODY stays unwrapped (function declarations
    // still parse as such). Test 5 (invariant) asserts Plan 05 cross-block
    // Go-to-Declaration still resolves correctly through the paren-wrap.

    fun testPropsBodyParsesAsObjectLiteralUnderParenWrap() {
        val injectedFile = configureAndGetInjectedJs("object-literal-props.rozie", "value: 0")
        // With paren-wrap: ( { value: 0, step: 1, label: 'count' } ) parses as a
        // JSObjectLiteralExpression containing 3 JSProperty children. Without
        // paren-wrap: the top-level body parses as a JSLabeledStatement tree
        // and PsiTreeUtil.findChildrenOfType(file, JSObjectLiteralExpression)
        // would be empty.
        val objLits = PsiTreeUtil.findChildrenOfType(injectedFile, JSObjectLiteralExpression::class.java)
        assertTrue(
            "Expected at least one JSObjectLiteralExpression in paren-wrapped <props> body; " +
                "without paren-wrap the JS parser produces JSLabeledStatement (Statement-expected). " +
                "Found: ${objLits.map { it.text }}",
            objLits.isNotEmpty(),
        )
        val props = PsiTreeUtil.findChildrenOfType(injectedFile, JSProperty::class.java)
        val propNames = props.mapNotNull { it.name }.toSet()
        assertTrue(
            "Expected JSProperty 'value' inside paren-wrapped <props>; found: $propNames",
            "value" in propNames,
        )
        assertTrue(
            "Expected JSProperty 'step' inside paren-wrapped <props>; found: $propNames",
            "step" in propNames,
        )
        assertTrue(
            "Expected JSProperty 'label' inside paren-wrapped <props>; found: $propNames",
            "label" in propNames,
        )
        // Defence-in-depth: assert NO labeled-statement tree is present at top-level
        // within the injected file. If paren-wrap were missing, EVERY key would be a
        // JSLabeledStatement; the assertion below would fail.
        val labels = PsiTreeUtil.findChildrenOfType(injectedFile, JSLabeledStatement::class.java)
        assertTrue(
            "Expected ZERO JSLabeledStatement nodes in paren-wrapped <props> body; " +
                "presence indicates the paren-wrap did not take effect. " +
                "Labels found: ${labels.map { it.label }}",
            labels.isEmpty(),
        )
    }

    fun testDataBodyParsesAsObjectLiteralUnderParenWrap() {
        val injectedFile = configureAndGetInjectedJs("object-literal-data.rozie", "open: false")
        val objLits = PsiTreeUtil.findChildrenOfType(injectedFile, JSObjectLiteralExpression::class.java)
        assertTrue(
            "Expected at least one JSObjectLiteralExpression in paren-wrapped <data> body; " +
                "found: ${objLits.map { it.text }}",
            objLits.isNotEmpty(),
        )
        val propNames = PsiTreeUtil.findChildrenOfType(injectedFile, JSProperty::class.java)
            .mapNotNull { it.name }.toSet()
        assertTrue(
            "Expected JSProperty 'open' inside paren-wrapped <data>; found: $propNames",
            "open" in propNames,
        )
        assertTrue(
            "Expected JSProperty 'items' inside paren-wrapped <data>; found: $propNames",
            "items" in propNames,
        )
        val labels = PsiTreeUtil.findChildrenOfType(injectedFile, JSLabeledStatement::class.java)
        assertTrue(
            "Expected ZERO JSLabeledStatement nodes in paren-wrapped <data> body; " +
                "labels found: ${labels.map { it.label }}",
            labels.isEmpty(),
        )
    }

    fun testComponentsBodyParsesAsObjectLiteralUnderParenWrap() {
        val injectedFile = configureAndGetInjectedJs("object-literal-components.rozie", "Card: './Card")
        val objLits = PsiTreeUtil.findChildrenOfType(injectedFile, JSObjectLiteralExpression::class.java)
        assertTrue(
            "Expected at least one JSObjectLiteralExpression in paren-wrapped <components> body; " +
                "found: ${objLits.map { it.text }}",
            objLits.isNotEmpty(),
        )
        val propNames = PsiTreeUtil.findChildrenOfType(injectedFile, JSProperty::class.java)
            .mapNotNull { it.name }.toSet()
        assertTrue(
            "Expected JSProperty 'Card' inside paren-wrapped <components>; found: $propNames",
            "Card" in propNames,
        )
        assertTrue(
            "Expected JSProperty 'Modal' inside paren-wrapped <components>; found: $propNames",
            "Modal" in propNames,
        )
        val labels = PsiTreeUtil.findChildrenOfType(injectedFile, JSLabeledStatement::class.java)
        assertTrue(
            "Expected ZERO JSLabeledStatement nodes in paren-wrapped <components> body; " +
                "labels found: ${labels.map { it.label }}",
            labels.isEmpty(),
        )
    }

    fun testScriptBodyRemainsUnwrappedAsStatementList() {
        // The injection-smoke.rozie <script> body is `const message = "hello"; $onMount(...)`.
        // If SCRIPT_BODY were paren-wrapped (which it MUST NOT be), `const` would not
        // parse at expression position and the file would have zero JSVariable
        // declarations. We assert the function call / variable declaration parses as
        // statements. Defence: at least one statement-level node must exist.
        val injectedFile = configureAndGetInjectedJs(
            "injection-smoke.rozie",
            "const message",
        )
        // The const-declaration parses to JSVariable/JSVarStatement at statement
        // position. We assert: the injected file's text contains the const declaration
        // (proves injection occurred) AND that no `(` prefix appears at offset 0 of
        // the injected file's text (proves paren-wrap was NOT applied to SCRIPT_BODY).
        val txt = injectedFile.text
        assertTrue(
            "Expected injected JS to contain the <script> body source; got: $txt",
            txt.contains("const message"),
        )
        // The injected fragment's text comes from the host content WITHOUT any prefix —
        // if paren-wrap had been applied the injected file's text would start with "(".
        // (addPlace prefix/suffix is technically invisible to the host coordinate
        // mapping but IS visible in the injected PsiFile.text content.)
        assertFalse(
            "SCRIPT_BODY MUST NOT be paren-wrapped — injected text starts with '(' indicating wrap; " +
                "first 32 chars: '${txt.take(32)}'",
            txt.trimStart().startsWith("("),
        )
    }

    fun testPropsParenWrapPreservesCrossBlockGoToDeclaration() {
        // Plan 05 invariant: $props.value in <script> resolves to the `value:` key
        // in the paren-wrapped <props> body. The paren-wrap MUST NOT shift host
        // coordinates — InjectedLanguageManager.injectedToHost should still return
        // an accurate host range so RoziePropsReference can locate the key.
        // The fixture uses the standard `<caret>` marker idiom (see counter-props-ref.rozie).
        // Separated from object-literal-props.rozie so the parse-shape tests can target
        // the host file's text directly (BasePlatformTestCase returns the INJECTED file
        // as myFixture.file when the caret sits inside an injected region — splitting
        // sidesteps that).
        myFixture.configureByFile("object-literal-props-ref.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "findReferenceAt returned null at caret on `\$props.value` inside object-literal-props.rozie; " +
                "expected the RoziePropsReference contributed by RozieJSReferenceContributor",
            ref,
        )
        val resolved = ref!!.resolve()
        assertNotNull(
            "RoziePropsReference.resolve() returned null for `\$props.value` over paren-wrapped <props>; " +
                "paren-wrap may have shifted host coordinates and broken Plan 05 cross-block resolution",
            resolved,
        )
        // The resolved element's NAME must be "value" (the key identifier). Plan 05's
        // findJsKeyByName returns either:
        //   - a JSProperty (paren-wrapped path — preferred shape, .name == "value")
        //   - a JSLabeledStatement.labelIdentifier (legacy unwrapped path — .text == "value")
        // Both shapes carry the same accessed name; post-paren-wrap we expect the
        // JSProperty path (cleanest match). If the paren-wrap shifted host coordinates
        // by N bytes, the resolver would land on a wrong key or fail entirely — caught
        // by the assertNotNull above.
        val name = when (resolved) {
            is com.intellij.lang.javascript.psi.JSProperty -> resolved.name
            is com.intellij.lang.javascript.psi.JSLabeledStatement -> resolved.label
            else -> resolved!!.text
        }
        assertEquals(
            "Resolved key name should be 'value'; if this fails the paren-wrap shifted host " +
                "coordinates and the resolver landed on a wrong key",
            "value",
            name,
        )
        // Confirm the resolved element lives inside the same .rozie host file — the
        // resolution crossed an injection boundary (script -> props) but stayed within
        // one host file. Use InjectedLanguageManager.getTopLevelFile to walk back.
        val ilm = InjectedLanguageManager.getInstance(project)
        val topFile = ilm.getTopLevelFile(resolved!!.containingFile) ?: resolved.containingFile
        assertEquals(
            "Resolved key's top-level host file should match the test fixture (cross-block-but-same-file)",
            myFixture.file.name,
            topFile.name,
        )
    }

    // === Plan 08.2-14: Per-expression JS injection inside TEMPLATE_BODY ===
    //
    // P1-UAT-08 closure at the injection layer: directive attribute-value expressions
    // (`r-if="..."`, `r-for="..."`, `@click="..."`, `:foo="..."`) AND `{{ }}` mustache
    // interpolations inside template body are JS-injected. Each test anchors on the
    // expression substring and asserts a JavaScript injection covers that offset.
    //
    // Range-math invariants pinned by these tests:
    //  - Quotes excluded (Tests 1, 3, 4) — anchor lands inside the value, not on `"`.
    //  - Modifier suffixes excluded (Test 5) — `.prevent` lives in the attribute NAME
    //    and is NOT covered by any JS injection.
    //  - `{{` / `}}` delimiters excluded (Test 6) — anchor inside the interior.
    //  - r-for paren-wrap (Test 2) — `item in items` parses as JSBinaryExpression `in`
    //    under the paren-wrap; without paren-wrap it would be JSLabeledStatement.

    fun testRIfExpressionIsJsInjected() {
        assertInjectedLanguageAt("r-if-expression-injection.rozie", "\$data.open", "JavaScript")
    }

    fun testRForExpressionIsJsInjectedWithParenWrap() {
        val injectedFile = configureAndGetInjectedJs(
            "r-for-expression-injection.rozie",
            "item in items",
        )
        // With paren-wrap, the injected fragment is `(\nitem in items\n)`, which
        // parses as a JSBinaryExpression with operator `in`. Without paren-wrap,
        // JS would parse this at statement position as `item:` label + invalid
        // `in items` remainder (JSLabeledStatement family), producing no
        // JSBinaryExpression at top level.
        val bins = PsiTreeUtil.findChildrenOfType(injectedFile, JSBinaryExpression::class.java)
        assertTrue(
            "Expected at least one JSBinaryExpression in paren-wrapped r-for value; " +
                "without paren-wrap the JS parser produces JSLabeledStatement and no JSBinaryExpression. " +
                "Found: ${bins.map { it.text }}",
            bins.isNotEmpty(),
        )
        // Defence-in-depth: at least one `in` binary expression must exist (not just
        // any binary expression — pin the operator).
        val hasInBinary = bins.any { it.operationSign?.toString().orEmpty().contains("in", ignoreCase = true) ||
            it.text.contains(" in ") }
        assertTrue(
            "Expected a JSBinaryExpression using the `in` operator from r-for value; found ops: " +
                bins.map { it.operationSign },
            hasInBinary,
        )
    }

    fun testEventHandlerExpressionIsJsInjected() {
        assertInjectedLanguageAt("event-handler-injection.rozie", "handler()", "JavaScript")
    }

    fun testColonBindExpressionIsJsInjected() {
        // Two distinct expressions in the same TEMPLATE_BODY — regression test that
        // multiple per-attribute injections per host coalesce correctly.
        assertInjectedLanguageAt(
            "colon-bind-expression-injection.rozie",
            "\$data.modalOpen",
            "JavaScript",
        )
        assertInjectedLanguageAt(
            "colon-bind-expression-injection.rozie",
            "contents.id",
            "JavaScript",
        )
    }

    fun testEventWithModifiersInjectsOnlyExpressionPart() {
        // POSITIVE: the expression `saveForm()` (between the quotes, after the `=`) IS
        // JS-injected.
        assertInjectedLanguageAt(
            "event-with-modifiers-injection.rozie",
            "saveForm()",
            "JavaScript",
        )
        // NEGATIVE: `.prevent` lives in the attribute NAME (`@submit.prevent.stop`),
        // BEFORE the `=`. It MUST NOT be covered by any JavaScript injection — the
        // modifier suffix is Rozie syntax, not JS.
        myFixture.configureByFile("event-with-modifiers-injection.rozie")
        val text = myFixture.file.text
        val preventOffset = text.indexOf(".prevent")
        check(preventOffset >= 0) { "Anchor '.prevent' not found in fixture" }
        val ilm = InjectedLanguageManager.getInstance(project)
        val injectedAtPrevent = ilm.findInjectedElementAt(myFixture.file, preventOffset + 1)
        // Either no injected element at this offset, or the injected element is not
        // JavaScript (e.g., the HTML injection over the whole template body is fine —
        // HTML treats `.prevent` as part of an attribute name).
        val injectedLangId = injectedAtPrevent?.containingFile?.language?.id
        assertTrue(
            "Modifier suffix `.prevent` MUST NOT land inside a JavaScript injection — " +
                "the modifier chain is Rozie syntax, not JS. Got injected language id: $injectedLangId",
            injectedLangId != "JavaScript",
        )
    }

    fun testMustacheInterpolationIsJsInjected() {
        // Anchor on `$data.count + 1` — pins both that the interior is JS-injected
        // AND that the `{{` / `}}` delimiters are not part of the JS range (the
        // anchor offset sits strictly inside the delimiters).
        assertInjectedLanguageAt(
            "mustache-interpolation-injection.rozie",
            "\$data.count + 1",
            "JavaScript",
        )
    }

    // === Helpers ===

    /**
     * Configure [fixtureFile] and return the injected JS [PsiFile] containing the
     * anchor offset. Helper for Plan 08.2-11 paren-wrap tests that need access to
     * the injected JS PSI tree (not just the language id).
     */
    private fun configureAndGetInjectedJs(fixtureFile: String, anchor: String): PsiFile {
        myFixture.configureByFile(fixtureFile)
        val text = myFixture.file.text
        val offset = text.indexOf(anchor)
        check(offset >= 0) { "Anchor '$anchor' not found in $fixtureFile" }
        val ilm = InjectedLanguageManager.getInstance(project)
        val injectedElement = ilm.findInjectedElementAt(myFixture.file, offset)
            ?: error("No injection found at offset $offset (anchor='$anchor') in $fixtureFile")
        val injectedFile = injectedElement.containingFile
            ?: error("Injected element at offset $offset had null containingFile")
        check(injectedFile.language.id == "JavaScript") {
            "Expected JavaScript-injected file at anchor '$anchor' in $fixtureFile; " +
                "got language id '${injectedFile.language.id}'"
        }
        return injectedFile
    }

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
