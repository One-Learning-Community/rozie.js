package js.rozie.intellij

import com.intellij.lexer.Lexer
import com.intellij.testFramework.LexerTestCase
import js.rozie.intellij.lexer.RozieLexerAdapter
import java.io.File

/**
 * Fixture-driven snapshot tests for the Rozie JFlex lexer.
 *
 * For each fixture under `src/test/testData/lexer/` (e.g. `Counter.rozie`), the
 * corresponding `.rozie.txt` file holds the expected token-stream snapshot.
 * `LexerTestCase` compares actual lexer output line-for-line against the .txt
 * file.
 *
 * Note: [LexerTestCase] descends from JUnit 3's `TestCase`; method names must
 * begin with `test` to be picked up by Gradle's runner (JUnit 4 `@Test`
 * annotations are ignored on JUnit-3-style classes — Wave 1 deviation #6).
 *
 * Snapshot regeneration: when the lexer changes intentionally and the .txt
 * snapshots need refreshing, temporarily uncomment the `testRegenerateSnapshots`
 * method below, run `./gradlew test`, inspect the `git diff` on the .txt
 * files, then re-comment the method. Do NOT leave it uncommented in committed
 * source.
 */
class RozieLexerTest : LexerTestCase() {
    override fun createLexer(): Lexer = RozieLexerAdapter()
    override fun getDirPath(): String = "src/test/testData/lexer"

    fun testCounter() = doFixtureTest("Counter.rozie", null)
    fun testSearchInput() = doFixtureTest("SearchInput.rozie", null)
    fun testDropdown() = doFixtureTest("Dropdown.rozie", null)
    fun testTodoList() = doFixtureTest("TodoList.rozie", null)
    fun testModal() = doFixtureTest("Modal.rozie", null)
    fun testEdgeMultiRefModifier() = doFixtureTest("edge-multi-ref-modifier.rozie", null)
    fun testEdgeMustacheInAttr() = doFixtureTest("edge-mustache-in-attr.rozie", null)
    fun testEdgeMagicInRfor() = doFixtureTest("edge-magic-in-rfor.rozie", null)
    fun testEdgeComponentsBlock() = doFixtureTest("edge-components-block.rozie", null)

    /**
     * Drives a single fixture: reads `<inputName>` from [getDirPath], lexes it,
     * and (when the corresponding `<inputName>.txt` snapshot exists) compares
     * the printed token stream byte-for-byte against the snapshot. The
     * `expectedFileName` parameter overrides the default `<inputName>.txt`
     * derivation when supplied.
     *
     * Named `doFixtureTest` rather than `doTest` to avoid colliding with
     * `LexerTestCase`'s own `doTest(text)` member, which works off raw file
     * content rather than a fixture path.
     */
    private fun doFixtureTest(inputName: String, expectedFileName: String?) {
        val inputFile = File("${getDirPath()}/$inputName")
        check(inputFile.exists()) { "Fixture not found: ${inputFile.absolutePath}" }
        val expectedFile = File("${getDirPath()}/${expectedFileName ?: "$inputName.txt"}")
        check(expectedFile.exists()) {
            "Expected snapshot not found: ${expectedFile.absolutePath} — " +
                "uncomment testRegenerateSnapshots to (re)generate, run once, then re-comment."
        }
        val expected = expectedFile.readText().trimEnd('\n')
        val actual = printTokens(inputFile.readText(), 0).trimEnd('\n')
        if (expected != actual) {
            // Write the actual stream next to the expected file so failures
            // surface a viewable artifact for debugging.
            File("${getDirPath()}/$inputName.actual.txt").writeText(actual)
            assertEquals(
                "Lexer snapshot mismatch for $inputName " +
                    "(see ${getDirPath()}/$inputName.actual.txt for actual output)",
                expected,
                actual
            )
        }
    }

    // -----------------------------------------------------------------------
    // Snapshot regeneration helper. Uncomment, run once, inspect diffs, re-comment.
    //
    // fun testRegenerateSnapshots() {
    //     val fixtures = listOf(
    //         "Counter.rozie", "SearchInput.rozie", "Dropdown.rozie",
    //         "TodoList.rozie", "Modal.rozie",
    //         "edge-multi-ref-modifier.rozie",
    //         "edge-mustache-in-attr.rozie",
    //         "edge-magic-in-rfor.rozie",
    //         "edge-components-block.rozie"
    //     )
    //     fixtures.forEach { name ->
    //         val input = File("${getDirPath()}/$name").readText()
    //         val out = printTokens(input, 0)
    //         File("${getDirPath()}/$name.txt").writeText(out)
    //     }
    // }
}
