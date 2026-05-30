package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Contract test for
 * [js.rozie.intellij.completion.RozieComponentImportPathCompletionContributor]:
 * typing a `<components>` import string offers sibling `.rozie` file paths.
 *
 * JUnit-3 convention: every test method MUST start with `test`.
 */
class RozieComponentImportPathCompletionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/completion"

    fun testImportStringOffersSiblingRozieFiles() {
        // Two sibling .rozie files keep the popup open (a single match would
        // auto-insert and return no lookup list).
        myFixture.configureByFiles(
            "import-path-consumer.rozie", "xfile-producer.rozie", "import-path-other.rozie",
        )
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue(
            "Expected `./xfile-producer.rozie` among import-path completions; got: $lookups",
            "./xfile-producer.rozie" in lookups,
        )
        assertTrue(
            "Expected `./import-path-other.rozie` among import-path completions; got: $lookups",
            "./import-path-other.rozie" in lookups,
        )
        // The file being edited must not offer to import itself.
        assertFalse(
            "Consumer should not import itself; got: $lookups",
            "./import-path-consumer.rozie" in lookups,
        )
    }
}
