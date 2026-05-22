package js.rozie.intellij

import com.intellij.ide.fileTemplates.FileTemplateManager
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import java.util.Properties

/**
 * Contract test for the "New Rozie Component" file template (registered via
 * `<internalFileTemplate name="Rozie Component"/>`, content in
 * `resources/fileTemplates/internal/Rozie Component.ft`).
 *
 * Rendering the template with a `NAME` property exercises the whole wiring
 * end to end: the `<internalFileTemplate>` registration, the bundled `.ft`
 * resource, and the Velocity `${NAME}` substitution that
 * [js.rozie.intellij.actions.RozieCreateComponentAction] relies on.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RozieFileTemplateTest : BasePlatformTestCase() {

    fun testRozieComponentTemplateRendersSkeleton() {
        val template = FileTemplateManager.getInstance(project)
            .getInternalTemplate("Rozie Component")
        val props = Properties().apply { setProperty("NAME", "MyButton") }
        val rendered = template.getText(props)

        assertTrue(
            "template should fill the component name from \${NAME}; got:\n$rendered",
            rendered.contains("<rozie name=\"MyButton\">"),
        )
        assertTrue(
            "template should scaffold a <template> block; got:\n$rendered",
            rendered.contains("<template>"),
        )
        assertTrue(
            "template should scaffold a <script> block; got:\n$rendered",
            rendered.contains("<script>"),
        )
    }
}
