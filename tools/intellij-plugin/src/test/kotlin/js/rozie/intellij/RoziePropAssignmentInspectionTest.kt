package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.inspection.RoziePropAssignmentInspection

/**
 * Contract test for [js.rozie.intellij.inspection.RoziePropAssignmentInspection]:
 * assigning to a declared non-`model` prop is flagged (the editor mirror of the
 * compiler's ROZ200); assigning to a `model: true` prop, reading a prop, and
 * touching an undeclared name are all left alone.
 *
 * Every fixture declares the same `<props>` — `count` (non-model) and `value`
 * (`model: true`) — and varies only the `<script>` body.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RoziePropAssignmentInspectionTest : BasePlatformTestCase() {

    fun testWriteToNonModelPropIsFlagged() {
        configure("\$props.count = 5;")
        assertTrue(
            "expected a non-model-prop assignment problem for `count`; got: ${rozieProblems()}",
            rozieProblems().any { it.contains("'count'") },
        )
    }

    fun testWriteToModelPropIsAllowed() {
        configure("\$props.value = 'next';")
        assertTrue(
            "a `model: true` prop is writable — no problem expected; got: ${rozieProblems()}",
            rozieProblems().isEmpty(),
        )
    }

    fun testReadingPropIsAllowed() {
        configure("const r = \$props.count;")
        assertTrue(
            "reading a prop is fine — no problem expected; got: ${rozieProblems()}",
            rozieProblems().isEmpty(),
        )
    }

    fun testWriteToUndeclaredPropNotFlagged() {
        configure("\$props.ghost = 1;")
        assertTrue(
            "an undeclared prop is an unknown-prop concern (ROZ100), not this " +
                "inspection's; got: ${rozieProblems()}",
            rozieProblems().isEmpty(),
        )
    }

    fun testCompoundAssignmentIsFlagged() {
        configure("\$props.count += 1;")
        assertTrue(
            "a compound assignment to a non-model prop is still a write; got: ${rozieProblems()}",
            rozieProblems().any { it.contains("'count'") },
        )
    }

    private fun configure(scriptBody: String) {
        myFixture.configureByText(
            "Assign.rozie",
            "<rozie name=\"Assign\">\n" +
                "<props>{ count: { type: Number }, value: { type: String, model: true } }</props>\n" +
                "<script>\n$scriptBody\n</script>\n" +
                "</rozie>",
        )
        myFixture.enableInspections(RoziePropAssignmentInspection())
    }

    private fun rozieProblems(): List<String> =
        myFixture.doHighlighting()
            .mapNotNull { it.description }
            .filter { it.startsWith("Cannot assign to prop") }
}
