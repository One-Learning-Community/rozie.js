package js.rozie.intellij

import com.intellij.ide.structureView.StructureViewTreeElement
import com.intellij.ide.structureView.TreeBasedStructureViewBuilder
import com.intellij.openapi.util.Disposer
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.structure.RozieStructureViewFactory

/**
 * Contract test for [js.rozie.intellij.structure.RozieStructureViewFactory]:
 * the structure view of a `.rozie` file lists exactly its SFC blocks, in
 * document order, with the bare tag name as each node's label.
 *
 * The model is built directly off the factory (no tool-window UI needed) and
 * disposed afterwards — `StructureViewModel` is `Disposable`.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RozieStructureViewTest : BasePlatformTestCase() {

    fun testStructureViewListsSfcBlocks() {
        myFixture.configureByText(
            "Structure.rozie",
            "<rozie name=\"Structure\">\n" +
                "<template>\n  <div></div>\n</template>\n" +
                "<script>\nconst count = 1;\n</script>\n" +
                "<style>\n.box { color: red; }\n</style>\n" +
                "</rozie>\n",
        )
        val builder = RozieStructureViewFactory().getStructureViewBuilder(myFixture.file)
        val model = (builder as TreeBasedStructureViewBuilder).createStructureViewModel(null)
        try {
            val labels = model.root.children.map {
                (it as StructureViewTreeElement).presentation.presentableText
            }
            assertEquals(
                "structure view should list each SFC block by tag name, in order",
                listOf("rozie", "template", "script", "style"),
                labels,
            )
        } finally {
            Disposer.dispose(model)
        }
    }
}
