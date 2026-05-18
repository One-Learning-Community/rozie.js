package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.completion.RozieMagicIdentifiers

/**
 * SC-6 contract test for [js.rozie.intellij.completion.RozieJsMagicIdentifierCompletionContributor]:
 * typing `$` (or a `$X` prefix) in JS identifier position inside ANY Rozie-injected
 * JS fragment (`<script>` / `<listeners>` / `<props>` / `<data>` / `<components>`)
 * surfaces the canonical magic-identifier list from [RozieMagicIdentifiers] (the
 * DRY single-source-of-truth — Plan 02's RozieKnownAttributes pattern mirrored
 * for the JS surface).
 *
 * Behavior 3 asserts against the registry itself (not a hard-coded copy of the
 * names), which proves the DRY contract: Plan 13's completion contributor reads
 * the same source the test reads. Adding a 12th magic identifier in v0.3.0 needs
 * 1-line append to [RozieMagicIdentifiers.MAGIC_IDENTIFIERS] and zero edits to
 * the contributor or this test — the assertion picks up the new name
 * automatically.
 *
 * Behavior 4 is the Pitfall 2 regression guard: a plain `.js` file (NOT `.rozie`)
 * MUST NOT see magic-identifier suggestions, because the contributor is gated by
 * `RozieContextCheck.isRozieContext`. Without the guard, every `.js` / `.ts` /
 * `.tsx` file in the user's project would pollute with `$props` / `$data` /
 * etc. on every keystroke beginning with `$`.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RozieJsMagicCompletionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/completion"

    // === Behavior 1: typing `$pr` in <script> surfaces $props (narrow positive) ===

    fun testDollarPrefixSurfacesPropsInScript() {
        myFixture.configureByFile("script-magic-dollar-prefix.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue(
            "Expected `\$props` in completion suggestions for `\$pr` prefix in <script>; " +
                "got: $lookups",
            "\$props" in lookups,
        )
    }

    // === Behavior 2: typing `$da` in <listeners> surfaces $data (cross-block-type positive) ===

    fun testDollarPrefixSurfacesDataInListeners() {
        myFixture.configureByFile("listeners-magic-dollar-prefix.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue(
            "Expected `\$data` in completion suggestions for `\$da` prefix in <listeners>; " +
                "got: $lookups",
            "\$data" in lookups,
        )
    }

    // === Behavior 3: typing bare `$` surfaces all 11 magic identifiers (DRY assertion) ===

    fun testBareDollarSurfacesAllMagicIdentifiers() {
        myFixture.configureByFile("script-magic-bare-dollar.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        for ((name, _) in RozieMagicIdentifiers.MAGIC_IDENTIFIERS) {
            assertTrue(
                "Expected `$name` in completion suggestions for bare `\$` prefix; " +
                    "got: $lookups",
                name in lookups,
            )
        }
    }

    // === Behavior 4 (negative — Pitfall 2 guard): plain .js MUST NOT see magic idents ===

    fun testPlainJsFileDoesNotSurfaceMagicIdentifiers() {
        myFixture.configureByText("plain.js", "const x = \$pr<caret>")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        // Spot-check 4 of the most common — the contract is "none of the magic
        // identifiers leak", and a sampled check is sufficient; the positive
        // tests above already enumerate the full registry inside .rozie context.
        for (name in listOf("\$props", "\$data", "\$refs", "\$emit")) {
            assertFalse(
                "Pitfall 2 leak: `$name` MUST NOT appear in plain .js completion " +
                    "(only inside .rozie host); got: $lookups",
                name in lookups,
            )
        }
    }
}
