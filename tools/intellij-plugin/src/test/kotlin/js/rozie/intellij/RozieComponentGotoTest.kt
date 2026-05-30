package js.rozie.intellij

import com.intellij.codeInsight.navigation.actions.GotoDeclarationAction
import com.intellij.psi.PsiFile
import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Contract test for [js.rozie.intellij.navigation.RozieComponentGotoDeclarationHandler]:
 * go-to-definition on a composed-component tag, and on its `<components>` import
 * path string, both navigate to the producer `.rozie` file.
 *
 * Exercised through the real platform pipeline ([GotoDeclarationAction.findAllTargetElements])
 * so the injection-aware element lookup the IDE uses is what gets tested.
 *
 * Each test loads a two-file fixture (consumer + the shared `xfile-producer.rozie`,
 * same dir so the `./xfile-producer.rozie` relative import resolves). JUnit-3
 * convention: every test method MUST start with `test`.
 */
class RozieComponentGotoTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/completion"

    fun testGotoOnComponentTagNavigatesToProducer() {
        myFixture.configureByFiles("goto-tag-consumer.rozie", "xfile-producer.rozie")
        val targets = GotoDeclarationAction.findAllTargetElements(
            project, myFixture.editor, myFixture.caretOffset,
        )
        assertTrue(
            "Ctrl-click on <Modal> should navigate to xfile-producer.rozie; targets: " +
                targets.map { (it as? PsiFile)?.name ?: it.toString() },
            targets.any { it is PsiFile && it.name == "xfile-producer.rozie" },
        )
    }

    fun testGotoOnImportPathStringNavigatesToProducer() {
        myFixture.configureByFiles("goto-import-consumer.rozie", "xfile-producer.rozie")
        val targets = GotoDeclarationAction.findAllTargetElements(
            project, myFixture.editor, myFixture.caretOffset,
        )
        assertTrue(
            "Ctrl-click on the import path should navigate to xfile-producer.rozie; targets: " +
                targets.map { (it as? PsiFile)?.name ?: it.toString() },
            targets.any { it is PsiFile && it.name == "xfile-producer.rozie" },
        )
    }
}
