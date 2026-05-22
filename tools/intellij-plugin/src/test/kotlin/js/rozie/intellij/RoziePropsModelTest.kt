package js.rozie.intellij

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.psi.PsiElement
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.props.RoziePropsModel

/**
 * Contract test for the reusable [js.rozie.intellij.props.RoziePropsModel]:
 * given any element in a `.rozie` file's injected JS, it resolves the sibling
 * `<props>` block and returns each declared prop with its `model` flag.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RoziePropsModelTest : BasePlatformTestCase() {

    fun testExtractsPropNamesAndModelFlag() {
        myFixture.configureByText(
            "Props.rozie",
            "<rozie name=\"Props\">\n" +
                "<props>{ count: { type: Number }, value: { type: String, model: true } }</props>\n" +
                "<script>\nconst r = \$props.count;\n</script>\n" +
                "</rozie>",
        )
        val props = RoziePropsModel.propsOf(injectedContext("\$props.count"))

        assertEquals(
            "both declared props should be discovered",
            setOf("count", "value"),
            props.map { it.name }.toSet(),
        )
        assertFalse(
            "`count` has no `model: true` — it is not a model prop",
            props.first { it.name == "count" }.isModel,
        )
        assertTrue(
            "`value` is declared `model: true`",
            props.first { it.name == "value" }.isModel,
        )
    }

    fun testNoPropsBlockYieldsEmpty() {
        myFixture.configureByText(
            "NoProps.rozie",
            "<rozie name=\"NoProps\">\n<script>\nconst x = 1;\n</script>\n</rozie>",
        )
        assertTrue(
            "a file with no <props> block yields no props",
            RoziePropsModel.propsOf(injectedContext("const x")).isEmpty(),
        )
    }

    /** Descend into the injected JS PSI at the first occurrence of [anchor]. */
    private fun injectedContext(anchor: String): PsiElement {
        val offset = myFixture.file.text.indexOf(anchor)
        check(offset >= 0) { "anchor '$anchor' not found in fixture" }
        return InjectedLanguageManager.getInstance(project)
            .findInjectedElementAt(myFixture.file, offset + 1)
            ?: error("no injected element at '$anchor'")
    }
}
