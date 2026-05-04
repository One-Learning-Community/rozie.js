package js.rozie.intellij

import org.json.JSONObject
import org.junit.Assert.assertNotNull
import org.junit.Test
import java.io.File

/**
 * Wave 0 scaffold for the D-07 TextMate <-> JFlex drift check.
 *
 * Plan 02 will extend this with assertions that every Rozie-specific TM scope from
 * `tools/textmate/syntaxes/rozie.tmLanguage.json` is mirrored by an `IElementType`
 * registered in `RozieTokenTypes`. For now this scaffold only verifies that the
 * TM JSON file is reachable from the test working directory — that's the load-bearing
 * Pitfall 10 check (the TM path must be supplied through a system property because
 * Gradle's test-task working directory differs between local and CI).
 */
class TextMateGrammarParityTest {
    private val tmGrammarPath: String =
        System.getProperty("rozie.tmGrammarPath")
            ?: error(
                "rozie.tmGrammarPath system property not set; check build.gradle.kts " +
                    "tasks.test block (Pitfall 10)"
            )

    @Test
    fun `TM grammar file is reachable from test working directory`() {
        val tmFile = File(tmGrammarPath)
        // JUnit's assertNotNull is (message, value) — opposite arg order from kotlin.test
        assertNotNull("tm grammar file resolves to null path", tmFile)
        check(tmFile.exists()) {
            "TM grammar not found at $tmGrammarPath — verify Pitfall 10 fix in build.gradle.kts"
        }
        val json = JSONObject(tmFile.readText())
        check(json.getString("name") == "Rozie") {
            "TM grammar 'name' field is not 'Rozie'"
        }
    }

    // Plan 02 populates: assert every Rozie-specific TM scope has a corresponding
    // RozieTokenTypes IElementType (D-07 drift check).
}
