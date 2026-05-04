package js.rozie.intellij

import com.intellij.lexer.Lexer
import com.intellij.testFramework.LexerTestCase
import org.junit.Test

/**
 * Wave 0 scaffold for fixture-driven JFlex-lexer snapshot tests.
 *
 * Plan 02 will:
 *   - implement [createLexer] as `FlexAdapter(_RozieLexer(null))`
 *   - replace the placeholder method with calls to
 *     `doTest("Counter.rozie", "Counter.rozie.txt")` for each of the 8 fixtures
 *     under `src/test/testData/lexer/`.
 *
 * Until then the placeholder method gives `./gradlew test` a green class to load
 * without dragging in a half-implemented lexer.
 */
class RozieLexerTest : LexerTestCase() {
    override fun createLexer(): Lexer =
        TODO("Plan 02: instantiate RozieLexerAdapter once Rozie.flex generates _RozieLexer")

    override fun getDirPath(): String = "src/test/testData/lexer"

    @Test
    fun `placeholder until Plan 02 lexer lands`() {
        // Intentionally empty — Plan 02 will populate with doTest(...) per fixture.
        // Keeping a passing test here means LexerTestCase loads cleanly today.
    }
}
